import type { JudgeScore } from '@tangle-network/agent-eval'

export type JudgeMeasurementStatus = 'measured' | 'unmeasured'

export interface WeightedJudgeScore extends JudgeScore {
  status?: JudgeMeasurementStatus
  weight?: number
}

export interface JudgeScoreAggregate {
  mean: number | null
  measuredCount: number
  unmeasuredCount: number
  measuredJudgeCount: number
  unmeasuredJudgeCount: number
}

export function judgeAppliesTo(
  declaredDimensions: readonly string[],
  scenarioDimensions: readonly string[],
): boolean {
  if (declaredDimensions.length === 0) {
    throw new Error('judge applicability requires at least one declared dimension')
  }
  const dimensions = new Set(scenarioDimensions)
  return declaredDimensions.some((dimension) => dimensions.has(dimension))
}

export function aggregateJudgeScores(scores: readonly WeightedJudgeScore[]): JudgeScoreAggregate {
  const grouped = new Map<
    string,
    { weightedTotal: number; totalWeight: number; measured: number; unmeasured: number }
  >()
  let measuredCount = 0
  let unmeasuredCount = 0

  for (const score of scores) {
    if (!score.judgeName) throw new Error('judge score requires judgeName')
    if (!score.dimension) throw new Error(`judge "${score.judgeName}" score requires dimension`)
    const row = grouped.get(score.judgeName) ?? {
      weightedTotal: 0,
      totalWeight: 0,
      measured: 0,
      unmeasured: 0,
    }
    if (score.status === 'unmeasured') {
      row.unmeasured += 1
      unmeasuredCount += 1
      grouped.set(score.judgeName, row)
      continue
    }
    if (score.status !== undefined && score.status !== 'measured') {
      throw new Error(`judge "${score.judgeName}" returned invalid status: ${score.status}`)
    }
    if (!Number.isFinite(score.score) || score.score < 0 || score.score > 1) {
      throw new Error(
        `judge "${score.judgeName}" returned invalid score for "${score.dimension}": ${score.score}`,
      )
    }
    const weight = score.weight ?? 1
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new Error(
        `judge "${score.judgeName}" returned invalid weight for "${score.dimension}": ${weight}`,
      )
    }
    row.weightedTotal += score.score * weight
    row.totalWeight += weight
    row.measured += 1
    measuredCount += 1
    grouped.set(score.judgeName, row)
  }

  const measuredJudgeMeans: number[] = []
  let unmeasuredJudgeCount = 0
  for (const row of grouped.values()) {
    if (row.unmeasured > 0 || row.measured === 0) {
      unmeasuredJudgeCount += 1
      continue
    }
    measuredJudgeMeans.push(row.weightedTotal / row.totalWeight)
  }

  return {
    mean:
      unmeasuredJudgeCount > 0 || measuredJudgeMeans.length === 0
        ? null
        : measuredJudgeMeans.reduce((sum, score) => sum + score, 0) / measuredJudgeMeans.length,
    measuredCount,
    unmeasuredCount,
    measuredJudgeCount: measuredJudgeMeans.length,
    unmeasuredJudgeCount,
  }
}
