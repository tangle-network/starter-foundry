/**
 * `pnpm gate <baseline.jsonl> <candidate.jsonl>` — runs HeldOutGate against
 * the default profile thresholds. Exits 0 (PROMOTE), 1 (REVERT), 2 (HOLD).
 */

import { existsSync } from 'node:fs'

import { HeldOutGate } from '../held-out-gate.js'
import { readRunRecords } from '../run-record-store.js'

export interface GateCliOptions {
  baselinePath: string | undefined
  candidatePath: string | undefined
  baselineKey?: string
  json: boolean
}

export function runGate(opts: GateCliOptions): number {
  if (!opts.baselinePath || !opts.candidatePath) {
    process.stderr.write(
      'usage: pnpm gate <baseline.jsonl> <candidate.jsonl> [--baseline-key <name>]\n',
    )
    return 2
  }
  if (!existsSync(opts.baselinePath)) throw new Error(`file not found: ${opts.baselinePath}`)
  if (!existsSync(opts.candidatePath)) throw new Error(`file not found: ${opts.candidatePath}`)
  const baseline = readRunRecords(opts.baselinePath)
  const candidate = readRunRecords(opts.candidatePath)

  const gate = new HeldOutGate({
    baselineKey: opts.baselineKey ?? opts.baselinePath,
    overfitGapThreshold: 0.2,
    pairedDeltaThreshold: 0,
    minProductiveRuns: 20,
    seed: 0,
  })

  const decision = gate.evaluate(candidate, baseline)
  if (opts.json) {
    process.stdout.write(JSON.stringify(decision, null, 2) + '\n')
  } else {
    process.stdout.write(`verdict: ${decision.verdict}\n`)
    process.stdout.write(`reason:  ${decision.reason}\n`)
    process.stderr.write(JSON.stringify(decision.evidence, null, 2) + '\n')
  }

  if (decision.verdict === 'PROMOTE') return 0
  if (decision.verdict === 'REVERT') return 1
  return 2
}
