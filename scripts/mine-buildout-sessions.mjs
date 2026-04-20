#!/usr/bin/env node
// Miner stage: extracts buildout events from Claude Code factory-local session
// transcripts.
//
// Fault tolerance:
//   - Per-source mtime stored in .evolve/traces/.buildouts-miner-state.json.
//     Unchanged mtime → skip.
//   - A session that errors goes to `poisoned` and skips next run
//     (override with --force-retry <sessionId> or --force-all).
//   - Per-error log at .buildouts-errors.jsonl.
//   - Output JSONL is append-only. Schema version is embedded in each row.
//
// Usage:
//   node scripts/mine-buildout-sessions.mjs                      # incremental
//   node scripts/mine-buildout-sessions.mjs --projects-dir PATH  # custom source
//   node scripts/mine-buildout-sessions.mjs --rebuild            # start fresh
//   node scripts/mine-buildout-sessions.mjs --force-all          # retry poisoned

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

const SOURCE_MODEL = 'claude-code'

const argv = process.argv.slice(2)
function arg(k, fallback) {
  const i = argv.indexOf(k)
  return i >= 0 ? argv[i + 1] : fallback
}
const projectsDir = arg('--projects-dir', join(homedir(), '.claude', 'projects'))
const rebuild = argv.includes('--rebuild')
const forceAll = argv.includes('--force-all')
const forceSession = arg('--force-retry', null)

mkdirSync('.evolve/traces', { recursive: true })

if (rebuild) {
  rmSync(DEFAULT_PATHS.buildoutsJsonl, { force: true })
  rmSync(DEFAULT_PATHS.minerState, { force: true })
  rmSync(DEFAULT_PATHS.errorsJsonl, { force: true })
  console.log(`rebuild: cleared output + state`)
}

const state = existsSync(DEFAULT_PATHS.minerState)
  ? JSON.parse(readFileSync(DEFAULT_PATHS.minerState, 'utf8'))
  : emptyMinerState()

if (state.schemaVersion !== BUILDOUT_SCHEMA_VERSION) {
  console.log(`schema bump (${state.schemaVersion} → ${BUILDOUT_SCHEMA_VERSION}) — rebuilding`)
  rmSync(DEFAULT_PATHS.buildoutsJsonl, { force: true })
  rmSync(DEFAULT_PATHS.errorsJsonl, { force: true })
  Object.assign(state, emptyMinerState())
}

const t0 = performance.now()
let scanned = 0
let newEvents = 0
let poisonedAdded = 0

function tryParseJson(line) {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

/** First substantive user message — skip tool_result wrappers, /-commands, hooks. */
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

// Valid package name: letter/@ start, no shell operators.
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
        const clean = token.startsWith('@')
          ? token.split('@').slice(0, 2).join('@')
          : token.split('@')[0]
        if (!clean || clean.startsWith('.') || clean.length < 2) continue
        if (!VALID_PKG_NAME.test(clean)) continue
        out.push({ pm, name: clean })
      }
    }
  }
  return out
}

const MKDIR_RE = /\bmkdir\s+(?:-\w+\s+)*([^\n|;]+?)(?:\n|$|;|\|)/g

function parseDirsFromCmd(cmd) {
  const out = []
  MKDIR_RE.lastIndex = 0
  for (const m of cmd.matchAll(MKDIR_RE)) {
    for (const t of (m[1] ?? '').trim().split(/\s+/)) {
      if (!t || t.startsWith('-')) continue
      out.push(t.replace(/^\.\//, ''))
    }
  }
  return out
}

function extractEvent(entries, sessionId, sourcePath, projectSlug) {
  const slugParts = parseSlug(projectSlug)
  const addedPackages = []
  const addedDirs = []
  const rewrittenFiles = []
  const seenPkg = new Set()
  const seenDir = new Set()
  const seenFile = new Set()

  for (const e of entries) {
    if (e?.type !== 'assistant') continue
    const content = e?.message?.content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (part?.type !== 'tool_use') continue
      const input = part?.input ?? {}
      if (part.name === 'Bash') {
        const cmd = typeof input.command === 'string' ? input.command : ''
        if (!cmd) continue
        for (const pkg of parsePackagesFromCmd(cmd)) {
          const key = `${pkg.pm}:${pkg.name}`
          if (seenPkg.has(key)) continue
          seenPkg.add(key)
          addedPackages.push(pkg)
        }
        for (const dir of parseDirsFromCmd(cmd)) {
          if (seenDir.has(dir)) continue
          seenDir.add(dir)
          addedDirs.push(dir)
        }
      } else if (part.name === 'Edit') {
        const p = typeof input.file_path === 'string' ? input.file_path : null
        if (!p || seenFile.has(p)) continue
        seenFile.add(p)
        rewrittenFiles.push(p)
      }
    }
  }

  return {
    schemaVersion: BUILDOUT_SCHEMA_VERSION,
    sessionId,
    sourcePath,
    sourceModel: SOURCE_MODEL,
    scenarioId: slugParts.scenarioId,
    partnerGuess: slugParts.partnerGuess,
    replayRound: slugParts.replayRound,
    firstTs: entries[0]?.timestamp ?? null,
    lastTs: entries[entries.length - 1]?.timestamp ?? null,
    initialPrompt: findInitialPrompt(entries),
    addedPackages,
    addedDirs,
    rewrittenFiles: rewrittenFiles.slice(0, 200),
    outcome: null,
  }
}

function logError(sessionId, sourcePath, error) {
  appendFileSync(
    DEFAULT_PATHS.errorsJsonl,
    JSON.stringify({
      ts: new Date().toISOString(),
      sessionId,
      sourcePath,
      error: (error?.stack ?? String(error)).slice(0, 2000),
    }) + '\n',
  )
}

const projectDirs = existsSync(projectsDir) ? readdirSync(projectsDir) : []

for (const projectSlug of projectDirs) {
  if (!isBuildoutSlug(projectSlug)) continue
  const projDir = join(projectsDir, projectSlug)
  let stat
  try {
    stat = statSync(projDir)
  } catch {
    continue
  }
  if (!stat.isDirectory()) continue

  let sessionFiles
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
    if (!rebuild && !forceAll && forceSession !== sessionId && fileStat.mtimeMs <= prevMtime) continue

    try {
      const raw = readFileSync(sourcePath, 'utf8')
      const entries = raw
        .split('\n')
        .filter((l) => l.length > 0)
        .map(tryParseJson)
        .filter(Boolean)
      if (entries.length === 0) {
        state.mtimes[sessionId] = fileStat.mtimeMs
        continue
      }
      const event = extractEvent(entries, sessionId, sourcePath, projectSlug)
      appendFileSync(DEFAULT_PATHS.buildoutsJsonl, JSON.stringify(event) + '\n')
      newEvents++
      state.mtimes[sessionId] = fileStat.mtimeMs
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
