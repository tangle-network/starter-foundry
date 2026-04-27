/**
 * Pairwise judge runner — A-vs-B evaluation with REAL position-bias correction.
 *
 * Adversarial design: every (variantA, variantB, scenario) triple is judged
 * twice — once with A presented in position 1 and once with B presented in
 * position 1. The judge function is invoked TWICE per scenario; we never
 * fabricate the second observation by reusing the first run's scores.
 *
 * Verdict policy (position-corrected):
 *   - 'A'   — A won in BOTH orderings (positionally stable winner)
 *   - 'B'   — B won in BOTH orderings (positionally stable winner)
 *   - 'tie' — orderings disagreed; positional bias detected for this case,
 *             so the apparent winner is an artifact of presentation order.
 *
 * Bias diagnostics:
 *   - positionalBias: avg(score_when_first - score_when_second) per variant.
 *     Non-zero = the judge prefers whichever variant it sees first.
 *   - verbosityBias: Pearson r between output length and judge score.
 *   - selfPreference: judge bias toward outputs from its own family.
 */

import {
  PairwiseSteeringOptimizer,
  positionalBias,
  verbosityBias,
  selfPreference,
  type CandidateScore,
  type PositionalBiasResult,
  type VerbosityBiasResult,
  type SelfPreferenceResult,
  type SteeringOptimizationResult,
  type SteeringOptimizationRow,
  type SteeringOptimizerConfig,
} from '@tangle-network/agent-eval'

/**
 * Pairwise judge function. Called with the two variant outputs in
 * presentation order (`first` is shown first to the judge, `second`
 * second). Returns a 0..1 score for each. The runner invokes this
 * twice per (scenario, variant-pair) — once with (A,B), once with
 * (B,A) — and only declares a winner when both orderings agree.
 *
 * Implementations MUST treat `first` and `second` as opaque presentation
 * positions; if the implementation sorts or normalises by variantId
 * internally, position-bias detection is destroyed.
 */
export type PairwiseJudge = (args: {
  first: ScenarioOutput
  second: ScenarioOutput
  scenarioId: string
}) => Promise<{ firstScore: number; secondScore: number }>

export interface PairwiseInput {
  /** Variant under test in slot A. */
  variantA: VariantOutputs
  /** Variant under test in slot B. */
  variantB: VariantOutputs
  /**
   * Pairwise judge. REQUIRED — the layer's whole value is comparing what
   * the judge says when it sees A-then-B vs B-then-A. Callers that want a
   * deterministic / stub judge for tests should supply one explicitly;
   * there is no fallback that fabricates the second observation.
   */
  judge: PairwiseJudge
  /** Optional optimizer weights override (mirrors RunScoreWeights). */
  optimizerConfig?: SteeringOptimizerConfig
  /** Judge fingerprint — used to detect self-preference when the judge
   *  is in the same family as one of the variants. */
  judgeFamily?: string
}

export interface VariantOutputs {
  variantId: string
  /** Family / model id (e.g. 'gpt-4o', 'claude-opus-4'). Used for selfPreference. */
  family?: string
  scenarios: ScenarioOutput[]
}

export interface ScenarioOutput {
  scenarioId: string
  /** The agent's text output. Length feeds verbosityBias. */
  output: string
  /** Steering bundle for this run — required by PairwiseSteeringOptimizer. */
  bundle: SteeringOptimizationRow['bundle']
  /** Per-dimension RunScore from rubric eval. Carries through to the optimizer. */
  score: SteeringOptimizationRow['score']
  /** Optional metadata (latency, cost, model). */
  metadata?: Record<string, unknown>
}

export interface PairwisePerScenario {
  scenarioId: string
  /**
   * Position-corrected verdict.
   *   'A'   — A won when shown first AND when shown second
   *   'B'   — B won in both orderings
   *   'tie' — orderings disagreed (positional bias for this case)
   */
  verdict: 'A' | 'B' | 'tie'
  /** Mean judge score for A across both orderings. */
  meanA: number
  /** Mean judge score for B across both orderings. */
  meanB: number
  /**
   * Per-variant order delta: avg(score_when_first - score_when_second).
   * Non-zero = positional bias for this scenario.
   */
  positionDelta: { a: number; b: number }
  /** Raw observations for forensic drill-down + downstream stats. */
  observations: {
    aFirstScore: number
    bSecondScore: number
    bFirstScore: number
    aSecondScore: number
  }
}

export interface PairwiseReport {
  variantA: string
  variantB: string
  perScenario: PairwisePerScenario[]
  /** Wins broken down: A | B | tie. Tie includes positional-disagreement cases. */
  winCounts: { a: number; b: number; tie: number }
  /** PairwiseSteeringOptimizer's recommendation, run on combined rows. */
  optimizer: SteeringOptimizationResult
  /** Adversarial bias diagnostics. */
  bias: {
    position: PositionalBiasResult
    verbosity: VerbosityBiasResult
    selfPreference?: SelfPreferenceResult
  }
}

export const runPairwise = async (input: PairwiseInput): Promise<PairwiseReport> => {
  const { variantA, variantB, judge, optimizerConfig, judgeFamily } = input

  const aById = new Map(variantA.scenarios.map((s) => [s.scenarioId, s]))
  const bById = new Map(variantB.scenarios.map((s) => [s.scenarioId, s]))
  const sharedIds = [...aById.keys()].filter((id) => bById.has(id))

  const perScenario: PairwisePerScenario[] = []
  const candidateScores: CandidateScore[] = []
  const verbositySamples: Array<{ outputLen: number; score: number }> = []
  const selfPrefSamples: Array<{ score: number; inFamily: boolean }> = []
  const optimizerRows: SteeringOptimizationRow[] = []

  let aWins = 0
  let bWins = 0
  let ties = 0

  for (const scenarioId of sharedIds) {
    const a = aById.get(scenarioId)!
    const b = bById.get(scenarioId)!

    // Order 1: A presented first, B second.
    const order1 = await judge({ first: a, second: b, scenarioId })
    const aFirstScore = order1.firstScore
    const bSecondScore = order1.secondScore

    // Order 2: B presented first, A second. REAL second invocation —
    // never reuse order1's numbers; that's how position bias hides.
    const order2 = await judge({ first: b, second: a, scenarioId })
    const bFirstScore = order2.firstScore
    const aSecondScore = order2.secondScore

    const aMean = (aFirstScore + aSecondScore) / 2
    const bMean = (bFirstScore + bSecondScore) / 2

    // Position-corrected verdict: only call a winner if the SAME variant
    // wins in both orderings. Disagreement = positional bias for this
    // case → 'tie'. Strict-greater so reciprocal ties don't bleed into A.
    const aWinsOrder1 = aFirstScore > bSecondScore
    const aWinsOrder2 = aSecondScore > bFirstScore
    const bWinsOrder1 = bSecondScore > aFirstScore
    const bWinsOrder2 = bFirstScore > aSecondScore

    let verdict: PairwisePerScenario['verdict']
    if (aWinsOrder1 && aWinsOrder2) verdict = 'A'
    else if (bWinsOrder1 && bWinsOrder2) verdict = 'B'
    else verdict = 'tie'

    if (verdict === 'A') aWins += 1
    else if (verdict === 'B') bWins += 1
    else ties += 1

    perScenario.push({
      scenarioId,
      verdict,
      meanA: aMean,
      meanB: bMean,
      positionDelta: {
        a: aFirstScore - aSecondScore,
        b: bFirstScore - bSecondScore,
      },
      observations: { aFirstScore, bSecondScore, bFirstScore, aSecondScore },
    })

    // Feed positionalBias() with one row per (item, position) per variant.
    // Tagged by `positionOfAInput`: 'first' = the score this variant got
    // when shown in slot 1, 'second' = score when shown in slot 2.
    candidateScores.push({ itemId: `${scenarioId}::A`, positionOfAInput: 'first', score: aFirstScore })
    candidateScores.push({ itemId: `${scenarioId}::A`, positionOfAInput: 'second', score: aSecondScore })
    candidateScores.push({ itemId: `${scenarioId}::B`, positionOfAInput: 'first', score: bFirstScore })
    candidateScores.push({ itemId: `${scenarioId}::B`, positionOfAInput: 'second', score: bSecondScore })

    verbositySamples.push({ outputLen: a.output.length, score: aMean })
    verbositySamples.push({ outputLen: b.output.length, score: bMean })

    if (judgeFamily !== undefined) {
      if (variantA.family !== undefined) {
        selfPrefSamples.push({ score: aMean, inFamily: variantA.family === judgeFamily })
      }
      if (variantB.family !== undefined) {
        selfPrefSamples.push({ score: bMean, inFamily: variantB.family === judgeFamily })
      }
    }

    optimizerRows.push({
      variantId: variantA.variantId,
      scenarioId,
      bundle: a.bundle,
      score: a.score,
      metadata: a.metadata,
    })
    optimizerRows.push({
      variantId: variantB.variantId,
      scenarioId,
      bundle: b.bundle,
      score: b.score,
      metadata: b.metadata,
    })
  }

  const optimizer = new PairwiseSteeringOptimizer().optimize(optimizerRows, optimizerConfig)
  const bias = {
    position: positionalBias(candidateScores),
    verbosity: verbosityBias(verbositySamples),
    selfPreference: selfPrefSamples.length > 0 ? selfPreference(selfPrefSamples) : undefined,
  }

  return {
    variantA: variantA.variantId,
    variantB: variantB.variantId,
    perScenario,
    winCounts: { a: aWins, b: bWins, tie: ties },
    optimizer,
    bias,
  }
}
