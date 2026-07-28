#!/usr/bin/env node
// Orchestrator: one command that runs the whole buildout pipeline end-to-end
// with fault tolerance. Each stage failing is logged but doesn't abort the
// next — because a stale analysis from yesterday is strictly better than no
// analysis after a mid-pipeline crash.
//
// Usage:
//   node scripts/run-buildout-pipeline.ts                # normal incremental
//   node scripts/run-buildout-pipeline.ts --rebuild      # full rebuild
//   node scripts/run-buildout-pipeline.ts --projects-dir PATH

import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const argv = process.argv.slice(2)

// Resolve stage scripts relative to THIS file, not cwd. Lets the orchestrator
// be invoked from any working directory (tests, CI, a user's repo clone).
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const STAGES = [
  { name: 'mine', script: join(SCRIPT_DIR, 'mine-buildout-sessions.ts') },
  { name: 'join', script: join(SCRIPT_DIR, 'join-buildout-outcomes.ts') },
  { name: 'analyze', script: join(SCRIPT_DIR, 'analyze-buildouts.ts') },
]
const TSX = join(SCRIPT_DIR, '..', 'node_modules/.bin/tsx')

const results = []
const t0 = performance.now()

for (const stage of STAGES) {
  const t = performance.now()
  console.log(`\n━━━━ stage: ${stage.name} ━━━━`)
  const r = spawnSync(TSX, [stage.script, ...argv], {
    stdio: 'inherit',
    env: { ...process.env },
  })
  const durationMs = performance.now() - t
  const ok = r.status === 0
  results.push({ stage: stage.name, ok, exitCode: r.status, durationMs })
  if (!ok) {
    console.error(`! stage ${stage.name} failed with exit ${r.status} — continuing to next stage`)
  }
}

const totalDur = performance.now() - t0
console.log('\n━━━━ pipeline summary ━━━━')
for (const r of results) {
  const mark = r.ok ? '✓' : '✗'
  console.log(
    `  ${mark} ${r.stage.padEnd(10)} ${(r.durationMs / 1000).toFixed(1)}s${r.ok ? '' : `  (exit ${r.exitCode})`}`,
  )
}
console.log(`  total                ${(totalDur / 1000).toFixed(1)}s`)

// Overall exit: 0 if at least one stage produced useful output (mine+join done).
// We DON'T fail hard on analyze failure since the data is preserved for retry.
const mineOk = results.find((r) => r.stage === 'mine')?.ok
const joinOk = results.find((r) => r.stage === 'join')?.ok
process.exit(mineOk && joinOk ? 0 : 1)
