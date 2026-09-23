import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export type FlowDirection = 'higher-better' | 'lower-better'
export type FlowStatus = 'pass' | 'fail' | 'skip'

export interface ScorecardFlow {
  name: string
  value: number
  target: number
  status: FlowStatus
  productValueClaim: string
  direction: FlowDirection
}

export interface Scorecard {
  product: string
  timestamp: string
  aggregate: number
  coverage: string
  flows: ScorecardFlow[]
}

export async function writeScorecard(path: string, scorecard: Scorecard): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(scorecard, null, 2)}\n`, 'utf8')
}

export async function readScorecard(path: string): Promise<Scorecard> {
  return JSON.parse(await readFile(path, 'utf8')) as Scorecard
}

export interface ScorecardDiff {
  baseline: Scorecard
  head: Scorecard
  aggregateDelta: number
  perFlow: Array<{
    name: string
    baseline: number | null
    head: number | null
    delta: number | null
    status: 'improved' | 'regressed' | 'stable' | 'introduced' | 'removed'
  }>
}

const STABILITY_EPSILON = 0.005

export function diffScorecards(baseline: Scorecard, head: Scorecard): ScorecardDiff {
  const baselineByName = new Map(baseline.flows.map((flow) => [flow.name, flow]))
  const headByName = new Map(head.flows.map((flow) => [flow.name, flow]))
  const allNames = new Set([...baselineByName.keys(), ...headByName.keys()])
  const perFlow: ScorecardDiff['perFlow'] = []

  for (const name of allNames) {
    const baselineFlow = baselineByName.get(name)
    const headFlow = headByName.get(name)
    if (baselineFlow && headFlow) {
      const delta = headFlow.value - baselineFlow.value
      let status: ScorecardDiff['perFlow'][number]['status'] = 'stable'
      if (Math.abs(delta) >= STABILITY_EPSILON) {
        const improved = headFlow.direction === 'higher-better' ? delta > 0 : delta < 0
        status = improved ? 'improved' : 'regressed'
      }
      perFlow.push({
        name,
        baseline: baselineFlow.value,
        head: headFlow.value,
        delta,
        status,
      })
    } else if (baselineFlow) {
      perFlow.push({
        name,
        baseline: baselineFlow.value,
        head: null,
        delta: null,
        status: 'removed',
      })
    } else if (headFlow) {
      perFlow.push({
        name,
        baseline: null,
        head: headFlow.value,
        delta: null,
        status: 'introduced',
      })
    }
  }

  return {
    baseline,
    head,
    aggregateDelta: head.aggregate - baseline.aggregate,
    perFlow,
  }
}
