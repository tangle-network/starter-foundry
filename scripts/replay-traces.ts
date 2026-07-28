#!/usr/bin/env node
// Counterfactual replay driver — runs the captured buildout corpus against the
// current registry, prints a one-screen summary, and writes a VB-compatible
// report to .evolve/buildout-analysis-internal.json.
//
// Usage:
//   node scripts/replay-traces.ts                      # full corpus
//   node scripts/replay-traces.ts --limit 50           # first 50 traces
//   node scripts/replay-traces.ts --scenario <id>      # filter by scenarioId
//
// Typical runtime: ~3-5s for the ~220-trace corpus. Zero LLM calls.

import fs from 'node:fs/promises'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const TRACES_DIR = path.join(ROOT, '.evolve', 'traces')
const OUT_PATH = path.join(ROOT, '.evolve', 'buildout-analysis-internal.json')

function parseArgs(argv) {
  const args = { limit: Infinity, scenario: null }
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i]
    if (v === '--limit') args.limit = Number(argv[++i])
    else if (v === '--scenario') args.scenario = argv[++i]
  }
  return args
}

function pad(n, w = 3) {
  return String(n).padStart(w)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  // Dynamic import so this script still runs if dist is fresh.
  const { loadTraces, replayTrace, buildReport } = await import(
    path.join(ROOT, 'dist', 'eval', 'replay.js')
  )

  const commit = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim()

  process.stdout.write(`Loading captured traces from ${path.relative(ROOT, TRACES_DIR)}... `)
  let traces = await loadTraces(TRACES_DIR)
  process.stdout.write(`${traces.length} loaded\n`)

  if (args.scenario) traces = traces.filter((t) => t.scenarioId === args.scenario)
  if (traces.length > args.limit) traces = traces.slice(0, args.limit)

  process.stdout.write(`Replaying ${traces.length} traces against registry @ ${commit}...\n`)
  const started = Date.now()
  const results = []
  let i = 0
  for (const trace of traces) {
    i += 1
    try {
      const r = await replayTrace(trace)
      results.push(r)
    } catch (err) {
      process.stderr.write(
        `[trace ${i}/${traces.length}] ${trace.scenarioId}: ${err?.message ?? err}\n`,
      )
    }
    if (i % 25 === 0) process.stdout.write(`  ${i}/${traces.length}\n`)
  }
  const elapsed = Date.now() - started
  process.stdout.write(`Done in ${(elapsed / 1000).toFixed(2)}s\n\n`)

  const report = buildReport(results, commit)
  await fs.writeFile(OUT_PATH, JSON.stringify(report, null, 2))
  process.stdout.write(`Wrote ${path.relative(ROOT, OUT_PATH)}\n\n`)

  const s = report.summary
  process.stdout.write(`=== summary ===\n`)
  process.stdout.write(
    `  buildouts: ${s.totalBuildouts}  withOutcome: ${s.withOutcome}  distinctScenarios: ${s.distinctScenarios}\n`,
  )
  process.stdout.write(
    `  passRate: ${(s.passRate * 100).toFixed(1)}%  meanScore: ${s.meanBlendedScore.toFixed(3)}\n`,
  )
  process.stdout.write(`\n`)
  process.stdout.write(`=== install prevention (the scorecard move) ===\n`)
  process.stdout.write(`  historical agent installs:  ${pad(s.totalHistoricalInstalls, 4)}\n`)
  process.stdout.write(
    `  prevented by current regs:  ${pad(s.totalPreventedInstalls, 4)}  (${(s.preventionRate * 100).toFixed(1)}%)\n`,
  )
  process.stdout.write(`  remaining gap installs:     ${pad(s.totalRemainingGapInstalls, 4)}\n`)
  process.stdout.write(
    `  gap installs per buildout:  ${s.estimatedGapInstallsPerBuildout.toFixed(2)}\n`,
  )
  process.stdout.write(`\n`)
  process.stdout.write(`=== top 10 remaining gaps (intervention targets) ===\n`)
  for (const g of report.topRemainingGapInstalls.slice(0, 10)) {
    process.stdout.write(
      `  ${pad(g.timesRemaining)}×  ${g.key}  (pass ${g.remainingOnPass} / fail ${g.remainingOnFail})\n`,
    )
  }
  if (report.topPreventedInstalls.length > 0) {
    process.stdout.write(`\n=== top 10 prevented (R-round wins) ===\n`)
    for (const p of report.topPreventedInstalls.slice(0, 10)) {
      process.stdout.write(`  ${pad(p.timesPrevented)}×  ${p.key}\n`)
    }
  }
  process.stdout.write(`\n`)
}

main().catch((err) => {
  process.stderr.write(`replay-traces failed: ${err?.stack ?? err}\n`)
  process.exit(1)
})
