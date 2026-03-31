export interface FileEntry {
  source: string
  target: string
}

export type ValidationCheckType =
  | 'file-exists'
  | 'node-syntax'
  | 'http-start'
  | 'command-success'
  | 'python-compile'

export interface ValidationCheck {
  type: ValidationCheckType
  path?: string
  command?: string[]
  expect?: string
  env?: Record<string, string>
  port?: string
  runOnce?: boolean
}

export interface PreviewHint {
  path?: string
  port?: string | number
}

export interface ContextHints {
  commands?: string[]
  entrypoints?: string[]
  preview?: PreviewHint
  extensionPoints?: string[]
}

export interface SlotConfig {
  options?: string[]
  default?: string
}

export interface TaxonomyFields {
  language?: string
  runtime?: string
  surface?: string
}

interface ManifestBase {
  id: string
  description: string
  manifestPath: string
  baseDir: string
  files?: FileEntry[]
  validationChecks?: ValidationCheck[]
  contextHints?: ContextHints
  defaults?: Record<string, unknown>
}

export interface FamilyManifest extends ManifestBase {
  kind: 'family'
  group: null
  tags: string[]
  taxonomy?: TaxonomyFields
  slots?: Record<string, SlotConfig>
  /** Layer IDs that must be present (via layers array or slot selection) for this family to compose correctly. */
  requires?: string[]
}

export interface LayerManifest extends ManifestBase {
  kind: 'layer'
  group: string
  slot?: string
  appliesTo?: string[]
}

export interface PartnerManifest extends ManifestBase {
  kind: 'partner'
  group: null
  appliesTo?: string[]
  slotDefaults?: Record<string, string>
}

export interface Registry {
  families: Map<string, FamilyManifest>
  layers: Map<string, LayerManifest>
  partners: Map<string, PartnerManifest>
}

export interface ResolvedComponents {
  family: FamilyManifest
  layers: LayerManifest[]
  partner: PartnerManifest | null
  slotSelections: Record<string, string>
}

export interface ComposeSpec {
  projectName: string
  packageName?: string
  family: string
  layers?: string[]
  partner?: string | null
  slots?: Record<string, string>
  variables?: Record<string, unknown>
  primaryArtifactTargetMs?: number
}

export interface ProjectEntry {
  id?: string
  path: string
  spec: ComposeSpec
}

export interface NormalizedProjectEntry {
  id: string
  path: string
  spec: ComposeSpec
}

export interface LaunchPlanConfig {
  primaryProjectId?: string
  primaryArtifact?: {
    kind?: string
    path?: string
    port?: number | null
    targetMs?: number
  }
  initialAgentMission?: string
}

export interface WorkspaceSpec {
  workspaceName: string
  userPrompt?: string
  launchPlan?: LaunchPlanConfig
  projects: ProjectEntry[]
}

export interface LaunchPlan {
  primaryProjectId: string
  primaryArtifact: {
    kind: string
    path: string
    port: number | null
    targetMs: number
  }
  initialAgentMission: string
}

export type Complexity = 'simple' | 'medium' | 'complex' | 'mostly-complex'
export type Confidence = 'high' | 'medium' | 'low'

export interface CorpusExpected {
  kind: 'starter' | 'workspace'
  family?: string
  slots?: Record<string, string>
  primaryProjectId?: string
  projectIds?: string[]
  projectFamilies?: Record<string, string>
}

export interface CorpusScenario {
  id: string
  complexity: Complexity
  partner: string | null
  prompt: string
  expected?: CorpusExpected
}

export interface SelectionResult {
  confidence: Confidence
  spec: ComposeSpec
  fallbackUsed: boolean
  reasons: string[]
}

export interface StarterPromptPlan {
  kind: 'starter'
  confidence: Confidence
  reasons: string[]
  spec: ComposeSpec
}

export interface WorkspacePromptPlan {
  kind: 'workspace'
  confidence: Confidence
  reasons: string[]
  spec: WorkspaceSpec
}

export type PromptPlan = StarterPromptPlan | WorkspacePromptPlan

export interface ComposeComponents {
  family: string
  layers: string[]
  partner: string | null
  slots: Record<string, string>
}

export interface ComposeResult {
  outDir: string
  filesWritten: string[]
  composeReportPath: string
  components: ComposeComponents
}

export interface ValidationCheckResult {
  ok: boolean
  check: ValidationCheck
  durationMs: number
  result?: unknown
  error?: string
}

export interface ValidationResult {
  ok: boolean
  outDir: string
  checks: ValidationCheckResult[]
}

export interface BenchmarkStats {
  min: number
  max: number
  mean: number
  p50: number
  p95: number
  samples: number
}

export interface BenchmarkRunResult {
  runId: number
  outDir: string
  composeMs: number
  primaryArtifactMs: number
  primaryArtifactTargetMs: number
  meetsPrimaryArtifactTarget: boolean
  validateMs: number
  contextMs: number
  totalMs: number
  ok: boolean
  filesWritten: number
  checksPassed: number
  checksTotal: number
  contextPath: string
}

export interface BenchmarkReport {
  schemaVersion: 1
  generatedAt: string
  projectName: string
  runs: number
  results: BenchmarkRunResult[]
  summary: {
    composeMs: BenchmarkStats
    primaryArtifactMs: BenchmarkStats
    primaryArtifactTargetMs: number
    primaryArtifactHitRate: number
    validateMs: BenchmarkStats
    contextMs: BenchmarkStats
    totalMs: BenchmarkStats
    passRate: number
  }
}

export interface ContextPack {
  schemaVersion: 1
  generatedAt: string
  projectName: string
  components: ComposeComponents
  variables: Record<string, unknown>
  files: string[]
  fileOwnership: Record<string, string>
  commands: string[]
  entrypoints: string[]
  preview: PreviewHint | null
  extensionPoints: string[]
  validationChecks: ValidationCheck[]
  agentBrief: {
    summary: string
    firstMoves: string[]
  }
}

export interface ComposeReport {
  spec: ComposeSpec
  components: ComposeComponents
  variables: Record<string, unknown>
  fileOwnership: Record<string, string>
  validationChecks: ValidationCheck[]
  contextHints: Required<ContextHints>
}
