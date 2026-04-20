#!/usr/bin/env node
// Claude Code session-trace collector.
//
// Reads every session JSONL under ~/.claude/projects/<project-slug>/ and
// extracts routing-relevant events:
//
//   1. scaffold.cli   — bash tool calls to `node dist/cli.js {plan,compose,
//                       validate,context}` paired with captured stdout.
//                       Each is a (prompt, planner-output) ground-truth pair.
//   2. correction     — a user message following an assistant response that
//                       contains corrective phrasing ("don't", "wrong",
//                       "instead", "should be", "why are you", "use X not Y").
//                       Each becomes a (prev_assistant_attempt, user_correction,
//                       next_assistant_retry) triple that is high-signal
//                       training data for AxGEPA.
//   3. judge          — user messages that judge an assistant output
//                       ("this is wrong because X", "good", "that works",
//                       "ship it"). Binary labels for training the judge.
//
// Writes .evolve/traces/session-traces.jsonl (append-only). Idempotent via
// (session-id, event-idx) dedup.
//
// Usage:
//   node scripts/collect-session-traces.mjs              # incremental
//   node scripts/collect-session-traces.mjs --rebuild    # from scratch
//   node scripts/collect-session-traces.mjs --project <slug>

import { readdirSync, readFileSync, existsSync, mkdirSync, statSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const argv = process.argv.slice(2)
const rebuild = argv.includes('--rebuild')
const projectFilter = (() => {
  const i = argv.indexOf('--project')
  return i >= 0 ? argv[i + 1] : null
})()

const PROJECTS_DIR = join(homedir(), '.claude', 'projects')
const OUT = '.evolve/traces/session-traces.jsonl'
const SEEN = '.evolve/traces/.session-seen.json'

mkdirSync('.evolve/traces', { recursive: true })

const seen = rebuild || !existsSync(SEEN) ? {} : JSON.parse(readFileSync(SEEN, 'utf8'))
if (rebuild) {
  writeFileSync(OUT, '')
}

const CORRECTION_MARKERS = [
  /\bdon'?t\b/i,
  /\bdont\b/i,
  /\bwrong\b/i,
  /\binstead\b/i,
  /\bshould be\b/i,
  /\bshould use\b/i,
  /\bwhy are you\b/i,
  /\buse \w+ not \w+\b/i,
  /\bnever\b/i,
  /\bstop\b/i,
  /\bincorrect\b/i,
  /\bthat'?s not\b/i,
  /\bno,\b/i,
  /\bno\.\s/i,
  /\bbut,?\s+(we|you|i)\b/i,
  /\bredo\b/i,
  /\bactually\b/i,
]

const POSITIVE_MARKERS = [
  /\bperfect\b/i,
  /\bship it\b/i,
  /\blgtm\b/i,
  /\blooks good\b/i,
  /\bthat works\b/i,
  /\bgreat\b/i,
  /\bnice\b/i,
  /\bawesome\b/i,
]

function textOf(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const p of content) {
    if (typeof p === 'string') parts.push(p)
    else if (p?.type === 'text' && typeof p.text === 'string') parts.push(p.text)
    else if (p?.type === 'tool_use') parts.push(`[tool:${p.name}]`)
    else if (p?.type === 'tool_result') parts.push(String(p.content ?? '').slice(0, 400))
  }
  return parts.join('\n')
}

function extractBashToolCalls(entry) {
  const out = []
  const content = entry?.message?.content
  if (!Array.isArray(content)) return out
  for (const part of content) {
    if (part?.type !== 'tool_use') continue
    if (part?.name !== 'Bash') continue
    const cmd = part?.input?.command
    if (!cmd) continue
    // Match scaffold CLI invocations: `node dist/cli.js plan/compose/...`
    if (/node\s+dist\/cli\.js\s+(plan|compose|compose-prompt|validate|context|select|bench|prove)\b/.test(cmd)) {
      out.push({ toolUseId: part.id, command: cmd })
    }
  }
  return out
}

function hasMarker(text, markers) {
  return markers.some((r) => r.test(text))
}

function processSession(sessionPath, sessionId) {
  const raw = readFileSync(sessionPath, 'utf8')
  const lines = raw.trim().split('\n')
  const entries = []
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line))
    } catch {
      // skip malformed
    }
  }

  const seenKey = `${sessionId}`
  const lastSeenIdx = seen[seenKey] ?? -1
  const newEvents = []

  // Index assistant messages so we can pair user corrections back to them.
  for (let i = Math.max(0, lastSeenIdx + 1); i < entries.length; i++) {
    const e = entries[i]
    if (!e) continue

    // scaffold.cli events
    if (e.type === 'assistant') {
      const bashCalls = extractBashToolCalls(e)
      for (const b of bashCalls) {
        // Find paired tool_result in a following user entry
        let result = null
        for (let j = i + 1; j < Math.min(entries.length, i + 10); j++) {
          const u = entries[j]
          if (u?.type !== 'user') continue
          const content = u?.message?.content
          if (!Array.isArray(content)) continue
          for (const p of content) {
            if (p?.type === 'tool_result' && p?.tool_use_id === b.toolUseId) {
              result = typeof p.content === 'string'
                ? p.content
                : Array.isArray(p.content)
                ? p.content.map((x) => x?.text ?? '').join('')
                : ''
              break
            }
          }
          if (result !== null) break
        }
        if (result !== null) {
          newEvents.push({
            kind: 'scaffold.cli',
            sessionId,
            idx: i,
            ts: e.timestamp ?? null,
            command: b.command,
            stdoutPreview: result.slice(0, 2000),
          })
        }
      }
    }

    // correction / judge events
    if (e.type === 'user' && i > 0) {
      const text = textOf(e?.message?.content)
      if (!text || text.startsWith('[tool:') || text.includes('<tool_result>')) continue
      // Skip false positives where the message is mostly a code/tool-result
      // paste with line numbers or diff markers — the corrective marker is
      // usually inside code, not actual human phrasing.
      const firstLine = text.split('\n')[0] ?? ''
      if (/^\s*\d+[-:+]/.test(firstLine)) continue // line-number pastes
      if (firstLine.startsWith('```')) continue
      if (text.startsWith('<command-')) continue
      if (text.length > 4000 && text.match(/\n/g)?.length > 50) continue // long code paste
      // pair with previous assistant message
      let prevAssistant = null
      for (let j = i - 1; j >= Math.max(0, i - 30); j--) {
        if (entries[j]?.type === 'assistant') {
          prevAssistant = entries[j]
          break
        }
      }
      if (!prevAssistant) continue
      const prevText = textOf(prevAssistant?.message?.content)
      if (!prevText) continue

      if (hasMarker(text, CORRECTION_MARKERS)) {
        // find next assistant retry
        let retry = null
        for (let k = i + 1; k < Math.min(entries.length, i + 15); k++) {
          if (entries[k]?.type === 'assistant') {
            retry = textOf(entries[k]?.message?.content)
            break
          }
        }
        newEvents.push({
          kind: 'correction',
          sessionId,
          idx: i,
          ts: e.timestamp ?? null,
          userCorrection: text.slice(0, 2000),
          priorAssistantAttempt: prevText.slice(0, 2000),
          assistantRetry: retry ? retry.slice(0, 2000) : null,
        })
      } else if (hasMarker(text, POSITIVE_MARKERS)) {
        newEvents.push({
          kind: 'judge.positive',
          sessionId,
          idx: i,
          ts: e.timestamp ?? null,
          userMessage: text.slice(0, 800),
          priorAssistantAttempt: prevText.slice(0, 2000),
        })
      }
    }
  }

  if (entries.length > 0) {
    seen[seenKey] = entries.length - 1
  }
  return newEvents
}

let projectCount = 0
let sessionCount = 0
let eventCount = 0
const perKind = {}

if (!existsSync(PROJECTS_DIR)) {
  console.error(`no projects dir: ${PROJECTS_DIR}`)
  process.exit(2)
}

for (const projectSlug of readdirSync(PROJECTS_DIR)) {
  if (projectFilter && projectSlug !== projectFilter) continue
  const projDir = join(PROJECTS_DIR, projectSlug)
  if (!statSync(projDir).isDirectory()) continue
  projectCount++
  // jsonl files sit at the top level of the project dir, session-id as filename
  for (const name of readdirSync(projDir)) {
    if (!name.endsWith('.jsonl')) continue
    const path = join(projDir, name)
    const sessionId = name.replace(/\.jsonl$/, '')
    sessionCount++
    const events = processSession(path, sessionId)
    if (events.length === 0) continue
    const buffered = events.map((ev) => JSON.stringify({ ...ev, project: projectSlug })).join('\n') + '\n'
    appendFileSync(OUT, buffered)
    eventCount += events.length
    for (const ev of events) perKind[ev.kind] = (perKind[ev.kind] ?? 0) + 1
  }
}

writeFileSync(SEEN, JSON.stringify(seen, null, 2))

console.log(`projects: ${projectCount}, sessions: ${sessionCount}`)
console.log(`events: ${eventCount}`)
for (const [k, n] of Object.entries(perKind)) console.log(`  ${k}: ${n}`)
console.log(`wrote: ${OUT}`)
