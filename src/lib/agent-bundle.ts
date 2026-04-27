/**
 * Agent bundle loader + Tangle Sandbox `AgentProfile` translator.
 *
 * A "bundle" is a directory holding an `agent.json` plus the markdown system
 * prompts and methodology files referenced from it. The deploy script reads
 * the bundle, validates against `registry/_schemas/agent.schema.json`, then:
 *
 * 1. Translates the bundle-side shape into the SDK's portable `AgentProfile`
 *    (consumed as `backend.profile` by the sandbox runtime — used for the
 *    full-replacement system prompt, subagent profiles, model defaults, etc).
 * 2. Emits harness-native workspace files at `<workspace.root>` (default
 *    `/home/agent`): `AGENTS.md` (auto-loaded by every supported harness —
 *    OpenCode, Claude Code, Hermes, Codex, Amp, Kimi-Code), and — for
 *    multi-agent bundles only — `agents.json` (OpenCode subagent definitions).
 *    Plus every entry from `resources.files[]`.
 *
 * `AGENTS.md` and `agents.json` are auto-discovered by the in-sandbox harness
 * (see `apps/sidecar/src/agents/base-agent.ts:170` and
 * `apps/sidecar/src/agents/subagents/load-agents-config.ts`). The bundle's
 * job is to put them where the harness expects them.
 *
 * @public
 */
import { readFile, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// --- Types ----------------------------------------------------------------

/**
 * Permission policy for a runtime capability.
 * Mirrors `AgentProfilePermissionValue` in `@tangle-network/sandbox`.
 */
export type AgentPermission = 'allow' | 'ask' | 'deny'

/**
 * Default sandbox workspace root. Matches the harness convention
 * (`AGENT_WORKSPACE_ROOT=/home/agent` per
 * `apps/sidecar/src/constants.ts`).
 */
export const DEFAULT_WORKSPACE_ROOT = '/home/agent'

/**
 * A single resource file (or directory) to materialise inside the sandbox.
 */
export interface BundleResource {
  /** Path relative to the bundle root. May be a file or a directory. */
  source: string
  /**
   * Path inside the sandbox. If relative, treated as relative to the
   * resolved workspace root. Defaults to `<workspace.root>/<source>` when
   * omitted.
   */
  target?: string
}

/**
 * Bundle-side subagent declaration. Translates to:
 *  - `AgentProfile.subagents[id]` (SDK side)
 *  - one entry in the emitted `<workspace.root>/agents.json` (harness side)
 */
export interface SubagentBundle {
  description?: string
  systemPromptFile: string
  model?: string
  tools?: Record<string, boolean>
  permissions?: Record<string, AgentPermission>
  temperature?: number
  maxSteps?: number
}

/**
 * The complete bundle-side agent spec stored in `agent.json`.
 */
export interface AgentBundleProfile {
  name: string
  description?: string
  version: string
  tags?: string[]
  workspace?: {
    root?: string
  }
  prompt: {
    systemPromptFile?: string
    instructions?: string[]
  }
  model?: {
    preferred?: string
    fallback?: string[]
  }
  tools?: Record<string, boolean>
  permissions?: Record<string, AgentPermission>
  mcp?: Record<string, unknown>
  subagents?: Record<string, SubagentBundle>
  resources?: {
    files?: BundleResource[]
  }
}

// --- Translator target (AgentProfile mirror) ------------------------------

/**
 * Local mirror of the SDK's portable `AgentProfile`.
 *
 * We mirror — rather than import — the shape so this library has no hard
 * runtime dependency on `@tangle-network/sandbox`. The deploy script casts
 * the result to the SDK type at the call site; if the SDK shape drifts the
 * cast surfaces the issue at the boundary.
 *
 * @public
 */
export interface AgentProfileMirror {
  name?: string
  description?: string
  version?: string
  tags?: string[]
  prompt?: {
    systemPrompt?: string
    instructions?: string[]
  }
  model?: {
    default?: string
    metadata?: Record<string, unknown>
  }
  tools?: Record<string, boolean>
  permissions?: Record<string, AgentPermission>
  mcp?: Record<string, unknown>
  subagents?: Record<string, AgentSubagentProfileMirror>
  resources?: {
    files?: AgentProfileFileMountMirror[]
  }
  metadata?: Record<string, unknown>
}

export interface AgentSubagentProfileMirror {
  description?: string
  prompt?: string
  model?: string
  tools?: Record<string, boolean>
  permissions?: Record<string, AgentPermission>
  maxSteps?: number
}

export interface AgentProfileFileMountMirror {
  path: string
  resource:
    | { kind: 'inline'; name: string; content: string }
    | { kind: 'github'; path: string; ref?: string; name?: string }
  executable?: boolean
}

/**
 * One file the deploy script must `box.files.write` into the sandbox.
 *
 * Distinct from `AgentProfileFileMountMirror`: workspace files are the
 * harness-native artefacts (AGENTS.md, agents.json, methodology/*) emitted
 * verbatim — not declared on the AgentProfile.
 *
 * @public
 */
export interface WorkspaceFile {
  /** Absolute path inside the sandbox. */
  targetPath: string
  /** UTF-8 string content (binary file copies are not currently supported). */
  content: string
}

/**
 * Shape of a single entry in the OpenCode `agents.json` file.
 *
 * Verified against `apps/sidecar/agents.json` and
 * `apps/sidecar/src/agents/subagents/load-agents-config.ts`. Keys are the
 * harness contract — not invented here.
 *
 * @public
 */
export interface OpenCodeSubagentConfig {
  mode: 'subagent'
  description?: string
  prompt: string
  temperature?: number
  tools?: Record<string, boolean>
  permission?: Record<string, AgentPermission>
}

// --- Schema validation (minimal, matches scripts/validate-registry.ts) ---

interface SchemaNode {
  type?: string | string[]
  enum?: unknown[]
  required?: string[]
  properties?: Record<string, SchemaNode>
  additionalProperties?: boolean | SchemaNode
  items?: SchemaNode
  minimum?: number
  pattern?: string
}

function validateAgainst(value: unknown, schema: SchemaNode, path = '$'): string[] {
  const errors: string[] = []
  if (schema.type) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type]
    const actual = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value
    if (!expected.includes(actual)) {
      errors.push(`${path}: expected ${expected.join('|')}, got ${actual}`)
      return errors
    }
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} not in enum`)
  }
  if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum) {
    errors.push(`${path}: ${value} < minimum ${schema.minimum}`)
  }
  if (schema.required && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    for (const req of schema.required) {
      if (!(req in (value as Record<string, unknown>))) {
        errors.push(`${path}.${req}: required field missing`)
      }
    }
  }
  if (schema.properties && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const propSchema = schema.properties[k]
      if (propSchema) {
        errors.push(...validateAgainst(v, propSchema, `${path}.${k}`))
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}.${k}: unexpected property (additionalProperties=false)`)
      } else if (
        typeof schema.additionalProperties === 'object' &&
        schema.additionalProperties !== null
      ) {
        errors.push(...validateAgainst(v, schema.additionalProperties, `${path}.${k}`))
      }
    }
  }
  if (schema.items && Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      errors.push(...validateAgainst(value[i], schema.items, `${path}[${i}]`))
    }
  }
  return errors
}

let cachedSchema: SchemaNode | undefined
async function loadSchema(): Promise<SchemaNode> {
  if (cachedSchema) return cachedSchema
  // The schema lives at registry/_schemas/agent.schema.json relative to the
  // package root. Resolve from this module's own location so the loader is
  // usable from both src/ (tsx) and dist/ (built).
  const here = dirname(fileURLToPath(import.meta.url))
  // From src/lib/agent-bundle.ts → repo root is two up. From dist/lib/* → also two up.
  const schemaPath = resolve(here, '..', '..', 'registry', '_schemas', 'agent.schema.json')
  const raw = await readFile(schemaPath, 'utf8')
  cachedSchema = JSON.parse(raw) as SchemaNode
  return cachedSchema
}

// --- Loader ---------------------------------------------------------------

/**
 * Read `agent.json` from a bundle directory and validate it.
 *
 * @public
 * @throws when agent.json is missing, unparseable, or fails schema validation
 */
export async function loadAgentBundle(bundleDir: string): Promise<AgentBundleProfile> {
  const manifestPath = join(bundleDir, 'agent.json')
  let raw: string
  try {
    raw = await readFile(manifestPath, 'utf8')
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`agent.json not readable at ${manifestPath}: ${reason}`, { cause: err })
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`agent.json at ${manifestPath} is not valid JSON: ${reason}`, { cause: err })
  }
  const schema = await loadSchema()
  const errors = validateAgainst(parsed, schema, 'agent')
  if (errors.length > 0) {
    throw new Error(
      `agent.json at ${manifestPath} failed schema validation:\n  ${errors.join('\n  ')}`,
    )
  }
  return parsed as AgentBundleProfile
}

/**
 * Read the system prompt content referenced by the bundle.
 *
 * Returns an empty string when the bundle declares no `systemPromptFile`.
 *
 * @public
 * @throws when the file is declared but cannot be read
 */
export async function resolveSystemPrompt(
  bundle: AgentBundleProfile,
  bundleDir: string,
): Promise<string> {
  const file = bundle.prompt.systemPromptFile
  if (!file) return ''
  const abs = isAbsolute(file) ? file : join(bundleDir, file)
  return readFile(abs, 'utf8')
}

/**
 * Resolve the workspace root from a bundle, falling back to the harness
 * default (`/home/agent`).
 *
 * @public
 */
export function resolveWorkspaceRoot(bundle: AgentBundleProfile): string {
  return bundle.workspace?.root ?? DEFAULT_WORKSPACE_ROOT
}

// --- Translator -----------------------------------------------------------

interface ResolvedFileMount {
  path: string
  source: string
  content: string
}

/**
 * Walk a `BundleResource` (file or directory) and produce one inline-resource
 * mount per file. Directories are walked recursively.
 *
 * Target paths normalise to absolute sandbox paths under the workspace root.
 */
async function resolveResource(
  resource: BundleResource,
  bundleDir: string,
  workspaceRoot: string,
): Promise<ResolvedFileMount[]> {
  const sourceAbs = isAbsolute(resource.source) ? resource.source : join(bundleDir, resource.source)
  const stats = await stat(sourceAbs)
  const targetRoot = resource.target
    ? isAbsolute(resource.target)
      ? resource.target
      : join(workspaceRoot, resource.target)
    : join(workspaceRoot, resource.source)

  if (stats.isFile()) {
    const content = await readFile(sourceAbs, 'utf8')
    return [{ path: targetRoot, source: sourceAbs, content }]
  }
  if (stats.isDirectory()) {
    const out: ResolvedFileMount[] = []
    const { readdir } = await import('node:fs/promises')
    const entries = await readdir(sourceAbs, { withFileTypes: true, recursive: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      // Node 20.12+: parentPath; older fall back to path. Tolerate both.
      const parent =
        (entry as unknown as { parentPath?: string }).parentPath ??
        (entry as unknown as { path?: string }).path ??
        sourceAbs
      const fileAbs = join(parent, entry.name)
      const rel = relative(sourceAbs, fileAbs)
      const content = await readFile(fileAbs, 'utf8')
      out.push({
        path: join(targetRoot, rel),
        source: fileAbs,
        content,
      })
    }
    return out
  }
  throw new Error(`resource source ${sourceAbs} is neither file nor directory`)
}

/**
 * Translate an `AgentBundleProfile` into the SDK's portable `AgentProfile`.
 *
 * Inlines:
 * - `prompt.systemPromptFile` content into `prompt.systemPrompt`
 * - subagent `systemPromptFile` content into each `subagents[id].prompt`
 * - every `resources.files[]` entry (recursively, when source is a directory)
 *   as an inline file mount under the resolved sandbox target path
 *
 * @public
 */
export async function toAgentProfile(
  bundle: AgentBundleProfile,
  bundleDir: string,
): Promise<AgentProfileMirror> {
  const workspaceRoot = resolveWorkspaceRoot(bundle)
  const systemPrompt = await resolveSystemPrompt(bundle, bundleDir)

  const resolvedSubagents: Record<string, AgentSubagentProfileMirror> = {}
  if (bundle.subagents) {
    for (const [id, sub] of Object.entries(bundle.subagents)) {
      const promptAbs = isAbsolute(sub.systemPromptFile)
        ? sub.systemPromptFile
        : join(bundleDir, sub.systemPromptFile)
      const subPrompt = await readFile(promptAbs, 'utf8')
      resolvedSubagents[id] = {
        ...(sub.description !== undefined ? { description: sub.description } : {}),
        prompt: subPrompt,
        ...(sub.model !== undefined ? { model: sub.model } : {}),
        ...(sub.tools ? { tools: sub.tools } : {}),
        ...(sub.permissions ? { permissions: sub.permissions } : {}),
        ...(sub.maxSteps !== undefined ? { maxSteps: sub.maxSteps } : {}),
      }
    }
  }

  const fileMounts: AgentProfileFileMountMirror[] = []
  for (const resource of bundle.resources?.files ?? []) {
    const resolved = await resolveResource(resource, bundleDir, workspaceRoot)
    for (const mount of resolved) {
      const name = relative(bundleDir, mount.source) || mount.path
      fileMounts.push({
        path: mount.path,
        resource: { kind: 'inline', name, content: mount.content },
      })
    }
  }

  const profile: AgentProfileMirror = {
    name: bundle.name,
    ...(bundle.description !== undefined ? { description: bundle.description } : {}),
    version: bundle.version,
    ...(bundle.tags ? { tags: bundle.tags } : {}),
    ...(systemPrompt || bundle.prompt.instructions
      ? {
          prompt: {
            ...(systemPrompt ? { systemPrompt } : {}),
            ...(bundle.prompt.instructions ? { instructions: bundle.prompt.instructions } : {}),
          },
        }
      : {}),
    ...(bundle.model?.preferred || bundle.model?.fallback
      ? {
          model: {
            ...(bundle.model.preferred ? { default: bundle.model.preferred } : {}),
            ...(bundle.model.fallback ? { metadata: { fallback: bundle.model.fallback } } : {}),
          },
        }
      : {}),
    ...(bundle.tools ? { tools: bundle.tools } : {}),
    ...(bundle.permissions ? { permissions: bundle.permissions } : {}),
    ...(bundle.mcp ? { mcp: bundle.mcp } : {}),
    ...(Object.keys(resolvedSubagents).length > 0 ? { subagents: resolvedSubagents } : {}),
    ...(fileMounts.length > 0 ? { resources: { files: fileMounts } } : {}),
  }

  return profile
}

// --- Workspace-file emit (harness-native) ---------------------------------

/**
 * Build the OpenCode-shape `agents.json` content for a multi-agent bundle.
 *
 * Shape verified against `apps/sidecar/agents.json` (the canonical example
 * shipped with the sidecar) and `load-agents-config.ts`:
 *
 *   { <subagent-id>: { mode, description, prompt, temperature?, tools?, permission? } }
 *
 * The prompt is INLINE (full markdown content), not a path. `permission`
 * is singular per the harness contract, even though the bundle-side spec
 * uses plural `permissions` (we translate at the boundary).
 */
async function buildOpenCodeAgentsJson(
  bundle: AgentBundleProfile,
  bundleDir: string,
): Promise<string> {
  const out: Record<string, OpenCodeSubagentConfig> = {}
  for (const [id, sub] of Object.entries(bundle.subagents ?? {})) {
    const promptAbs = isAbsolute(sub.systemPromptFile)
      ? sub.systemPromptFile
      : join(bundleDir, sub.systemPromptFile)
    const promptContent = await readFile(promptAbs, 'utf8')
    const entry: OpenCodeSubagentConfig = {
      mode: 'subagent',
      ...(sub.description !== undefined ? { description: sub.description } : {}),
      prompt: promptContent,
      ...(sub.temperature !== undefined ? { temperature: sub.temperature } : {}),
      ...(sub.tools ? { tools: sub.tools } : {}),
      ...(sub.permissions ? { permission: sub.permissions } : {}),
    }
    out[id] = entry
  }
  return JSON.stringify(out, null, 2) + '\n'
}

/**
 * Compute the list of files the deploy script must `box.files.write`
 * into the sandbox at `<workspace.root>`:
 *
 * - `<workspace.root>/AGENTS.md`   — orchestrator system prompt
 *                                    (auto-loaded by the harness)
 * - `<workspace.root>/agents.json` — multi-agent bundles only;
 *                                    OpenCode subagent definitions
 *                                    (auto-loaded by `loadAgentsConfig`)
 * - One file per `resources.files[]` entry, target defaulting to
 *   `<workspace.root>/<source>` when not specified.
 *
 * Single-agent bundles do NOT emit `agents.json`. Their orchestrator
 * prompt is the AGENTS.md content (also pushed via the SDK
 * `AgentProfile.prompt.systemPrompt` for a full-replacement system
 * prompt — equivalent content, two delivery channels).
 *
 * @public
 */
export async function toWorkspaceFiles(
  bundle: AgentBundleProfile,
  bundleDir: string,
): Promise<WorkspaceFile[]> {
  const workspaceRoot = resolveWorkspaceRoot(bundle)
  const out: WorkspaceFile[] = []

  // 1. AGENTS.md — orchestrator system prompt at the workspace root
  const systemPromptContent = await resolveSystemPrompt(bundle, bundleDir)
  if (systemPromptContent) {
    out.push({
      targetPath: join(workspaceRoot, 'AGENTS.md'),
      content: systemPromptContent,
    })
  }

  // 2. agents.json — multi-agent bundles only
  if (bundle.subagents && Object.keys(bundle.subagents).length > 0) {
    const agentsJson = await buildOpenCodeAgentsJson(bundle, bundleDir)
    out.push({
      targetPath: join(workspaceRoot, 'agents.json'),
      content: agentsJson,
    })
  }

  // 3. resources.files[] — methodology/, README.md, role assets, etc.
  for (const resource of bundle.resources?.files ?? []) {
    const resolved = await resolveResource(resource, bundleDir, workspaceRoot)
    for (const mount of resolved) {
      out.push({ targetPath: mount.path, content: mount.content })
    }
  }

  return out
}
