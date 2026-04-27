/**
 * Per-turn scorer — apply `StepRubric`s on a turn-by-turn basis and surface
 * exactly WHERE multi-turn quality degrades.
 *
 * Outcome-only eval (did the final artifact pass?) hides degradation modes
 * common to multi-turn agents:
 *   - "smart on turn 1, drifts by turn 5"
 *   - "regains coherence after a tool error in turn 3"
 *   - "good response, but only after retrying the same tool 4 times"
 *
 * This module composes `StepRubric` (the agent-eval primitive for span-level
 * scoring) into per-turn aggregates and emits a `convergenceTurn` (first
 * turn whose aggregate >= threshold) for regression-friendly comparisons.
 */

import {
  gradeSemanticStatus,
  type LayerStatus,
  type Severity,
  type StepContext,
  type StepRubric,
  type Trajectory,
  type TrajectoryStep,
} from '@tangle-network/agent-eval'

export interface PerTurnScore {
  /** 1-indexed turn number, parallel to MultiTurnScenario.userTurns. */
  turn: number
  /** Weighted-mean score in 0..1 across all rubrics that fired this turn. */
  aggregateScore: number
  /** Number of spans rubrics actually graded (vs spans that all rubrics skipped). */
  gradedCount: number
  /** Per-rubric breakdown for forensic drill-down. */
  byRubric: Array<{
    rubricId: string
    score: number
    weight: number
    rationale?: string
  }>
}

export interface MultiTurnScoreReport {
  scenarioId: string
  runId: string
  perTurn: PerTurnScore[]
  /** Overall (weighted-mean across all turns). */
  cumulativeScore: number
  /**
   * First 1-indexed turn whose `aggregateScore >= threshold`. `null` if no
   * turn met the threshold. This is the regression-friendly headline metric:
   * if convergence drops from turn-2 to turn-4 between runs, something
   * upstream of turn-3 changed.
   */
  convergenceTurn: number | null
  /** SemanticStatus verdict — feeds gradeSemanticStatus so the layer can
   *  participate in MultiLayerVerifier without re-implementing thresholding. */
  status: LayerStatus
}

export interface PerTurnScoreInput {
  scenarioId: string
  runId: string
  trajectory: Trajectory
  /** Steps grouped by 1-indexed user turn (output of groupStepsByTurn). */
  stepsByTurn: TrajectoryStep[][]
  rubrics: StepRubric[]
  /** Per-turn score required to count as "converged". Default 0.7. */
  threshold?: number
}

const DEFAULT_THRESHOLD = 0.7

const severityFromScore = (score: number, threshold: number): Severity => {
  if (score >= threshold) return 'minor'
  if (score >= threshold - 0.2) return 'major'
  return 'critical'
}

const rubricMatchesStep = (rubric: StepRubric, step: TrajectoryStep): boolean => {
  if (!rubric.kinds || rubric.kinds.length === 0) return true
  return rubric.kinds.includes(step.span.kind)
}

const buildContext = (
  trajectory: Trajectory,
  stepIndex: number,
): StepContext => ({
  trajectory,
  step: trajectory.steps[stepIndex],
  prior: trajectory.steps.slice(0, stepIndex),
  next: trajectory.steps.slice(stepIndex + 1),
})

export const scorePerTurn = async (
  input: PerTurnScoreInput,
): Promise<MultiTurnScoreReport> => {
  const threshold = input.threshold ?? DEFAULT_THRESHOLD
  const perTurn: PerTurnScore[] = []

  // Map span.spanId → step.index in the full trajectory for context lookup.
  const indexBySpanId = new Map<string, number>()
  for (const step of input.trajectory.steps) {
    indexBySpanId.set(step.span.spanId, step.index)
  }

  for (let t = 0; t < input.stepsByTurn.length; t += 1) {
    const turnSteps = input.stepsByTurn[t]
    let weightedSum = 0
    let weightTotal = 0
    let gradedCount = 0
    const rubricAggregates = new Map<
      string,
      { sum: number; weight: number; count: number; lastRationale?: string }
    >()

    for (const step of turnSteps) {
      const fullIndex = indexBySpanId.get(step.span.spanId)
      if (fullIndex === undefined) continue
      const ctx = buildContext(input.trajectory, fullIndex)
      for (const rubric of input.rubrics) {
        if (!rubricMatchesStep(rubric, step)) continue
        const verdict = await rubric.grade(ctx)
        if (verdict === null) continue
        const w = rubric.weight ?? 1
        weightedSum += verdict.score * w
        weightTotal += w
        gradedCount += 1
        const agg = rubricAggregates.get(rubric.id) ?? { sum: 0, weight: 0, count: 0 }
        agg.sum += verdict.score * w
        agg.weight += w
        agg.count += 1
        agg.lastRationale = verdict.rationale
        rubricAggregates.set(rubric.id, agg)
      }
    }

    const aggregateScore = weightTotal > 0 ? weightedSum / weightTotal : 0
    const byRubric = [...rubricAggregates.entries()].map(([rubricId, agg]) => ({
      rubricId,
      score: agg.weight > 0 ? agg.sum / agg.weight : 0,
      weight: agg.weight,
      rationale: agg.lastRationale,
    }))

    perTurn.push({
      turn: t + 1,
      aggregateScore,
      gradedCount,
      byRubric,
    })
  }

  const totalWeighted = perTurn.reduce(
    (acc, t) => acc + t.aggregateScore * Math.max(t.gradedCount, 1),
    0,
  )
  const totalWeight = perTurn.reduce((acc, t) => acc + Math.max(t.gradedCount, 1), 0)
  const cumulativeScore = totalWeight > 0 ? totalWeighted / totalWeight : 0

  const convergenceTurn = perTurn.find((t) => t.aggregateScore >= threshold)?.turn ?? null

  const status = gradeSemanticStatus({
    score: cumulativeScore,
    findings: perTurn.map((t) => ({
      severity: severityFromScore(t.aggregateScore, threshold),
      score: t.aggregateScore,
      present: t.gradedCount > 0,
    })),
    available: perTurn.some((t) => t.gradedCount > 0),
    threshold,
  })

  return {
    scenarioId: input.scenarioId,
    runId: input.runId,
    perTurn,
    cumulativeScore,
    convergenceTurn,
    status,
  }
}
