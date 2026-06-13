/**
 * auto-research barrel — re-exports the primitives a research-harness
 * family composes:
 *
 *   - `runSteeringOptimization`, `runMultiShotTrajectoryOptimization`,
 *     `runEvolution`, `runPromotedImprovementLoop` (loop.ts)
 *   - `analyzeOptimization` — captured runs → decision report with lift,
 *     cost/quality frontier, and ranked recommendations (loop.ts)
 *   - `proposeReview` (propose-review.ts)
 *   - `frontier`, `diverseFrontier`, `DEFAULT_OBJECTIVES` (pareto.ts)
 */

export {
  runSteeringOptimization,
  runMultiShotTrajectoryOptimization,
  runEvolution,
  runPromotedImprovementLoop,
  analyzeOptimization,
  type SteeringOptimizationInput,
  type SteeringOptimizationOutput,
  type MultiShotOptimizationConfig,
  type MultiShotOptimizationResult,
  type PromptEvolutionConfig,
  type PromptEvolutionResult,
  type PromotedImprovementConfig,
  type PromotedImprovementResult,
  type SteeringOptimizationRow,
  type SteeringOptimizationResult,
  type SteeringOptimizerConfig,
  type AnalyzeOptimizationResultOptions,
  type AnalyzeOptimizationResultReport,
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
