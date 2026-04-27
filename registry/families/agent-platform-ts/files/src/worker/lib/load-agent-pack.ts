// load-agent-pack — reads agent markdown packs at runtime.
//
// In Cloudflare Workers there is no filesystem. Agent packs are bundled
// at BUILD time via Vite's `import.meta.glob` (eager) and exposed here
// as a static map keyed by pack id. Locally the same map is populated;
// in dev `vite build` runs once before `wrangler dev` (or via a watcher).
//
// To add a pack:
//   1. Create <AGENT_PACK_DIR>/<id>/system-prompt.md
//   2. Create <AGENT_PACK_DIR>/<id>/methodology/index.json
//   3. Re-build (the worker reload will pick it up automatically)

import { z } from 'zod'

// A loaded, validated agent pack ready for use by /api/chat.
export interface AgentPack {
  id: string
  name: string
  description: string
  /** Frontmatter tags from system-prompt.md. */
  tags: string[]
  /** Recommended LLM model — the route can override. */
  model: string
  systemPrompt: string
  methodology: MethodologyIndex
}

const MethodologyIndex = z.object({
  version: z.literal(1),
  /** Ordered list of methodology guides — names of files relative to
   * methodology/. Each guide is a markdown file the agent can pull
   * into context on demand. */
  guides: z.array(
    z.object({
      slug: z.string().regex(/^[a-z0-9-]+$/),
      title: z.string(),
      summary: z.string(),
      path: z.string(),
    }),
  ),
})
type MethodologyIndex = z.infer<typeof MethodologyIndex>

// --- Pack registry ---
//
// `import.meta.glob` is a Vite primitive that lets us discover every pack
// at build time. Cloudflare's Workers + assets pipeline runs `vite build`
// for the client; the worker is built separately by wrangler — so we
// surface the same glob via a small helper that supports both paths.
//
// HOWEVER: wrangler doesn't run Vite. The pattern below has wrangler
// statically import every system-prompt.md / index.json pair. Operators
// MUST add a new pack by editing PACK_REGISTRY below — the alternative
// (filesystem reads in the worker) doesn't exist on workerd.

interface PackBundle {
  systemPrompt: string
  methodology: unknown
  meta: {
    name?: string
    description?: string
    tags?: string[]
    model?: string
  }
}

// PLACEHOLDER REGISTRY — operators MUST edit this when adding a pack.
// The default pack (id: "default") demonstrates the wire-format. To add
// "support-bot":
//   import supportSystem from '../../../agents/support-bot/system-prompt.md?raw'
//   import supportMethod from '../../../agents/support-bot/methodology/index.json'
//   PACK_REGISTRY.set('support-bot', { systemPrompt: supportSystem, methodology: supportMethod, meta: { name: 'Support Bot', description: '...', tags: ['support'], model: 'gpt-4o-mini' } })
//
// This is intentionally NOT auto-discovery: operators choose which packs
// ship in each deploy, and the build artifact reflects that choice
// explicitly.
const PACK_REGISTRY = new Map<string, PackBundle>()

// Frontmatter parser — minimal YAML-like for the small set of keys the
// platform reads (name, description, tags, model). Anything more involved
// belongs in a dedicated parser; this avoids a yaml dependency in the
// hot path.
function parseFrontmatter(md: string): { meta: PackBundle['meta']; body: string } {
  if (!md.startsWith('---\n')) return { meta: {}, body: md }
  const end = md.indexOf('\n---\n', 4)
  if (end < 0) return { meta: {}, body: md }
  const yaml = md.slice(4, end)
  const body = md.slice(end + 5)
  const meta: PackBundle['meta'] = {}
  for (const line of yaml.split('\n')) {
    const m = /^([a-zA-Z_]+):\s*(.+)$/.exec(line)
    if (!m) continue
    const [, key, raw] = m
    const value = raw!.trim()
    if (key === 'name') meta.name = stripQuotes(value)
    else if (key === 'description') meta.description = stripQuotes(value)
    else if (key === 'model') meta.model = stripQuotes(value)
    else if (key === 'tags') {
      // [a, b, c] OR a,b,c
      const inner = value.replace(/^\[|\]$/g, '')
      meta.tags = inner.split(',').map((s) => stripQuotes(s.trim())).filter(Boolean)
    }
  }
  return { meta, body }
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  return s
}

/** Register a pack at module-load time — called from the per-pack imports
 * the operator wires. Exported so tests can stub packs without touching
 * the filesystem. */
export function registerPack(id: string, bundle: PackBundle): void {
  PACK_REGISTRY.set(id, bundle)
}

/** Test helper — wipe and re-seed registrations. */
export function _resetPacksForTest(): void {
  PACK_REGISTRY.clear()
}

export function listPackIds(): string[] {
  return [...PACK_REGISTRY.keys()].sort()
}

/** Load and validate a single pack. Throws if the id is unknown or the
 * methodology index fails schema validation. */
export function loadAgentPack(id: string): AgentPack {
  const bundle = PACK_REGISTRY.get(id)
  if (!bundle) throw Object.assign(new Error(`unknown agent pack: ${id}`), { status: 404 })
  const { meta, body } = parseFrontmatter(bundle.systemPrompt)
  const merged = { ...meta, ...bundle.meta }
  const methodology = MethodologyIndex.parse(bundle.methodology)
  return {
    id,
    name: merged.name ?? id,
    description: merged.description ?? '',
    tags: merged.tags ?? [],
    model: merged.model ?? 'gpt-4o-mini',
    systemPrompt: body,
    methodology,
  }
}

export function listAgentPacks(): AgentPack[] {
  return listPackIds().map((id) => loadAgentPack(id))
}
