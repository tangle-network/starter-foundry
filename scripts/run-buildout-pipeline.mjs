#!/usr/bin/env node
// Orchestrator: one command that runs the whole buildout pipeline end-to-end
// with fault tolerance. Each stage failing is logged but doesn't abort the
// next — because a stale analysis from yesterday is strictly better than no
// analysis after a mid-pipeline crash.
//
// Usage:
//   node scripts/run-buildout-pipeline.mjs                # normal incremental
//   node scripts/run-buildout-pipeline.mjs --rebuild      # full rebuild
//   node scripts/run-buildout-pipeline.mjs --projects-dir PATH

import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'

const argv = process.argv.slice(2)

const STAGES = [
  { name: 'mine', script: 'scripts/mine-buildout-sessions.mjs' },
  { name: 'join', script: 'scripts/join-buildout-outcomes.mjs' },
  { name: 'analyze', script: 'scripts/analyze-buildouts.mjs' },
]

const results = []
const t0 = performance.now()

for (const stage of STAGES) {
  const t = performance.now()
  console.log(`\n━━━━ stage: ${stage.name} ━━━━`)
  const r = spawnSync(process.execPath, [stage.script, ...argv], {
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
  console.log(`  ${mark} ${r.stage.padEnd(10)} ${(r.durationMs / 1000).toFixed(1)}s${r.ok ? '' : `  (exit ${r.exitCode})`}`)
}
console.log(`  total                ${(totalDur / 1000).toFixed(1)}s`)

// Overall exit: 0 if at least one stage produced useful output (mine+join done).
// We DON'T fail hard on analyze failure since the data is preserved for retry.
const mineOk = results.find((r) => r.stage === 'mine')?.ok
const joinOk = results.find((r) => r.stage === 'join')?.ok
process.exit(mineOk && joinOk ? 0 : 1)
