// scoring — multi-dimensional aggregation + radar adapter.
//
// Convention: every dimension is normalised to [0..1] for plotting. Dimensions
// where lower-is-better (latencyP95Ms, costUsd) are inverted at radar-build
// time so the chart's "outer = good" visual reads correctly.

import type { AgentEvalTrace } from './traces'

export interface ScoreDimensions {
  correctness: number
  helpfulness: number
  structural: number
  build: number
  runtime: number
  latencyP95: number
  costUsd: number
  /** Free-form extra dimensions, e.g. "tone" or "safety". */
  [k: string]: number
}

const ZERO_SCORES: ScoreDimensions = {
  correctness: 0,
  helpfulness: 0,
  structural: 0,
  build: 0,
  runtime: 0,
  latencyP95: 0,
  costUsd: 0,
}

const KNOWN_DIMS = ['correctness', 'helpfulness', 'structural', 'build', 'runtime', 'meta', 'runtimePassRate'] as const
const LOWER_IS_BETTER = new Set(['latencyP95', 'costUsd'])

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

/**
 * Element-wise mean across a list of traces. Missing dimensions on individual
 * traces are skipped (not treated as zero) so a single zero-coverage trace
 * doesn't drag a healthy aggregate down.
 */
export function aggregateScores(traces: AgentEvalTrace[]): ScoreDimensions {
  if (traces.length === 0) return { ...ZERO_SCORES }
  const sums: Record<string, { sum: number; count: number }> = {}
  for (const t of traces) {
    for (const [k, v] of Object.entries(t.scores)) {
      if (!Number.isFinite(v)) continue
      if (!sums[k]) sums[k] = { sum: 0, count: 0 }
      sums[k]!.sum += v
      sums[k]!.count += 1
    }
  }
  const out: ScoreDimensions = { ...ZERO_SCORES }
  for (const [k, { sum, count }] of Object.entries(sums)) {
    out[k] = count === 0 ? 0 : sum / count
  }
  return out
}

/**
 * Per-trace deltas: { dim: { a, b, delta, winner } }. Winner is the trace id
 * whose score is preferable on that dimension (handles lower-is-better dims).
 * Used by RunDiff.
 */
export function diffScores(
  a: AgentEvalTrace,
  b: AgentEvalTrace,
): Record<string, { a: number; b: number; delta: number; winner: 'a' | 'b' | 'tie' }> {
  const out: Record<string, { a: number; b: number; delta: number; winner: 'a' | 'b' | 'tie' }> = {}
  const dims = new Set([...Object.keys(a.scores), ...Object.keys(b.scores)])
  for (const dim of dims) {
    const av = a.scores[dim] ?? 0
    const bv = b.scores[dim] ?? 0
    const lowerBetter = LOWER_IS_BETTER.has(dim)
    let winner: 'a' | 'b' | 'tie' = 'tie'
    if (av !== bv) {
      if (lowerBetter) winner = av < bv ? 'a' : 'b'
      else winner = av > bv ? 'a' : 'b'
    }
    out[dim] = { a: av, b: bv, delta: bv - av, winner }
  }
  return out
}

/**
 * Adapter for recharts RadarChart. Inverts lower-is-better dimensions so
 * outward = good across the whole chart. Latency is normalised against a
 * configurable budget; cost is normalised against a budget too. Tweak
 * thresholds via the second arg if your domain has different ones.
 */
export function radarData(
  scores: Record<string, number>,
  thresholds: { latencyP95BudgetMs?: number; costBudgetUsd?: number } = {},
): Array<{ dim: string; value: number; raw: number }> {
  const latencyBudget = thresholds.latencyP95BudgetMs ?? 30_000
  const costBudget = thresholds.costBudgetUsd ?? 1
  const dims = new Set<string>([...KNOWN_DIMS, ...Object.keys(scores)])
  const rows: Array<{ dim: string; value: number; raw: number }> = []
  for (const dim of dims) {
    const raw = scores[dim] ?? 0
    let value: number
    if (dim === 'latencyP95') {
      value = clamp01(1 - raw / latencyBudget)
    } else if (dim === 'costUsd') {
      value = clamp01(1 - raw / costBudget)
    } else {
      value = clamp01(raw)
    }
    rows.push({ dim, value, raw })
  }
  return rows
}

/** Pretty-format a score for table display. Latency in ms, cost in USD, the rest as percent. */
export function formatScore(dim: string, raw: number): string {
  if (!Number.isFinite(raw)) return '—'
  if (dim === 'latencyP95') return `${Math.round(raw)} ms`
  if (dim === 'costUsd') return `$${raw.toFixed(4)}`
  return `${(raw * 100).toFixed(1)}%`
}
