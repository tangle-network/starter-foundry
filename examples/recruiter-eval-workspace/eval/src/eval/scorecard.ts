// Scorecard emitter — writes scorecard.json in the shape consumed by the
// project-level dashboard (.evolve/scorecard.json).
//
// The shape is intentionally a subset of the parent-repo scorecard so a
// composed eval harness drops into an existing .evolve workflow without
// translation. Extra dashboard fields (sourceMtime, stale, etc.) are
// only relevant when the parent repo aggregates multiple inputs — for a
// standalone harness, the runner's outputs are the single source.
//
// Gen-16.1 (audit A1 + C3): `unmeasured` is now a first-class status.
// Aggregators MUST exclude unmeasured flows from the denominator and
// MUST emit `aggregate: null` (NOT 0) when nothing measurable ran. The
// parent refresh-scorecard.ts checks `aggregate` against null AND scans
// for unmeasured flows so a partial-measurement run surfaces transparently.

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export type FlowDirection = 'higher-better' | 'lower-better'
export type FlowStatus = 'pass' | 'fail' | 'skip' | 'unmeasured'

export interface ScorecardFlow {
  name: string
  /** Null when status is 'unmeasured' (no measurement, not a fake-zero).
   *  Numeric only for measured flows. */
  value: number | null
  target: number
  status: FlowStatus
  productValueClaim: string
  direction: FlowDirection
  notes?: string
}

export interface Scorecard {
  product: string
  timestamp: string
  /** Aggregate over MEASURED flows only. Null when zero flows measured. */
  aggregate: number | null
  /** Count of measured flows (denominator for `aggregate`). */
  measuredCount: number
  /** Count of flows whose status === 'unmeasured'. */
  unmeasuredCount: number
  coverage: string
  flows: ScorecardFlow[]
}

export async function writeScorecard(path: string, scorecard: Scorecard): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(scorecard, null, 2) + '\n', 'utf8')
}

export async function readScorecard(path: string): Promise<Scorecard> {
  const { readFile } = await import('node:fs/promises')
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw) as Scorecard
}

export interface ScorecardDiff {
  baseline: Scorecard
  head: Scorecard
  aggregateDelta: number | null
  perFlow: Array<{
    name: string
    baseline: number | null
    head: number | null
    delta: number | null
    status: 'improved' | 'regressed' | 'stable' | 'introduced' | 'removed' | 'unmeasured'
  }>
}

const STABILITY_EPSILON = 0.005

export function diffScorecards(baseline: Scorecard, head: Scorecard): ScorecardDiff {
  const baselineByName = new Map<string, ScorecardFlow>()
  for (const f of baseline.flows) baselineByName.set(f.name, f)
  const headByName = new Map<string, ScorecardFlow>()
  for (const f of head.flows) headByName.set(f.name, f)
  const allNames = new Set<string>([...baselineByName.keys(), ...headByName.keys()])
  const perFlow: ScorecardDiff['perFlow'] = []
  for (const name of allNames) {
    const b = baselineByName.get(name)
    const h = headByName.get(name)
    if (b && h) {
      // Either side unmeasured → delta is null and status is
      // 'unmeasured' so the dashboard treats it as a coverage gap, not
      // a regression.
      if (b.value === null || h.value === null) {
        perFlow.push({ name, baseline: b.value, head: h.value, delta: null, status: 'unmeasured' })
        continue
      }
      const delta = h.value - b.value
      let status: ScorecardDiff['perFlow'][number]['status'] = 'stable'
      if (Math.abs(delta) >= STABILITY_EPSILON) {
        const better = h.direction === 'higher-better' ? delta > 0 : delta < 0
        status = better ? 'improved' : 'regressed'
      }
      perFlow.push({ name, baseline: b.value, head: h.value, delta, status })
    } else if (b) {
      perFlow.push({ name, baseline: b.value, head: null, delta: null, status: 'removed' })
    } else if (h) {
      perFlow.push({ name, baseline: null, head: h.value, delta: null, status: 'introduced' })
    }
  }
  const aggregateDelta =
    baseline.aggregate === null || head.aggregate === null
      ? null
      : head.aggregate - baseline.aggregate
  return { baseline, head, aggregateDelta, perFlow }
}
