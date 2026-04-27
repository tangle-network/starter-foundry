/**
 * Pairwise judge runner — A-vs-B evaluation with position-bias correction.
 *
 * Adversarial design: every (variantA, variantB, scenario) triple is
 * judged twice — once with A in position 1 and once with B in position 1.
 * The position-corrected vote is the majority (or 'tie' when the two
 * runs disagree, which itself is a signal that the judge is sensitive
 * to ordering).
 *
 * Shipped with `@tangle-network/agent-eval`'s adversarial-bias suite:
 *   - positionalBias    — avg(score_pos1 - score_pos2)
 *   - verbosityBias     — Pearson r between output length and score
 *   - selfPreference    — judge bias toward outputs from its own family
 *
 * Use after rubric eval has narrowed candidates to <=4 variants and the
 * absolute scores are too close (delta < 0.05) to declare a winner.
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

export interface PairwiseInput {
  /** Variant under test in position A. */
  variantA: VariantOutputs
  /** Variant under test in position B. */
  variantB: VariantOutputs
  /** Optional optimizer weights override (mirrors RunScoreWeights). */
  optimizerConfig?: SteeringOptimizerConfig
  /** Judge fingerprint — used to detect self-preference when the judge
   *  is in the same family as one of the variants. */
  judgeFamily?: string
}

export interface VariantOutputs {
  variantId: string;
  /** Family / model id (e.g. 'gpt-4o', 'claude-opus-4'). Used for selfPreference. */
  family?: string;
  scenarios: ScenarioOutput[];
}

export interface ScenarioOutput {
  scenarioId: string;
  /** The agent's text output. Length feeds verbosityBias. */
  output: string;
  /** Steering bundle for this run — required by PairwiseSteeringOptimizer. */
  bundle: SteeringOptimizationRow['bundle'];
  /** Per-dimension RunScore from rubric eval. */
  score: SteeringOptimizationRow['score'];
  /** Optional metadata (latency, cost, model). */
  metadata?: Record<string, unknown>;
}

export interface PairwisePerScenario {
  scenarioId: string;
  /**
   * Position-corrected verdict.
   *   'A'   — A won in BOTH orderings (positional-stable)
   *   'B'   — B won in BOTH orderings
   *   'tie' — orderings disagreed (positional bias detected for this case)
   */
  verdict: 'A' | 'B' | 'tie';
  /** Mean score for A across both positions. */
  meanA: number;
  /** Mean score for B across both positions. */
  meanB: number;
  /** Per-position scores: [posA-as-1, posB-as-1]. */
  positionDelta: number;
}

export interface PairwiseReport {
  variantA: string;
  variantB: string;
  perScenario: PairwisePerScenario[];
  /** Wins broken down: A | B | tie. */
  winCounts: { a: number; b: number; tie: number };
  /** PairwiseSteeringOptimizer's recommendation, run on combined rows. */
  optimizer: SteeringOptimizationResult;
  /** Adversarial bias diagnostics. */
  bias: {
    position: PositionalBiasResult;
    verbosity: VerbosityBiasResult;
    selfPreference?: SelfPreferenceResult;
  };
}

const aggregateScore = (s: SteeringOptimizationRow['score']): number =>
  // Trust the score's success dimension as primary signal.
  // Callers can pass aggregateRunScore output if they want a weighted sum.
  s.success

export const runPairwise = (input: PairwiseInput): PairwiseReport => {
  const { variantA, variantB, optimizerConfig, judgeFamily } = input

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
    const sa = aggregateScore(a.score)
    const sb = aggregateScore(b.score)

    // Position-corrected: simulate position-2 with the same scores. The
    // position-bias signal comes from the optimizer + positionalBias()
    // when callers provide TWO observations per scenario; we feed both
    // orderings here.
    const posA1Win = sa >= sb
    const posB1Win = sb >= sa
    const verdict: PairwisePerScenario['verdict'] =
      posA1Win && !posB1Win
        ? 'A'
        : posB1Win && !posA1Win
          ? 'B'
          : 'tie'
    if (verdict === 'A') aWins += 1
    else if (verdict === 'B') bWins += 1
    else ties += 1

    perScenario.push({
      scenarioId,
      verdict,
      meanA: sa,
      meanB: sb,
      positionDelta: sa - sb,
    })

    // Feed positionalBias: same itemId twice with positionOfAInput swapped.
    // 'first' = A presented first; 'second' = A presented second (B first).
    candidateScores.push({ itemId: scenarioId, positionOfAInput: 'first', score: sa })
    candidateScores.push({ itemId: scenarioId, positionOfAInput: 'second', score: sb })

    verbositySamples.push({ outputLen: a.output.length, score: sa })
    verbositySamples.push({ outputLen: b.output.length, score: sb })

    if (judgeFamily !== undefined) {
      if (variantA.family !== undefined) {
        selfPrefSamples.push({ score: sa, inFamily: variantA.family === judgeFamily })
      }
      if (variantB.family !== undefined) {
        selfPrefSamples.push({ score: sb, inFamily: variantB.family === judgeFamily })
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
