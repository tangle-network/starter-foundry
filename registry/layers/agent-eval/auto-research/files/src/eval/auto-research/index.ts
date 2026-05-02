/**
 * auto-research barrel — re-exports the three primitives a research-harness
 * family composes:
 *
 *   - `runSteeringOptimization`, `runMultiShotTrajectoryOptimization`,
 *     `runEvolution` (loop.ts)
 *   - `proposeReview` (propose-review.ts)
 *   - `frontier`, `diverseFrontier`, `DEFAULT_OBJECTIVES` (pareto.ts)
 */

export {
  runSteeringOptimization,
  runMultiShotTrajectoryOptimization,
  runEvolution,
  type SteeringOptimizationInput,
  type SteeringOptimizationOutput,
  type MultiShotOptimizationConfig,
  type MultiShotOptimizationResult,
  type PromptEvolutionConfig,
  type PromptEvolutionResult,
  type SteeringOptimizationRow,
  type SteeringOptimizationResult,
  type SteeringOptimizerConfig,
} from './loop.js'

export {
  proposeReview,
  type ProposeReviewInput,
  type ProposeReviewOutput,
  type ProposeReviewConfig,
  type ProposeReviewReport,
} from './propose-review.js'

export {
  frontier,
  diverseFrontier,
  DEFAULT_OBJECTIVES,
  type VariantPoint,
  type Objective,
  type ParetoResult,
} from './pareto.js'
