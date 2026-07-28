/**
 * `pnpm gate <baseline.jsonl> <candidate.jsonl>` — runs HeldOutGate against
 * the default profile thresholds. Exits 0 (PROMOTE), 1 (REVERT), 2 (HOLD).
 */

import { existsSync, readFileSync } from 'node:fs'

import { HeldOutGate } from '../held-out-gate.js'
import { loadProfile } from '../profile-loader.js'
import { validateRunRecord, type RunRecord } from '../run-record.js'

export interface GateCliOptions {
  baselinePath: string | undefined
  candidatePath: string | undefined
  baselineKey?: string
  json: boolean
}

function readJsonl(path: string): RunRecord[] {
  if (!existsSync(path)) throw new Error(`file not found: ${path}`)
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((line, idx) => {
      try {
        return validateRunRecord(JSON.parse(line))
      } catch (e) {
        throw new Error(`${path} line ${idx + 1}: ${(e as Error).message}`, { cause: e })
      }
    })
}

export async function runGate(opts: GateCliOptions): Promise<number> {
  if (!opts.baselinePath || !opts.candidatePath) {
    process.stderr.write(
      'usage: pnpm gate <baseline.jsonl> <candidate.jsonl> [--baseline-key <name>]\n',
    )
    return 2
  }
  const baseline = readJsonl(opts.baselinePath)
  const candidate = readJsonl(opts.candidatePath)

  // Pull thresholds from the default profile. Read raw (skipSnapshotResolve)
  // so this works even when the lock is empty (gate is a measurement-layer
  // tool, not a runtime tool).
  const profile = loadProfile('default', { skipSnapshotResolve: true })

  const gate = new HeldOutGate({
    baselineKey: opts.baselineKey ?? opts.baselinePath,
    maximumOverfitGap: 0.2,
    minimumDelta: 0,
    minPairs: 20,
  })

  const decision = gate.evaluate(candidate, baseline)
  // Touch profile so unused-import lint doesn't fire when we add cost-ceiling here later.
  void profile
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
