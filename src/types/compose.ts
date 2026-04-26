// Compose + build-plan + workspace types — what the composer accepts as
// input (ComposeSpec, WorkspaceSpec) and produces as output (ComposeResult,
// ComposeReport, BuildPlan).

import type { ContextHints, ValidationCheck } from './registry.js'

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
   * `registry/partners/<id>/prompt-fragment.md` (partner).
   */
  promptFragment: string
  /**
   * Path to the composed SBOM (CycloneDX 1.5). null if the scaffold has
   * no manifested deps (e.g. Go/Rust without Cargo.toml).
   */
  sbomPath: string | null
}

export interface ComposeReport {
  spec: ComposeSpec
  components: ComposeComponents
  variables: Record<string, unknown>
  fileOwnership: Record<string, string>
  validationChecks: ValidationCheck[]
  contextHints: Required<ContextHints>
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
   * capability layers + partner). Each entry is attributed to its source.
   */
  domainFirstSteps: { source: string; step: string }[]
  /** Runtime-specific traps from manifest buildHints. */
  domainGotchas: { source: string; note: string }[]
  /** Default/placeholder files the agent MUST replace with product-specific content. */
  placeholders: { source: string; path: string; description: string }[]
  /** Natural-language design directives for the AI agent. Not CSS — English rules about aesthetics. */
  designDirective: string | null
  /** shadcn preset code for `pnpm dlx shadcn@latest init --preset <code>` */
  presetCode?: string | null
  /** Vision statement (2-4 sentences) — only populated when a product brief was generated. */
  vision?: string
  /** Ordered major phases with success criteria. */
  milestones?: string[]
  /** Unit/integration test plan items. */
  testingPlan?: string[]
  /** End-to-end user-journey coverage items. */
  e2ePlan?: string[]
  /** Red-team / audit surface concerns. */
  securityConcerns?: string[]
  /** Things the user should clarify. */
  openQuestions?: string[]
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
