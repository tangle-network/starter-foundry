// Public API — import from 'starter-foundry'
export { planPrompt } from './prompt-planner.js'
export { composeStarter } from './compose.js'
export { composeFromPrompt } from './compose-prompt.js'
export type { ComposeFromPromptOptions, ComposeFromPromptResult } from './compose-prompt.js'
export {
  PERSONALIZATION_INSTRUCTION,
  PERSONALIZATION_CSS_INSTRUCTION,
  PERSONALIZATION_JSON_INSTRUCTION,
  getComposedScaffoldContext,
  getCuratedScaffoldContext,
} from './agent-context.js'
export { createContextPack } from './context-pack.js'
export { generateBuildPlan } from './build-plan.js'
export { loadRegistry, resolveComponents, clearRegistryCache, initSemanticRouting } from './registry.js'
export { semanticMatch, isSemanticRouterReady } from './semantic-router.js'
export { selectStarter } from './selection.js'
export { validateStarter } from './validate.js'
export { benchmarkStarter } from './benchmark.js'
export { composeWorkspace, createWorkspaceContextPack, benchmarkWorkspace } from './workspace.js'
export { augmentWithLayer } from './augment.js'
export { fattenStarter, fattenWorkspace } from './fatten.js'
export { matchesKeyword, hasAny, detectLane, detectCapabilities, detectIndustry } from './keywords.js'
export { listIndustries, getIndustry, PERSONALIZE_CSS_PATHS } from './industries.js'
export type { IndustryInfo } from './industries.js'
export { on, off, emit, traced } from './telemetry.js'
export type { RouteEvent, ComposeEvent, CapabilityEvent } from './telemetry.js'
export { emitBuildoutEvent, BUILDOUT_SCHEMA_VERSION, DEFAULT_PATHS } from './buildout-traces.js'
export type { BuildoutEvent, BuildoutEventInput, BuildoutOutcome } from './buildout-traces.js'
export type {
  ComposeSpec,
  WorkspaceSpec,
  PromptPlan,
  StarterPromptPlan,
  WorkspacePromptPlan,
  SelectionResult,
  ComposeResult,
  ValidationResult,
  BenchmarkReport,
  ContextPack,
  BuildPlan,
  BuildHints,
  Registry,
  FamilyManifest,
  LayerManifest,
  PartnerManifest,
} from '../types.js'
