// catalog.ts — single source of truth for "what bundles exist".
//
// Two operating modes:
//
//   1. Filesystem mode (default, server-side): walks CATALOG_REGISTRY_PATH,
//      reading every manifest.json + (optionally) AGENTS.md / agents.json.
//      Used at build time or per-request from server components.
//
//   2. API mode (client-fallback): fetches a pre-built catalog snapshot from
//      CATALOG_API_URL. Use when the foundry repo isn't on the deploy target's
//      filesystem (Vercel, CF Pages).
//
// Both modes return the same `Bundle[]` shape so the rest of the UI is mode-
// agnostic.

import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface BundleTaxonomy {
  language: string
  runtime: string
  surface: string
}

export interface Bundle {
  /** stable id, matches the directory name under registry/families/ */
  id: string
  description: string
  tags: string[]
  taxonomy: BundleTaxonomy
  /**
   * AGENTS.md path relative to the bundle directory. Single-agent bundles
   * have one AGENTS.md at the root; multi-agent bundles have an orchestrator
   * AGENTS.md plus per-role AGENTS.md under roles/. We surface only the
   * orchestrator path here — the detail page can drill into agents.json.
   */
  agentsMdPath?: string
  /** True if the bundle has agents.json (multi-agent shape). */
  isMultiAgent: boolean
  /** Tier1 keywords — drives card-level "what does this do" badges. */
  tier1Keywords: string[]
  /**
   * Optional inline AGENTS.md body. Populated when callers ask the loader to
   * pre-read the markdown (avoids a separate fs roundtrip per detail view).
   */
  agentsMdBody?: string
  /** Inline agents.json contents (multi-agent only). */
  agentsJson?: Record<string, unknown>
}

interface RawManifest {
  id?: string
  description?: string
  tags?: string[]
  taxonomy?: Partial<BundleTaxonomy>
  files?: Array<{ source: string; target: string }>
  tieredKeywords?: { tier1?: string[] }
  defaults?: { team?: { agentsConfigPath?: string } }
}

function isManifest(value: unknown): value is RawManifest {
  return typeof value === 'object' && value !== null
}

function deriveAgentsMdPath(manifest: RawManifest): string | undefined {
  const file = manifest.files?.find((f) => f.target === 'AGENTS.md')
  return file?.target
}

function deriveIsMultiAgent(manifest: RawManifest): boolean {
  if (manifest.defaults?.team?.agentsConfigPath) return true
  return manifest.files?.some((f) => f.target === 'agents.json') ?? false
}

function bundleFromManifest(manifest: RawManifest): Bundle | null {
  if (!manifest.id || !manifest.description || !Array.isArray(manifest.tags)) return null
  const taxonomy: BundleTaxonomy = {
    language: manifest.taxonomy?.language ?? 'unknown',
    runtime: manifest.taxonomy?.runtime ?? 'unknown',
    surface: manifest.taxonomy?.surface ?? 'unknown',
  }
  return {
    id: manifest.id,
    description: manifest.description,
    tags: manifest.tags,
    taxonomy,
    agentsMdPath: deriveAgentsMdPath(manifest),
    isMultiAgent: deriveIsMultiAgent(manifest),
    tier1Keywords: manifest.tieredKeywords?.tier1 ?? [],
  }
}

/**
 * Load every bundle from the on-disk registry. `registryPath` should point at
 * the `registry/families/` directory.
 */
export async function loadCatalog(registryPath: string): Promise<Bundle[]> {
  const entries = await fs.readdir(registryPath, { withFileTypes: true })
  const bundles: Bundle[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue
    const manifestPath = path.join(registryPath, entry.name, 'manifest.json')
    let raw: string
    try {
      raw = await fs.readFile(manifestPath, 'utf8')
    } catch {
      continue
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      continue
    }
    if (!isManifest(parsed)) continue
    const bundle = bundleFromManifest(parsed)
    if (bundle) bundles.push(bundle)
  }
  // Stable order: agent-runtime first, then multi-agent, then everything else,
  // alphabetised within each group. Easier scanning for end users.
  bundles.sort((a, b) => {
    const groupA = groupRank(a)
    const groupB = groupRank(b)
    if (groupA !== groupB) return groupA - groupB
    return a.id.localeCompare(b.id)
  })
  return bundles
}

function groupRank(b: Bundle): number {
  if (b.id.startsWith('agent-runtime-')) return 0
  if (b.id.startsWith('multi-agent-')) return 1
  if (b.taxonomy.surface.includes('ui')) return 2
  return 3
}

/**
 * Hydrate a single bundle's AGENTS.md (and agents.json if multi-agent). Useful
 * for the detail page; avoids loading every bundle's markdown upfront.
 */
export async function loadBundleDetail(
  registryPath: string,
  bundleId: string,
): Promise<Bundle | null> {
  // Convention: directory name matches manifest id. Verified by
  // scripts/validate-registry.ts on every PR.
  const manifestPath = path.join(registryPath, bundleId, 'manifest.json')
  let manifestRaw: string
  try {
    manifestRaw = await fs.readFile(manifestPath, 'utf8')
  } catch {
    return null
  }
  let manifest: unknown
  try {
    manifest = JSON.parse(manifestRaw)
  } catch {
    return null
  }
  if (!isManifest(manifest)) return null
  const base = bundleFromManifest(manifest)
  if (!base) return null
  const bundleDir = path.join(registryPath, bundleId, 'files')

  let agentsMdBody: string | undefined
  if (base.agentsMdPath) {
    try {
      agentsMdBody = await fs.readFile(path.join(bundleDir, 'AGENTS.md'), 'utf8')
    } catch {
      // bundle declares AGENTS.md in manifest but file missing — surface as
      // undefined so the UI shows a "no AGENTS.md found" affordance rather
      // than crashing.
    }
  }

  let agentsJson: Record<string, unknown> | undefined
  if (base.isMultiAgent) {
    try {
      const text = await fs.readFile(path.join(bundleDir, 'agents.json'), 'utf8')
      const parsed = JSON.parse(text) as unknown
      if (parsed && typeof parsed === 'object') {
        agentsJson = parsed as Record<string, unknown>
      }
    } catch {
      // multi-agent flag was inferred from manifest but agents.json missing;
      // continue without it.
    }
  }

  return { ...base, agentsMdBody, agentsJson }
}

/**
 * Resolve the catalog source from environment. Server components call this
 * once; client components receive `Bundle[]` from server props.
 */
export function resolveRegistryPath(): string {
  const fromEnv = process.env.CATALOG_REGISTRY_PATH
  if (!fromEnv) {
    throw new Error(
      'CATALOG_REGISTRY_PATH is not set. Point it at the registry/families ' +
        'directory of a starter-foundry checkout, or set CATALOG_API_URL to ' +
        'use a JSON snapshot.',
    )
  }
  return path.resolve(fromEnv)
}
