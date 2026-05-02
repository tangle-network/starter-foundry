/**
 * auto-research:loop — composable optimization loop.
 *
 * Wraps the 0.19 optimization primitives from
 * `@tangle-network/agent-eval@^0.19.0`. The eval-harness layers (scenarios,
 * judge-rubric, regression) supply the measurement substrate; this module
 * supplies the optimizer that drives variants against it.
 *
 * Two entrypoints:
 *
 *   - `runSteeringOptimization` — N steering bundles × M scenarios → winner
 *     by observed aggregate score. Use when variants are already enumerated
 *     and the question is "which one wins?".
 *
 *   - `runMultiShotTrajectoryOptimization` — GEPA-style optimization for a
 *     variable-length agent task. Use this for chat agents, browser/coding
 *     agents, and autoresearch loops where one trial is a whole trajectory.
 *
 *   - `runEvolution` — population-based reflective mutation. Use when the
 *     consumer wants the loop to GENERATE variants for a narrow prompt-only
 *     surface. Prefer `runMultiShotTrajectoryOptimization` for product loops.
 *
 * Both pass through to agent-eval primitives unchanged so callers can read
 * the upstream docs and trust their semantics.
 */

import {
  PairwiseSteeringOptimizer,
  runMultiShotOptimization,
  runPromptEvolution,
  type MultiShotOptimizationConfig,
  type MultiShotOptimizationResult,
  type PromptEvolutionConfig,
  type PromptEvolutionResult,
  type SteeringOptimizationRow,
  type SteeringOptimizationResult,
  type SteeringOptimizerConfig,
} from '@tangle-network/agent-eval'

export interface SteeringOptimizationInput {
  rows: SteeringOptimizationRow[]
  config?: SteeringOptimizerConfig
}
export interface SteeringOptimizationOutput extends SteeringOptimizationResult {}

/**
 * Run a single-shot steering-bundle optimization. The provided `evaluate`
 * function is the bridge to the eval-harness — it should call into the
 * scenarios + judge-rubric layers and return a `RunScore`.
 */
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
  return runMultiShotOptimization(config)
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
  return runPromptEvolution(config)
}

export type {
  MultiShotOptimizationConfig,
  MultiShotOptimizationResult,
  PromptEvolutionConfig,
  PromptEvolutionResult,
  SteeringOptimizationRow,
  SteeringOptimizationResult,
  SteeringOptimizerConfig,
} from '@tangle-network/agent-eval'
