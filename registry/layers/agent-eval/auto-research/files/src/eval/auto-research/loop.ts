/**
 * auto-research:loop — composable optimization loop.
 *
 * Wraps the optimization primitives from `@tangle-network/agent-eval@0.135.1`.
 * The eval-harness layers (scenarios, judge-rubric, regression) supply the
 * measurement substrate; this module supplies the optimizer that drives
 * variants against it.
 *
 * Three optimization entrypoints:
 *
 *   - `runSteeringOptimization` — N steering bundles × M scenarios → winner
 *     by observed aggregate score. Use when variants are already enumerated
 *     and the question is "which one wins?".
 *
 *   - `runMultiShotTrajectoryOptimization` — campaign optimization for a
 *     variable-length agent task. Use this for chat agents, browser/coding
 *     agents, and autoresearch loops where one trial is a whole trajectory.
 *
 *   - `runEvolution` — population-based reflective mutation. Use when the
 *     consumer wants the loop to GENERATE variants for a narrow prompt-only
 *     surface. Prefer `runMultiShotTrajectoryOptimization` for product loops.
 *
 * Plus the current run-analysis bridge:
 *
 *   - `analyzeOptimization` — converts captured `RunRecord[]` into the
 *     canonical insight report: score distributions, cost/quality frontier,
 *     lift analysis when baseline/candidate ids are present, and ranked
 *     recommendations. Idempotent and read-only with respect to the runs.
 *
 * Both optimization entrypoints pass through to agent-eval primitives
 * unchanged so callers can read the upstream docs and trust their
 * semantics. The RL bridge is wired here so families inherit the
 * launch-decision-grade artifact set by default — see
 * `agent-builder/src/lib/.server/eval/auto-research-runner.ts` for the
 * canonical reference wiring.
 */

import {
  PairwiseSteeringOptimizer,
  type SteeringOptimizationRow,
  type SteeringOptimizationResult,
  type SteeringOptimizerConfig,
} from '@tangle-network/agent-eval'
import {
  runImprovementLoop,
  runOptimization,
  type RunImprovementLoopOptions,
  type RunImprovementLoopResult,
  type RunOptimizationOptions,
  type RunOptimizationResult,
  type Scenario,
} from '@tangle-network/agent-eval/campaign'
import {
  analyzeRuns,
  type AnalyzeRunsOptions,
  type InsightReport,
} from '@tangle-network/agent-eval/contract'

export interface SteeringOptimizationInput {
  rows: SteeringOptimizationRow[]
  config?: SteeringOptimizerConfig
}
export interface SteeringOptimizationOutput extends SteeringOptimizationResult {}

/** Rank completed steering-bundle eval rows across variants and scenarios. */
export async function runSteeringOptimization(
  input: SteeringOptimizationInput,
): Promise<SteeringOptimizationOutput> {
  return new PairwiseSteeringOptimizer().optimize(input.rows, input.config)
}

/**
 * Run GEPA-style optimization over full agent trajectories.
 *
 * This is the default for real agents. A single trial may contain one turn or
 * many turns; the runner owns execution, the scorer emits actionable side
 * information, and agent-eval owns paired seeds, Pareto selection, and optional
 * holdout promotion.
 */
export async function runMultiShotTrajectoryOptimization<P>(
  config: MultiShotOptimizationConfig<P>,
): Promise<MultiShotOptimizationResult<P>> {
  return runOptimization(config)
}

/**
 * Run a population-based prompt evolution. Consumer supplies a `scoreAdapter`
 * (run a (variant, scenario, rep) trial) and a `mutateAdapter` (produce
 * children given trace evidence). Pareto-selected, crowding-distance
 * tie-broken, generation-by-generation.
 *
 * NOTE: use this for narrow prompt/signature surfaces. Product agents should
 * usually use `runMultiShotTrajectoryOptimization` so the optimizer sees the
 * whole task trajectory and ASI, not a surrogate scalar.
 */
export async function runEvolution<P>(
  config: PromptEvolutionConfig<P>,
): Promise<PromptEvolutionResult<P>> {
  return runOptimization(config)
}

/**
 * Run the full promotion shell: optimize on train, re-score baseline vs winner
 * on holdout, and return the gate decision plus promoted diff. Use this when
 * the caller has the held-out split required for a launch decision.
 */
export async function runPromotedImprovementLoop<P>(
  config: PromotedImprovementConfig<P>,
): Promise<PromotedImprovementResult<P>> {
  return runImprovementLoop(config)
}

/**
 * Analyze captured run records into the canonical decision packet —
 * score distributions, lift when paired baseline/candidate ids exist,
 * cost/quality frontier, failure clusters when an analyst is configured,
 * and ranked recommendations.
 *
 * Idempotent and read-only with respect to the captured runs. Call after the
 * optimization or promotion loop has emitted `RunRecord[]`; do NOT invent
 * records from aggregate scores.
 *
 * @example
 *   const rl = await analyzeOptimization({
 *     runs,
 *     baselineCandidateId: 'baseline',
 *     candidateCandidateId: optimized.winnerSurfaceHash,
 *     split: 'holdout',
 *   })
 *   // rl.recommendations → ranked launch / hold / investigate guidance
 */
export async function analyzeOptimization(
  options: AnalyzeOptimizationResultOptions,
): Promise<AnalyzeOptimizationResultReport> {
  return analyzeRuns(options)
}

export type MultiShotOptimizationConfig<P = unknown> = RunOptimizationOptions<Scenario, P>
export type MultiShotOptimizationResult<P = unknown> = RunOptimizationResult<P, Scenario>
export type PromptEvolutionConfig<P = unknown> = RunOptimizationOptions<Scenario, P>
export type PromptEvolutionResult<P = unknown> = RunOptimizationResult<P, Scenario>
export type PromotedImprovementConfig<P = unknown> = RunImprovementLoopOptions<Scenario, P>
export type PromotedImprovementResult<P = unknown> = RunImprovementLoopResult<P, Scenario>
export type AnalyzeOptimizationResultOptions = AnalyzeRunsOptions
export type AnalyzeOptimizationResultReport = InsightReport

export type { SteeringOptimizationRow, SteeringOptimizationResult, SteeringOptimizerConfig }
