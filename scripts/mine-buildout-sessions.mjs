#!/usr/bin/env node
// Miner stage: extracts buildout events from Claude Code factory-local session
// transcripts.
//
// Fault tolerance:
//   - Per-session cursor stored in .evolve/traces/.buildouts-miner-state.json.
//     Re-running after a new session appears only processes the new one.
//   - A session that errors out is added to `poisoned` and skipped next run
//     (override with --force-retry <sessionId> or --force-all).
//   - Every failure writes to .buildouts-errors.jsonl with context so we can
//     diagnose later without re-reading the full transcript.
//   - Output JSONL is append-only. Schema version is embedded in each row so
//     downstream consumers can detect breaks.
//
// Usage:
//   node scripts/mine-buildout-sessions.mjs                         # incremental
//   node scripts/mine-buildout-sessions.mjs --projects-dir PATH     # custom source
//   node scripts/mine-buildout-sessions.mjs --rebuild               # start fresh
//   node scripts/mine-buildout-sessions.mjs --force-all             # retry poisoned

import { readdirSync, readFileSync, statSync, existsSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { performance } from 'node:perf_hooks'
import {
  BUILDOUT_SCHEMA_VERSION,
  DEFAULT_PATHS,
  emptyMinerState,
  parseSlug,
  isBuildoutSlug,
} from '../dist/lib/buildout-traces.js'

const argv = process.argv.slice(2)
function arg(k, fallback) {
  const i = argv.indexOf(k)
  return i >= 0 ? argv[i + 1] : fallback
}
const projectsDir = arg('--projects-dir', join(homedir(), '.claude', 'projects'))
const rebuild = argv.includes('--rebuild')
const forceAll = argv.includes('--force-all')
const forceSession = arg('--force-retry', null)

// Safety: ensure dist/ is compiled (loader import above) — fail loudly if not.
mkdirSync('.evolve/traces', { recursive: true })

if (rebuild) {
  rmSync(DEFAULT_PATHS.buildoutsJsonl, { force: true })
  rmSync(DEFAULT_PATHS.minerState, { force: true })
  rmSync(DEFAULT_PATHS.errorsJsonl, { force: true })
  console.log(`rebuild: cleared ${DEFAULT_PATHS.buildoutsJsonl} + state`)
}

const state = existsSync(DEFAULT_PATHS.minerState)
  ? JSON.parse(readFileSync(DEFAULT_PATHS.minerState, 'utf8'))
  : emptyMinerState()

// Schema bump → full rebuild.
if (state.schemaVersion !== BUILDOUT_SCHEMA_VERSION) {
  console.log(`schema version changed (${state.schemaVersion} → ${BUILDOUT_SCHEMA_VERSION}) — forcing rebuild`)
  rmSync(DEFAULT_PATHS.buildoutsJsonl, { force: true })
  rmSync(DEFAULT_PATHS.errorsJsonl, { force: true })
  Object.assign(state, emptyMinerState())
}

const t0 = performance.now()
let scanned = 0
let newEvents = 0
let poisonedAdded = 0

// ---- helpers ----

function tryParseJson(line) {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

/** Extract first substantive user prompt. Skip tool_result wrappers, /-commands, hooks. */
function findInitialPrompt(entries) {
  for (const e of entries) {
    if (e?.type !== 'user') continue
    const content = e?.message?.content
    const text = typeof content === 'string'
      ? content
      : Array.isArray(content)
      ? content
          .filter((p) => p?.type === 'text' && typeof p.text === 'string')
          .map((p) => p.text)
          .join('\n')
      : ''
    if (!text) continue
    if (text.startsWith('[tool:') || text.startsWith('<command-') || text.includes('<tool_result>')) continue
    if (text.startsWith('<system-reminder>')) continue
    return text.trim().slice(0, 4000)
  }
  return null
}

const PM_REGEX_LIST = [
  { pm: 'pnpm', re: /\bpnpm\s+(?:-\w+\s+)*add\s+([^\n|;]+?)(?:\n|$|;|\|)/g },
  { pm: 'npm', re: /\bnpm\s+(?:install|i|add)\s+([^\n|;]+?)(?:\n|$|;|\|)/g },
  { pm: 'yarn', re: /\byarn\s+add\s+([^\n|;]+?)(?:\n|$|;|\|)/g },
  { pm: 'cargo', re: /\bcargo\s+add\s+([^\n|;]+?)(?:\n|$|;|\|)/g },
  { pm: 'go', re: /\bgo\s+get\s+([^\n|;]+?)(?:\n|$|;|\|)/g },
  { pm: 'pip', re: /\bpip\s+install\s+([^\n|;]+?)(?:\n|$|;|\|)/g },
]

// Valid npm/cargo/etc. package names: start with letter/@, contain letters,
// digits, dashes, underscores, dots, slashes (for scopes). Rejects shell
// operators like 2>&1, |, &&, pipe artifacts, quotes.
const VALID_PKG_NAME = /^(?:@[a-z0-9][\w.-]*\/)?[a-z][\w.-]*(?:\/[\w.-]+)*$/i

function parsePackagesFromCmd(cmd) {
  const out = []
  for (const { pm, re } of PM_REGEX_LIST) {
    re.lastIndex = 0
    for (const m of cmd.matchAll(re)) {
      const raw = (m[1] ?? '').trim()
      if (!raw) continue
      for (const token of raw.split(/\s+/)) {
        if (!token || token.startsWith('-')) continue
        // Strip version specifiers. Keep leading @scope.
        const clean = token.startsWith('@')
          ? token.split('@').slice(0, 2).join('@')
          : token.split('@')[0]
        if (!clean || clean.startsWith('.')) continue
        // Reject shell redirect / pipe artifacts and anything that doesn't
        // look like a real package name.
        if (!VALID_PKG_NAME.test(clean)) continue
        // Reject single-char and obvious non-names.
        if (clean.length < 2) continue
        out.push({ pm, name: clean })
      }
    }
  }
  return out
}

const MKDIR_RE = /\bmkdir\s+(?:-\w+\s+)*([^\n|;]+?)(?:\n|$|;|\|)/g
const TOUCH_RE = /\btouch\s+([^\n|;]+?)(?:\n|$|;|\|)/g

function parseDirsFromCmd(cmd) {
  const out = []
  MKDIR_RE.lastIndex = 0
  for (const m of cmd.matchAll(MKDIR_RE)) {
    const targets = (m[1] ?? '').trim().split(/\s+/)
    for (const t of targets) {
      if (!t || t.startsWith('-')) continue
      out.push(t.replace(/^\.\//, ''))
    }
  }
  return out
}

function parseTouchedFromCmd(cmd) {
  const out = []
  TOUCH_RE.lastIndex = 0
  for (const m of cmd.matchAll(TOUCH_RE)) {
    const targets = (m[1] ?? '').trim().split(/\s+/)
    for (const t of targets) {
      if (!t) continue
      out.push(t.replace(/^\.\//, ''))
    }
  }
  return out
}

const BUILD_CMD_RE = /\b(pnpm|npm|yarn|cargo|go|python|pytest|jest|vitest|tsc|forge|anchor)\b/
function isBuildCall(cmd) {
  return BUILD_CMD_RE.test(cmd)
}

function extractSessionEvents(entries, sessionId, sourcePath, projectSlug) {
  const slugParts = parseSlug(projectSlug)
  const addedPackages = []
  const addedDirs = []
  const addedFiles = []
  const rewrittenFiles = []
  let bashCalls = 0
  let buildCalls = 0
  const buildExitCodes = []
  const fileTargetsSeen = new Set()

  for (const e of entries) {
    if (e?.type !== 'assistant') continue
    const content = e?.message?.content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (part?.type !== 'tool_use') continue
      const name = part?.name
      const input = part?.input ?? {}
      if (name === 'Bash') {
        bashCalls++
        const cmd = typeof input.command === 'string' ? input.command : ''
        if (!cmd) continue
        if (isBuildCall(cmd)) buildCalls++
        for (const pkg of parsePackagesFromCmd(cmd)) {
          if (!addedPackages.some((x) => x.pm === pkg.pm && x.name === pkg.name)) {
            addedPackages.push(pkg)
          }
        }
        for (const dir of parseDirsFromCmd(cmd)) {
          if (!addedDirs.includes(dir)) addedDirs.push(dir)
        }
        for (const f of parseTouchedFromCmd(cmd)) {
          if (!fileTargetsSeen.has(f)) {
            fileTargetsSeen.add(f)
            addedFiles.push(f)
          }
        }
      } else if (name === 'Write') {
        const p = typeof input.file_path === 'string' ? input.file_path : null
        if (!p) continue
        if (!fileTargetsSeen.has(p)) {
          fileTargetsSeen.add(p)
          addedFiles.push(p)
        }
      } else if (name === 'Edit') {
        const p = typeof input.file_path === 'string' ? input.file_path : null
        if (!p) continue
        if (!rewrittenFiles.includes(p)) rewrittenFiles.push(p)
      }
    }
  }

  // Capture build exit codes (best-effort): scan tool_result messages for
  // typical "exit N" patterns. Not exhaustive — good enough to detect failure
  // clusters. Bounded for cost.
  for (let i = 0; i < entries.length && buildExitCodes.length < 40; i++) {
    const e = entries[i]
    if (e?.type !== 'user') continue
    const content = e?.message?.content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (part?.type !== 'tool_result') continue
      const body = typeof part.content === 'string'
        ? part.content
        : Array.isArray(part.content)
        ? part.content.map((x) => x?.text ?? '').join('')
        : ''
      const m = body.match(/exit code[:\s]+(\d+)/i) || body.match(/Error: .*?\(exit (\d+)\)/)
      if (m) buildExitCodes.push(Number.parseInt(m[1], 10) || 0)
    }
  }

  return {
    schemaVersion: BUILDOUT_SCHEMA_VERSION,
    sessionId,
    sourcePath,
    projectSlug,
    scenarioId: slugParts.scenarioId,
    partnerGuess: slugParts.partnerGuess,
    replayRound: slugParts.replayRound,
    firstTs: entries[0]?.timestamp ?? null,
    lastTs: entries[entries.length - 1]?.timestamp ?? null,
    totalEntries: entries.length,
    initialPrompt: findInitialPrompt(entries),
    addedPackages,
    addedDirs,
    addedFiles: addedFiles.slice(0, 200),
    rewrittenFiles: rewrittenFiles.slice(0, 200),
    bashCalls,
    buildCalls,
    buildExitCodes,
    outcome: null,
  }
}

function logError(sessionId, sourcePath, error) {
  const line =
    JSON.stringify({
      ts: new Date().toISOString(),
      sessionId,
      sourcePath,
      error: (error?.stack ?? String(error)).slice(0, 2000),
    }) + '\n'
  appendFileSync(DEFAULT_PATHS.errorsJsonl, line)
}

// ---- scan ----

const projectDirs = existsSync(projectsDir) ? readdirSync(projectsDir) : []

for (const projectSlug of projectDirs) {
  if (!isBuildoutSlug(projectSlug)) continue
  const projDir = join(projectsDir, projectSlug)
  let projStat
  try {
    projStat = statSync(projDir)
  } catch {
    continue
  }
  if (!projStat.isDirectory()) continue

  let sessionFiles = []
  try {
    sessionFiles = readdirSync(projDir).filter((n) => n.endsWith('.jsonl'))
  } catch (err) {
    logError(null, projDir, err)
    continue
  }

  for (const file of sessionFiles) {
    const sourcePath = join(projDir, file)
    const sessionId = file.replace(/\.jsonl$/, '')
    scanned++

    if (!forceAll && forceSession !== sessionId && state.poisoned[sessionId]) continue

    let fileStat
    try {
      fileStat = statSync(sourcePath)
    } catch (err) {
      logError(sessionId, sourcePath, err)
      continue
    }

    const prevMtime = state.mtimes[sessionId] ?? 0
    const prevCursor = state.cursors[sessionId] ?? -1
    // If the file hasn't changed since last scan AND we've processed all lines
    // we saw, skip. (We recount lines below; skip is based on mtime alone here.)
    if (!rebuild && !forceAll && forceSession !== sessionId && fileStat.mtimeMs <= prevMtime) continue

    try {
      const raw = readFileSync(sourcePath, 'utf8')
      const lines = raw.split('\n').filter((l) => l.length > 0)
      // We mine the full session (stateless extraction). The cursor is simply
      // "we fully processed up to line N" — so if totalLines > cursor we re-process.
      if (lines.length <= prevCursor + 1 && !forceAll && forceSession !== sessionId) {
        state.mtimes[sessionId] = fileStat.mtimeMs
        continue
      }
      const entries = []
      for (const line of lines) {
        const obj = tryParseJson(line)
        if (obj) entries.push(obj)
      }
      if (entries.length === 0) {
        state.mtimes[sessionId] = fileStat.mtimeMs
        state.cursors[sessionId] = lines.length - 1
        continue
      }
      const event = extractSessionEvents(entries, sessionId, sourcePath, projectSlug)
      appendFileSync(DEFAULT_PATHS.buildoutsJsonl, JSON.stringify(event) + '\n')
      newEvents++
      state.mtimes[sessionId] = fileStat.mtimeMs
      state.cursors[sessionId] = lines.length - 1
      delete state.poisoned[sessionId]
    } catch (err) {
      logError(sessionId, sourcePath, err)
      state.poisoned[sessionId] = {
        ts: new Date().toISOString(),
        error: String(err?.message ?? err).slice(0, 500),
      }
      poisonedAdded++
    }
  }
}

state.lastRun = {
  ts: new Date().toISOString(),
  sessionsScanned: scanned,
  newEvents,
  poisonedAdded,
  durationMs: performance.now() - t0,
}
writeFileSync(DEFAULT_PATHS.minerState, JSON.stringify(state, null, 2))

console.log(`scanned: ${scanned}`)
console.log(`new events: ${newEvents}`)
console.log(`poisoned this run: ${poisonedAdded}`)
console.log(`poisoned total: ${Object.keys(state.poisoned).length}`)
console.log(`duration: ${(state.lastRun.durationMs / 1000).toFixed(1)}s`)
console.log(`wrote: ${DEFAULT_PATHS.buildoutsJsonl}`)
