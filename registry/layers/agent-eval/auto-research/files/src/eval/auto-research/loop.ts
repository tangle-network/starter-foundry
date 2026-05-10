/**
 * auto-research:loop — composable optimization loop.
 *
 * Wraps the optimization primitives from `@tangle-network/agent-eval@^0.23.0`.
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
 *   - `runMultiShotTrajectoryOptimization` — GEPA-style optimization for a
 *     variable-length agent task. Use this for chat agents, browser/coding
 *     agents, and autoresearch loops where one trial is a whole trajectory.
 *
 *   - `runEvolution` — population-based reflective mutation. Use when the
 *     consumer wants the loop to GENERATE variants for a narrow prompt-only
 *     surface. Prefer `runMultiShotTrajectoryOptimization` for product loops.
 *
 * Plus the 0.23 RL bridge:
 *
 *   - `analyzeOptimizationResult` — converts an optimization sweep output
 *     (`PromptEvolutionResult` or `MultiShotOptimizationResult`) into the
 *     canonical RL artifact set: `RunRecord[]`, preference triples ready
 *     for DPO/PPO/KTO, verifiable reward signals, reward-hacking diagnosis,
 *     and an anytime-valid sequential verdict. Idempotent and read-only
 *     with respect to the sweep result — call after the optimizer returns.
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
import {
  analyzeOptimizationResult,
  type AnalyzeOptimizationResultOptions,
  type AnalyzeOptimizationResultReport,
} from '@tangle-network/agent-eval/rl'

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

/**
 * Bridge an optimization sweep output to the canonical RL artifact set —
 * `RunRecord[]`, preference triples (chosen/rejected for DPO/PPO/KTO),
 * verifiable reward signals, reward-hacking diagnosis, and (when a
 * comparator candidate is supplied) an anytime-valid sequential verdict.
 *
 * Accepts either a `PromptEvolutionResult` or a `MultiShotOptimizationResult`
 * — the function detects which by structural typing.
 *
 * Idempotent and read-only with respect to the optimization result. Call
 * *after* `runMultiShotTrajectoryOptimization` / `runEvolution` returns; do
 * NOT plumb it inside the optimizer.
 *
 * @example
 *   const evo = await runMultiShotTrajectoryOptimization(config)
 *   const rl = await analyzeOptimization({
 *     result: evo,
 *     ctx: {
 *       commitSha: process.env.GIT_SHA!,
 *       model: 'claude-sonnet-4-6@2025-04-15',
 *       promptHash: hashPrompt(config.seedPrompts),
 *       configHash: hashConfig(config),
 *       splitTag: 'search',
 *     },
 *     comparator: 'baseline',
 *     preferences: { minMargin: 0.05 },
 *   })
 *   // rl.preferences.pairs → DPO/PPO training rows
 *   // rl.rewardHacking.verdict → 'clean' | 'suspect' | ...
 *   // rl.interimConfidence?.recommendation.decision → 'promote' | 'reject' | 'continue'
 */
export async function analyzeOptimization(
  options: AnalyzeOptimizationResultOptions,
): Promise<AnalyzeOptimizationResultReport> {
  return analyzeOptimizationResult(options)
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

export type {
  AnalyzeOptimizationResultOptions,
  AnalyzeOptimizationResultReport,
} from '@tangle-network/agent-eval/rl'
