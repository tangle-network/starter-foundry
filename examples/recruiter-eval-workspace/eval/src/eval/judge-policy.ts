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
  appliesToDimensions: readonly string[] | undefined,
  scenarioDimensions: readonly string[],
): boolean {
  if (!appliesToDimensions || appliesToDimensions.length === 0) return true
  const dimensions = new Set(scenarioDimensions)
  return appliesToDimensions.some((dimension) => dimensions.has(dimension))
}

export function aggregateJudgeScores(scores: readonly WeightedJudgeScore[]): JudgeScoreAggregate {
  const grouped = new Map<string, Array<{ score: number; weight: number }>>()
  const unmeasuredJudges = new Set<string>()
  let measuredCount = 0
  let unmeasuredCount = 0

  for (const score of scores) {
    if (score.status === 'unmeasured') {
      unmeasuredCount += 1
      unmeasuredJudges.add(score.judgeName)
      continue
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
    const rows = grouped.get(score.judgeName) ?? []
    rows.push({ score: score.score, weight })
    grouped.set(score.judgeName, rows)
    unmeasuredJudges.delete(score.judgeName)
    measuredCount += 1
  }

  const judgeMeans = [...grouped.values()].map((rows) => {
    const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0)
    return rows.reduce((sum, row) => sum + row.score * row.weight, 0) / totalWeight
  })

  return {
    mean:
      judgeMeans.length === 0
        ? null
        : judgeMeans.reduce((sum, score) => sum + score, 0) / judgeMeans.length,
    measuredCount,
    unmeasuredCount,
    measuredJudgeCount: judgeMeans.length,
    unmeasuredJudgeCount: unmeasuredJudges.size,
  }
}
