#!/usr/bin/env node
// Gen-3 measurement-freshness: unified orchestrator that keeps the scorecard
// in sync with .evolve/traces/buildouts.jsonl. Runs only the stages whose
// outputs are older than their inputs — idempotent, fast (<1s when clean).
//
// Stages (in dependency order):
//   1. analyze-buildouts: traces → .evolve/buildout-analysis.json
//   2. infer-capability-gaps: traces → .evolve/capability-gaps.json
//   3. replay-traces: traces + registry → .evolve/buildout-analysis-internal.json
//   4. refresh-scorecard: above → .evolve/scorecard.json
//
// Usage:
//   node scripts/measure-refresh.ts           # run what's stale, emit summary
//   node scripts/measure-refresh.ts --dry-run # report drift only, don't write
//   node scripts/measure-refresh.ts --force   # rerun all stages regardless
//
// Exit codes:
//   0 — everything fresh (either already or after regen)
//   1 — regen attempted but drift remains (e.g. traces file missing)
//   2 — --dry-run detected drift (only when --dry-run)

import { existsSync, statSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(SCRIPT_DIR, '..')

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const FORCE = argv.includes('--force')
const QUIET = argv.includes('--quiet')

const SOURCE = join(REPO, '.evolve/traces/buildouts.jsonl')

// Stage definition: what input, what output, which script, whether we always re-run.
// Order matters — later stages may read outputs of earlier ones.
const STAGES = [
  {
    name: 'analyze-buildouts',
    script: 'scripts/analyze-buildouts.ts',
    output: '.evolve/buildout-analysis.json',
    // Input is the traces source. If source newer than output → stale.
    input: SOURCE,
    always: false,
  },
  {
    name: 'infer-capability-gaps',
    script: 'scripts/infer-capability-gaps.ts',
    output: '.evolve/capability-gaps.json',
    input: SOURCE,
    always: false,
  },
  {
    name: 'replay-traces',
    script: 'scripts/replay-traces.ts',
    output: '.evolve/buildout-analysis-internal.json',
    // Replay reads traces AND registry (dynamic). Registry changes on most
    // edits — any modification under registry/ invalidates the output.
    input: SOURCE,
    always: false,
    alsoWatch: 'registry',
  },
  {
    name: 'refresh-scorecard',
    script: 'scripts/refresh-scorecard.ts',
    output: '.evolve/scorecard.json',
    // Scorecard reads multiple analysis files. Re-run if ANY is newer than it.
    inputs: [
      '.evolve/buildout-analysis.json',
      '.evolve/capability-gaps.json',
      '.evolve/scaffold-quality-audit.json',
      '.evolve/buildout-analysis-internal.json',
    ],
    always: false,
  },
]

function mtimeOf(path) {
  try {
    return existsSync(path) ? statSync(path).mtime.getTime() : 0
  } catch {
    return 0
  }
}

// Returns the newest mtime across a directory tree. Used for registry/ which
// has many files; any change to any manifest invalidates replay-traces.
function maxMtimeInDir(dirPath) {
  try {
    const r = spawnSync('find', [dirPath, '-type', 'f', '-newer', '/dev/null', '-printf', '%T@\n'], {
      encoding: 'utf8',
    })
    if (r.status !== 0 || !r.stdout.trim()) {
      // BSD find (macOS) doesn't have -printf; fall back to node-level traversal.
      return maxMtimeNodeFallback(dirPath)
    }
    const times = r.stdout.trim().split('\n').map((x) => Number.parseFloat(x) * 1000)
    return Math.max(...times, 0)
  } catch {
    return maxMtimeNodeFallback(dirPath)
  }
}

function maxMtimeNodeFallback(dirPath) {
  // Cheap node-level traversal — registry is ~300 files.
  const r = spawnSync('find', [dirPath, '-type', 'f', '-name', '*.json'], { encoding: 'utf8' })
  if (r.status !== 0) return 0
  let max = 0
  for (const f of r.stdout.trim().split('\n').filter(Boolean)) {
    try {
      const t = statSync(f).mtime.getTime()
      if (t > max) max = t
    } catch { /* noop */ }
  }
  return max
}

function isStale(stage) {
  if (FORCE) return true
  const outPath = join(REPO, stage.output)
  if (!existsSync(outPath)) return true // never built → definitely stale
  const outMtime = mtimeOf(outPath)

  if (stage.inputs) {
    // refresh-scorecard: re-run if any input is newer than output.
    return stage.inputs.some((p) => mtimeOf(join(REPO, p)) > outMtime)
  }

  const inMtime = mtimeOf(stage.input)
  if (inMtime === 0) {
    // Source doesn't exist — can't regen. Treat as not-stale (preserves
    // existing output). Caller's concern, not ours.
    return false
  }
  if (inMtime > outMtime) return true

  if (stage.alsoWatch) {
    const dirMtime = maxMtimeInDir(join(REPO, stage.alsoWatch))
    if (dirMtime > outMtime) return true
  }
  return false
}

function runStage(stage) {
  const scriptPath = join(REPO, stage.script)
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [scriptPath], {
    cwd: REPO,
    env: {
      ...process.env,
      // Self-heal MUST NOT re-enter via refresh-scorecard while we're running
      // this orchestrator — prevents infinite loops when refresh-scorecard's
      // own self-heal logic triggers.
      STARTER_FOUNDRY_NO_SELF_HEAL: '1',
    },
    stdio: QUIET ? 'pipe' : 'inherit',
    encoding: 'utf8',
  })
  const durationMs = Date.now() - t0
  return { ok: r.status === 0, exitCode: r.status, durationMs, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

function fmtAge(path) {
  const m = mtimeOf(path)
  if (m === 0) return '(missing)'
  const ageMs = Date.now() - m
  if (ageMs < 60_000) return `${(ageMs / 1000).toFixed(0)}s ago`
  if (ageMs < 3_600_000) return `${(ageMs / 60_000).toFixed(0)}m ago`
  return `${(ageMs / 3_600_000).toFixed(1)}h ago`
}

function summary(preDrift, results) {
  console.log('\n━━━━ measure-refresh summary ━━━━')
  console.log(`  source:    .evolve/traces/buildouts.jsonl  (${fmtAge(SOURCE)})`)
  for (const s of STAGES) {
    const res = results.find((r) => r.stage === s.name)
    const outPath = join(REPO, s.output)
    if (res) {
      const mark = res.ok ? '✓' : '✗'
      console.log(`  ${mark} ${s.name.padEnd(22)} ${(res.durationMs / 1000).toFixed(2)}s  → ${s.output}`)
    } else {
      console.log(`  · ${s.name.padEnd(22)} (already fresh)      → ${s.output} (${fmtAge(outPath)})`)
    }
  }
  const stalePre = preDrift.filter(Boolean).length
  if (stalePre === 0) console.log(`  status: clean — all outputs fresh relative to source`)
  else if (results.some((r) => !r.ok)) console.log(`  status: FAILED — ${results.filter((r) => !r.ok).map((r) => r.stage).join(', ')}`)
  else console.log(`  status: regenerated ${stalePre} stale stage${stalePre === 1 ? '' : 's'}`)
}

// Main
const preDrift = STAGES.map(isStale)
const staleStages = STAGES.filter((_, i) => preDrift[i])

if (DRY_RUN) {
  if (staleStages.length === 0) {
    console.log('clean — all measurements fresh')
    process.exit(0)
  }
  console.log(`drift detected in ${staleStages.length} stage(s):`)
  for (const s of staleStages) console.log(`  - ${s.name} (${s.output})`)
  process.exit(2)
}

if (staleStages.length === 0 && !FORCE) {
  if (!QUIET) console.log('measure-refresh: already fresh')
  process.exit(0)
}

const results = []
for (const stage of staleStages) {
  const res = runStage(stage)
  results.push({ stage: stage.name, ...res })
  if (!res.ok) {
    // Keep going — a failing stage shouldn't block later-but-independent ones
    // (e.g., analyze-buildouts failing shouldn't stop replay-traces).
    if (!QUIET) console.error(`! ${stage.name} exit ${res.exitCode} — continuing`)
  }
}

summary(preDrift, results)

// Verify post-condition: after running, nothing should still be stale (unless
// source file is gone, which is caller's problem).
const postDrift = STAGES.filter((s) => s.input === SOURCE).map(isStale)
const remaining = postDrift.filter(Boolean).length
if (remaining > 0 && !QUIET) {
  console.error(`\nwarning: ${remaining} stage(s) still stale after regen — investigate.`)
}

process.exit(results.every((r) => r.ok) ? 0 : 1)
