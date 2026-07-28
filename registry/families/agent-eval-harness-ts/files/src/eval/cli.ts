#!/usr/bin/env node
// eval-harness CLI — `eval-harness run | compare`.
//
// `run` invokes the full harness against the configured target.
// `compare` diffs two scorecards (no statistical gate — for that, use the
// regression layer's `eval:gate` CLI).

import { exitCodeForReport, runHarness } from './runner.js'
import { readScorecard, diffScorecards } from './scorecard.js'

function help(): never {
  console.log(`Usage:
  eval-harness run [--target <url>] [--threshold <0..1>] [--variant <id>]
  eval-harness compare <baseline.json> <head.json>
`)
  process.exit(2)
}

async function cmdRun(argv: string[]): Promise<void> {
  const arg = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i >= 0 && argv[i + 1] ? argv[i + 1] : undefined
  }
  const target = arg('--target')
  const thresholdRaw = arg('--threshold')
  const variantId = arg('--variant')
  const threshold = thresholdRaw !== undefined ? Number(thresholdRaw) : undefined
  if (thresholdRaw !== undefined && Number.isNaN(threshold)) {
    console.error(`eval-harness: --threshold must be a number, got "${thresholdRaw}"`)
    process.exit(2)
  }
  const report = await runHarness({ targetUrl: target, threshold, variantId })
  process.exitCode = exitCodeForReport(report)
}

async function cmdCompare(argv: string[]): Promise<void> {
  const [baselinePath, headPath] = argv
  if (!baselinePath || !headPath) help()
  const baseline = await readScorecard(baselinePath)
  const head = await readScorecard(headPath)
  const diff = diffScorecards(baseline, head)
  const baselineAggregate = baseline.aggregate?.toFixed(3) ?? 'unmeasured'
  const headAggregate = head.aggregate?.toFixed(3) ?? 'unmeasured'
  const delta =
    diff.aggregateDelta === null
      ? 'unmeasured'
      : `${diff.aggregateDelta >= 0 ? '+' : ''}${diff.aggregateDelta.toFixed(3)}`
  console.log(`aggregate ${baselineAggregate} -> ${headAggregate} (${delta})`)
  for (const f of diff.perFlow) {
    const b = f.baseline?.toFixed(3) ?? '—'
    const h = f.head?.toFixed(3) ?? '—'
    const d = f.delta !== null ? `${f.delta >= 0 ? '+' : ''}${f.delta.toFixed(3)}` : ''
    const tag = f.status.padEnd(10, ' ')
    console.log(`  ${tag} ${f.name}: ${b} → ${h} ${d}`)
  }
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2)
  if (cmd === 'run') return cmdRun(rest)
  if (cmd === 'compare') return cmdCompare(rest)
  help()
}

main().catch((err) => {
  console.error('[eval-harness] fatal:', err)
  process.exit(2)
})
