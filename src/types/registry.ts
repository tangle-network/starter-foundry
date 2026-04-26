// Registry types — manifests, validation checks, the in-memory Registry.
// Anything the loader produces or the composer consumes from registry/.

import type { CapabilityId, LayerId } from './ids.js'

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
  | 'prompt-frontmatter-valid'
  | 'cron-syntax-valid'
  | 'template-index-valid'
  | 'agents-md-valid'
  | 'methodology-index-valid'
  | 'schedule-valid'

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
   * infrastructure. Each entry is `{path, description}` — the path is
   * relative to the composed scaffold root; description names what the
   * default renders and what the agent should replace it with.
   */
  placeholders?: { path: string; description: string }[]
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
  /**
   * Layer IDs to additively stack on every compose of this family —
   * bypasses the slot mechanism. Use when the bundle wants multiple
   * additional layers without needing N single-option slots (the
   * agent-runtime tool-kit case: every bundle adds tangle-base + an
   * arbitrary subset of tool kits + structured-output, no slot per kit).
   * Format: `<group>:<id>` matching the layer registry.
   */
  includes?: LayerId[]
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
   * notes — written into the composed scaffold's AGENTS.md.
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
   * signal arrays.
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
   */
  packageDeps?: {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  /**
   * Capabilities this layer provides. Conflicts when two stacked layers
   * provide the same capability — composer rejects unless the spec
   * explicitly disambiguates. Format: `<scope>:<name>` or `<name>`.
   */
  provides?: CapabilityId[]
  /**
   * Capabilities this layer needs from the stack. Composer topo-sorts
   * so providers run before requirers; missing capabilities fail loud
   * at compose time with the specific name that's unsatisfied.
   */
  requires?: CapabilityId[]
  /**
   * Capabilities or layer IDs this layer is incompatible with. Compose
   * rejects spec if a conflicting layer or capability is also stacked.
   */
  conflictsWith?: CapabilityId[]
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
