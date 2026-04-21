export interface FileEntry {
  source: string
  target: string
}

export interface MediaSlot {
  id: string
  path: string
  width: number
  height: number
  purpose: string
  prompt: string
  fallback: 'gradient' | 'icon' | 'initials' | 'text' | 'none'
  usedIn: string
}

export interface MediaManifest {
  slots: MediaSlot[]
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
  /** Flat keywords for prompt routing (legacy — prefer tieredKeywords). */
  keywords?: string[]
  /** Tiered keywords for weighted scoring. tier1 (4pts): framework names. tier2 (2pts): domain terms. tier3 (1pt): generic. archetypes (3pts): product patterns. */
  tieredKeywords?: {
    tier1?: string[]
    tier2?: string[]
    tier3?: string[]
    archetypes?: string[]
  }
  /** Scoring boosts: when a boost key (e.g. "go") co-occurs with an API term, add boost value to score. */
  scoring?: { boost?: Record<string, number> }
  /**
   * Domain-specific build guidance — first moves, gotchas, architecture
   * notes — written into the composed scaffold's AGENTS.md. Family-level
   * hints cover runtime-specific UX (e.g. "bun add" vs "pnpm add",
   * "deno.json tasks", "run wasm-pack first").
   */
  buildHints?: BuildHints
}

export interface LayerManifest extends ManifestBase {
  kind: 'layer'
  group: string
  slot?: string
  appliesTo?: string[]
  /** Keywords for capability auto-detection. detectCapabilities scores prompts against these. */
  keywords?: string[]
  /**
   * Tiered keywords (same shape as FamilyManifest.tieredKeywords). Capability
   * manifests use `tieredKeywords.archetypes` to declare their archetype
   * signal arrays — the single source of truth for `implicit-caps.ts` in
   * future; today it's enforced-parity with signals.ts arrays via a test.
   */
  tieredKeywords?: {
    tier1?: string[]
    tier2?: string[]
    tier3?: string[]
    archetypes?: string[]
  }
  /** Other capability IDs that must be present when this capability is attached. */
  capabilityRequires?: string[]
  /** Available variant directory names under variants/. When present, compose picks one deterministically. */
  variants?: string[]
  /** Concrete build suggestions for the AI agent when this capability is active. */
  buildHints?: BuildHints
  /**
   * Packages this layer contributes to the composed scaffold's root package.json.
   * Merged into the family's package.json at compose time so capability layers
   * can actually ship their runtime deps instead of scaffolding config files and
   * expecting the agent to figure out which package to install.
   *
   * Added 2026-04-20 in response to blueprint-agent bug report #4: agents were
   * installing snarkjs/circomlibjs 4× on zk-mixer-ui because no capability
   * layer had a way to declare deps.
   */
  packageDeps?: {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
}

export interface PartnerManifest extends ManifestBase {
  kind: 'partner'
  group: null
  appliesTo?: string[]
  slotDefaults?: Record<string, string>
  /**
   * Partner-specific agent guidance — which SDK to use, which env vars
   * to set, ecosystem gotchas. Written into composed scaffold's AGENTS.md.
   */
  buildHints?: BuildHints
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
  /** Original user prompt that generated this spec. Passed through to the AI agent context. */
  userPrompt?: string
}

export interface BuildPlan {
  goal: string
  architecture: string[]
  pages: string[]
  apiRoutes: string[]
  components: string[]
  dataModels: string[]
  integrations: string[]
  firstMoves: string[]
  /**
   * Domain-specific first moves declared by manifests (family + attached
   * capability layers + partner). Each entry is attributed to its source
   * (e.g. `family:bun-http: Use bun add not pnpm add`). Rendered in
   * AGENTS.md as '## Domain first moves'.
   */
  domainFirstSteps: Array<{ source: string; step: string }>
  /**
   * Runtime-specific traps from manifest buildHints. Rendered in
   * AGENTS.md as '## Gotchas' so an agent sees them before hitting them.
   */
  domainGotchas: Array<{ source: string; note: string }>
  /**
   * Default/placeholder files the agent MUST replace with product-specific
   * content (blueprint-agent Gen 27 finding #6). Rendered in AGENTS.md as
   * '## Placeholders — MUST replace'.
   */
  placeholders: Array<{ source: string; path: string; description: string }>
  /** Natural-language design directives for the AI agent. Not CSS — English rules about aesthetics. */
  designDirective: string | null
  /** shadcn preset code for `pnpm dlx shadcn@latest init --preset <code>` */
  presetCode?: string | null
  /** Vision statement (2-4 sentences) — only populated when a product brief was generated. */
  vision?: string
  /** Ordered major phases with success criteria. Populated from product brief. */
  milestones?: string[]
  /** Unit/integration test plan items. Populated from product brief. */
  testingPlan?: string[]
  /** End-to-end user-journey coverage items. Populated from product brief. */
  e2ePlan?: string[]
  /** Red-team / audit surface concerns. Populated from product brief. */
  securityConcerns?: string[]
  /** Things the user should clarify. Populated from product brief. */
  openQuestions?: string[]
}

export interface BuildHints {
  pages?: string[]
  apiRoutes?: string[]
  components?: string[]
  dataModels?: string[]
  integrations?: string[]
  architectureNotes?: string[]
  /**
   * Domain-specific first moves an agent should make on this scaffold.
   * Rendered as `## First moves` in AGENTS.md. Write concrete commands +
   * file paths, not generic "familiarize yourself with the code" advice.
   * Example (bun-http): "Use `bun add` not `pnpm add` for deps".
   */
  firstSteps?: string[]
  /**
   * Non-obvious traps specific to this runtime/stack. Rendered as
   * `## Gotchas` in AGENTS.md. Each entry should name the failure mode
   * + the fix. Not general "be careful" advice.
   * Example (wasm-rust): "Proving keys are multi-MB — gitignore pkg/ and
   * host the .wasm under public/ so Vite serves it."
   */
  gotchas?: string[]
  /**
   * One sentence on WHY an agent attaches or uses this surface.
   * Rendered as the intro line of relevant AGENTS.md sections.
   */
  whenToUse?: string
  /**
   * Scaffold files that ship DEFAULT / PLACEHOLDER content — the agent must
   * replace them with product-specific behavior, not treat them as working
   * infrastructure. Blueprint-agent Gen 27 finding #6: 4/5 failing sessions
   * left default KPI dashboards unchanged because AGENTS.md didn't name them.
   *
   * Each entry is `{path, description}` — the path is relative to the
   * composed scaffold root; description names what the default renders and
   * what the agent should replace it with.
   *
   * Example (nextjs-ts):
   * [{ path: 'app/dashboard/page.tsx', description: 'Default KPI cards
   *   (Revenue, Users). Replace with the product's primary view.' }]
   */
  placeholders?: Array<{ path: string; description: string }>
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
  /** Opaque product brief object attached when planPrompt was called with brief: true. */
  brief?: unknown
}

export interface WorkspacePromptPlan {
  kind: 'workspace'
  confidence: Confidence
  reasons: string[]
  spec: WorkspaceSpec
  /** Opaque product brief object attached when planPrompt was called with brief: true. */
  brief?: unknown
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
  /**
   * Per-family prompt fragment — a concatenated string of any
   * `registry/families/<id>/prompt-fragment.md` (family) +
   * `registry/partners/<id>/prompt-fragment.md` (partner). Consumers
   * (blueprint-agent etc.) can splice this into their own system prompt
   * without reading the registry directly. Empty string when no family/
   * partner ships a fragment.
   */
  promptFragment: string
  /**
   * Path to the composed SBOM (CycloneDX 1.5). null if the scaffold has
   * no manifested deps (e.g. Go/Rust without Cargo.toml). Consumers feed
   * this to supply-chain scanners.
   */
  sbomPath: string | null
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
  buildPlan?: BuildPlan
  userPrompt?: string | null
}

export interface ComposeReport {
  spec: ComposeSpec
  components: ComposeComponents
  variables: Record<string, unknown>
  fileOwnership: Record<string, string>
  validationChecks: ValidationCheck[]
  contextHints: Required<ContextHints>
}
