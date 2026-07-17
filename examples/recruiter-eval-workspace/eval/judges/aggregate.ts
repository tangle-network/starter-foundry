// Judge-score aggregator — the contract every JudgeFn caller must use.
//
// Why this exists: a JudgeScore can be MEASURED (numeric score 0..1) or
// UNMEASURED (status: 'unmeasured', score: NaN). Naively averaging
// unmeasured signals as 0 is the muffled-gate measurement-layer bug
// fixed in Gen-16.1 (audit finding A1). Every aggregation site MUST
// route through this helper, which:
//
//   - filters NaN / status:'unmeasured' BEFORE counting,
//   - returns null when zero scores remain (no measurement, not a 0 mean),
//   - reports `measuredCount` so callers can surface
//     `unmeasured` vs `measured but failing` distinctly.
//
// See .evolve/patterns/muffled-gate.md §"Measurement-layer variant".

import type { JudgeScore } from '@tangle-network/agent-eval'

/**
 * Discriminated extension of {@link JudgeScore}. The published type from
 * `@tangle-network/agent-eval` does not yet carry `status`; we declare it
 * as an optional field via type augmentation so judges can opt into the
 * unmeasured contract without breaking the published surface.
 *
 * The convention:
 *   - `status: 'measured'` (or absent) + finite `score` → counted.
 *   - `status: 'unmeasured'` + `score: NaN` → excluded from any aggregate.
 */
export type JudgeStatus = 'measured' | 'unmeasured'

export interface ExtendedJudgeScore extends JudgeScore {
  status?: JudgeStatus
}

export interface AggregateResult {
  /** Mean of measured scores; null when nothing was measured. */
  mean: number | null
  /** Count of finite, measured scores included in `mean`. */
  measuredCount: number
  /** Count of `unmeasured` scores seen and excluded. */
  unmeasuredCount: number
  /** Total scores presented (measured + unmeasured). */
  total: number
}

/**
 * Aggregate a flat list of judge scores. Treats NaN OR status='unmeasured'
 * as unmeasured (excluded from mean + denominator). When every score is
 * unmeasured, returns `{ mean: null, ... }` — never a fake 0.
 */
export function aggregateJudgeScores(scores: ExtendedJudgeScore[]): AggregateResult {
  let sum = 0
  let measuredCount = 0
  let unmeasuredCount = 0
  for (const s of scores) {
    if (s.status === 'unmeasured' || !Number.isFinite(s.score)) {
      unmeasuredCount += 1
      continue
    }
    sum += s.score
    measuredCount += 1
  }
  return {
    mean: measuredCount > 0 ? sum / measuredCount : null,
    measuredCount,
    unmeasuredCount,
    total: scores.length,
  }
}

/**
 * Type guard — true when a score should be excluded from aggregation.
 */
export function isUnmeasured(score: ExtendedJudgeScore): boolean {
  return score.status === 'unmeasured' || !Number.isFinite(score.score)
}

/**
 * Build an unmeasured sentinel score. Single canonical shape so every
 * judge that opts out of grading produces an identical signal.
 */
export function unmeasuredScore(args: {
  judgeName: string
  dimension: string
  reason: string
  evidence?: string
}): ExtendedJudgeScore {
  return {
    judgeName: args.judgeName,
    dimension: args.dimension,
    score: Number.NaN,
    reasoning: args.reason,
    ...(args.evidence !== undefined ? { evidence: args.evidence } : {}),
    status: 'unmeasured',
  }
}
