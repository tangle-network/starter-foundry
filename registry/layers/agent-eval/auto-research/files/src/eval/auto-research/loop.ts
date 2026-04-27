/**
 * auto-research:loop — composable optimization loop.
 *
 * Wraps `OptimizationLoop` + `runPromptEvolution` from
 * `@tangle-network/agent-eval@^0.13.0`. The eval-harness layers (scenarios,
 * judge-rubric, regression) supply the measurement substrate; this module
 * supplies the optimizer that drives variants against it.
 *
 * Two entrypoints:
 *
 *   - `runSteeringOptimization` — N steering bundles × M scenarios → winner
 *     by FDR-corrected pairwise testing. Use when variants are already
 *     enumerated and the question is "which one wins?".
 *
 *   - `runEvolution` — population-based reflective mutation. Use when the
 *     consumer wants the loop to GENERATE variants from a seed population +
 *     a mutator (LLM-driven typically).
 *
 * Both pass through to agent-eval primitives unchanged so callers can read
 * the upstream docs and trust their semantics.
 */

import {
  OptimizationLoop,
  runPromptEvolution,
  type OptimizationLoopConfig,
  type OptimizationLoopResult,
  type PromptEvolutionConfig,
  type PromptEvolutionResult,
} from '@tangle-network/agent-eval'

export interface SteeringOptimizationInput extends OptimizationLoopConfig {}
export interface SteeringOptimizationOutput extends OptimizationLoopResult {}

/**
 * Run a single-shot steering-bundle optimization. The provided `evaluate`
 * function is the bridge to the eval-harness — it should call into the
 * scenarios + judge-rubric layers and return a `RunScore`.
 */
export async function runSteeringOptimization(
  config: SteeringOptimizationInput,
): Promise<SteeringOptimizationOutput> {
  const loop = new OptimizationLoop()
  return loop.run(config)
}

/**
 * Run a population-based prompt evolution. Consumer supplies a `scoreAdapter`
 * (run a (variant, scenario, rep) trial) and a `mutateAdapter` (produce
 * children given trace evidence). Pareto-selected, crowding-distance
 * tie-broken, generation-by-generation.
 *
 * NOTE: this is the right primitive for the research-harness validator pass
 * once a hypothesis screens in. Screening (cheap 1-rep) belongs upstream.
 */
export async function runEvolution<P>(
  config: PromptEvolutionConfig<P>,
): Promise<PromptEvolutionResult<P>> {
  return runPromptEvolution(config)
}

export type {
  OptimizationLoopConfig,
  OptimizationLoopResult,
  PromptEvolutionConfig,
  PromptEvolutionResult,
} from '@tangle-network/agent-eval'
