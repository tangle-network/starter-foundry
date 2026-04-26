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
export {
  loadRegistry,
  listRegistry,
  resolveComponents,
  clearRegistryCache,
  initSemanticRouting,
} from './registry.js'
export { validatePlan } from './validate-plan.js'
export type { PlanValidationResult, PlanValidationIssue } from './validate-plan.js'
export { semanticMatch, isSemanticRouterReady } from './semantic-router.js'
export { selectStarter } from './selection.js'
export { validateStarter } from './validate.js'
export { benchmarkStarter } from './eval/benchmark.js'
export { composeWorkspace, createWorkspaceContextPack, benchmarkWorkspace } from './workspace.js'
export { augmentWithLayer } from './augment.js'
export { fattenStarter, fattenWorkspace } from './fatten.js'
export {
  matchesKeyword,
  hasAny,
  detectLane,
  detectCapabilities,
  detectIndustry,
} from './keywords.js'
export { listIndustries, getIndustry, PERSONALIZE_CSS_PATHS } from './industries.js'
export type { IndustryInfo } from './industries.js'
export { on, off, emit, traced } from './telemetry.js'
export type { RouteEvent, ComposeEvent, CapabilityEvent } from './telemetry.js'
export { emitBuildoutEvent, BUILDOUT_SCHEMA_VERSION, DEFAULT_PATHS } from './buildout-traces.js'
export type { BuildoutEvent, BuildoutEventInput, BuildoutOutcome } from './buildout-traces.js'
// Foundational primitives — unblock multiple ROADMAP branches.
export { generatePrompts, persistBatch } from './synthetic/index.js'
export type { SyntheticPrompt, SyntheticBatch, GenerateOptions } from './synthetic/index.js'
export { abDecide } from './eval/ab.js'
export type { AbExperiment, AbDecision } from './eval/ab.js'
export { generateSbom, writeSbom } from './eval/sbom.js'
export type { Sbom, SbomComponent } from './eval/sbom.js'
export { scanDirectory as scanForSecrets } from './safety/secret-scan.js'
export type { SecretMatch } from './safety/secret-scan.js'
export { scanLicenses } from './safety/license-check.js'
export type { LicenseFlag } from './safety/license-check.js'
export { generateBrand, brandToPersonalizeJson, brandToPersonalizeCss } from './brand/index.js'
export type { BrandKit } from './brand/index.js'
export { generateMediaManifest, buildMediaManifest } from './brand/media-manifest.js'
export type { MediaAsset, MediaManifest, GenerateMediaResult } from './brand/media-manifest.js'
export { applyVoice, defaultVoiceForIndustry, INDUSTRY_VOICE } from './brand/voice.js'
export type { VoiceRegister, VoiceApplyResult } from './brand/voice.js'
export { emitI18n, buildI18nFiles, generateLocalePack, isRtl, RTL_LOCALES } from './brand/i18n.js'
export type { LocalePack, I18nEmitResult } from './brand/i18n.js'
export {
  firstTurnFlowForFamily,
  firstTurnFlowForIndustry,
  firstTurnFlowAsMarkdown,
  listKnownIndustries,
} from './brand/first-turn-flows.js'
export type { FirstTurnFlow } from './brand/first-turn-flows.js'
export { inferSegment, segmentDefaultsAsMarkdown, SEGMENT_DEFAULTS } from './brand/user-segments.js'
export type { UserSegment } from './brand/user-segments.js'
export {
  snapshot as visualSnapshot,
  diff as visualDiff,
  isClean as visualIsClean,
} from './visual-regression.js'
export type { VisualSnapshot, VisualDiff, VisualFileEntry } from './visual-regression.js'
/** @deprecated renamed to VisualSnapshot. */
export type { VisualSnapshot as VisualAuditResult } from './visual-regression.js'
export { estimateBuildoutCost, loadRateTable } from './cost.js'
export type { CostEstimate, ModelRate, CostRateTable } from './cost.js'
export { createTelemetryStream } from './telemetry/stream.js'
export { decideCanaryBucket, selectCanaryVersion, DEFAULT_CANARY_EXPERIMENT } from './canary.js'
export type { CanaryExperiment, CanaryBucket } from './canary.js'
export { loadRegistryFromMirrors, MirrorLoadError } from './registry-mirror.js'
export type { MirrorEntry, MirrorLoadOptions, MirrorLoadResult } from './registry-mirror.js'
export { isVersionRolledBack, getLastKnownGoodVersion, listRollbacks } from './version-history.js'
export type { RollbackRecord } from './version-history.js'
export { seedForSpec, seededRng, buildLockFile, verifyLockMatches } from './eval/reproducibility.js'
export type { SeededRng, ComposeLockFile } from './eval/reproducibility.js'
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
