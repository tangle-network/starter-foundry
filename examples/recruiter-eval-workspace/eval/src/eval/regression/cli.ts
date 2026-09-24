#!/usr/bin/env node
// eval-regression-gate <baseline.json> <head.json>
//
// Exit codes:
//   0 = PROMOTE  (head is stable or improved)
//   1 = REVERT   (head has BH-significant regressions)
//   2 = HOLD     (regressions present but not significant, or unstable)

import { readScorecard } from '../scorecard.js'
import { gate, GATE_EXIT } from './gate.js'

function help(): never {
  console.log(`Usage:
  eval-regression-gate <baseline.json> <head.json> [--alpha 0.05] [--fdr 0.1]
                       [--effect 0.5] [--only flow-a,flow-b]
                       [--report report.json]

Exit codes:
  0  PROMOTE
  1  REVERT
  2  HOLD
`)
  process.exit(2)
}

interface ParsedArgs {
  baseline: string
  head: string
  alpha: number
  fdr: number
  effectThreshold: number
  onlyFlows?: ReadonlySet<string>
  reportPath?: string
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = []
  let alpha = 0.05
  let fdr = 0.1
  let effectThreshold = 0.5
  let onlyFlows: ReadonlySet<string> | undefined
  let reportPath: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--alpha') alpha = Number(argv[++i])
    else if (a === '--fdr') fdr = Number(argv[++i])
    else if (a === '--effect') effectThreshold = Number(argv[++i])
    else if (a === '--only') onlyFlows = new Set(argv[++i]!.split(','))
    else if (a === '--report') reportPath = argv[++i]
    else if (a === '-h' || a === '--help') help()
    else positional.push(a)
  }
  if (positional.length < 2) help()
  if (Number.isNaN(alpha) || Number.isNaN(fdr) || Number.isNaN(effectThreshold)) {
    console.error('eval-regression-gate: numeric arg parse failed')
    process.exit(2)
  }
  return {
    baseline: positional[0]!,
    head: positional[1]!,
    alpha,
    fdr,
    effectThreshold,
    onlyFlows,
    reportPath,
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const baseline = await readScorecard(args.baseline)
  const head = await readScorecard(args.head)
  const report = gate(baseline, head, {
    alpha: args.alpha,
    fdr: args.fdr,
    effectThreshold: args.effectThreshold,
    onlyFlows: args.onlyFlows,
  })
  console.log(`verdict: ${report.verdict}`)
  console.log(`reason:  ${report.reason}`)
  console.log(`alpha=${report.alpha} fdr=${report.fdr}`)
  console.log('')
  for (const f of report.perFlow) {
    const sig = f.bhSignificant ? ' (BH-sig)' : ''
    const ci =
      f.bootstrap !== null
        ? ` ci=[${f.bootstrap.ciLower.toFixed(3)},${f.bootstrap.ciUpper.toFixed(3)}]`
        : ''
    const p = f.welch !== null ? ` p=${f.welch.p.toFixed(4)}` : ''
    console.log(
      `  [${f.verdict.padEnd(12, ' ')}] ${f.flow}: ${f.baseline.toFixed(3)} → ${f.head.toFixed(3)} (Δ${f.delta >= 0 ? '+' : ''}${f.delta.toFixed(3)})${ci}${p}${sig}`,
    )
  }
  if (args.reportPath) {
    const { writeFile, mkdir } = await import('node:fs/promises')
    const { dirname } = await import('node:path')
    await mkdir(dirname(args.reportPath), { recursive: true })
    await writeFile(args.reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8')
  }
  process.exit(GATE_EXIT[report.verdict])
}

main().catch((err) => {
  console.error('[eval-regression-gate] fatal:', err)
  process.exit(2)
})
