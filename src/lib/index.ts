// Public API — import from 'starter-foundry'
export { planPrompt } from './prompt-planner.js'
export { composeStarter } from './compose.js'
export { createContextPack } from './context-pack.js'
export { generateBuildPlan } from './build-plan.js'
export { loadRegistry, resolveComponents, clearRegistryCache } from './registry.js'
export { selectStarter } from './selection.js'
export { validateStarter } from './validate.js'
export { benchmarkStarter } from './benchmark.js'
export { composeWorkspace, createWorkspaceContextPack, benchmarkWorkspace } from './workspace.js'
export { fattenStarter } from './fatten.js'
export { matchesKeyword, hasAny, detectLane, detectCapabilities } from './keywords.js'
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
