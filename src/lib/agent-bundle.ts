/**
 * Agent bundle loader + Tangle Sandbox `AgentProfile` translator.
 *
 * A "bundle" is a directory holding an `agent.json` plus the markdown system
 * prompts and methodology files referenced from it. The deploy script reads
 * the bundle, validates against `registry/_schemas/agent.schema.json`, then
 * translates the bundle-side shape into the SDK's portable `AgentProfile`
 * (which the sandbox runtime consumes as `backend.profile`).
 *
 * Architectural note: starter-foundry no longer wraps bundles in a custom
 * Vite/Hono server. Every Tangle sandbox already runs an OpenCode/Claude
 * agent loop (see `box.task()`); the bundle just configures it.
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
 * A single resource file (or directory) to materialise inside the sandbox.
 */
export interface BundleResource {
  /** Path relative to the bundle root. May be a file or a directory. */
  source: string
  /**
   * Path inside the sandbox. If relative, treated as relative to /workspace.
   * Defaults to `/workspace/<source>` when omitted.
   */
  target: string
}

/**
 * Bundle-side subagent declaration. Translates to `AgentSubagentProfile`.
 */
export interface SubagentBundle {
  description?: string
  systemPromptFile: string
  model?: string
  tools?: Record<string, boolean>
  permissions?: Record<string, AgentPermission>
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
 * Target paths normalise to absolute sandbox paths under `/workspace`.
 */
async function resolveResource(
  resource: BundleResource,
  bundleDir: string,
): Promise<ResolvedFileMount[]> {
  const sourceAbs = isAbsolute(resource.source) ? resource.source : join(bundleDir, resource.source)
  const stats = await stat(sourceAbs)
  const targetRoot = resource.target
    ? isAbsolute(resource.target)
      ? resource.target
      : join('/workspace', resource.target)
    : join('/workspace', resource.source)

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
    const resolved = await resolveResource(resource, bundleDir)
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
