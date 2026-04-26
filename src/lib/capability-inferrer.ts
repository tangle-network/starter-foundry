// Capability inferrer — the "what should we have attached?" library.
//
// Input signals:
//   - packages/dirs/files the agent added after receiving our scaffold
//     (from buildouts.jsonl — mined from real Claude Code sessions)
//   - registry/package-to-capability.json (curated mapping, not auto-derived
//     because capability layers don't ship their own package.json deps)
//
// Output:
//   - per-buildout "agent-inferred capabilities" with confidence
//   - per-(prompt, capability) aggregate: how often did an agent signal this
//     capability was needed, and how often did our router actually attach it?
//
// This is the measurement surface for the router-quality feedback loop. It
// does NOT train an LLM — that's a separate, later stage once we have
// enough (prompt, inferred-capability) pairs to justify AxGEPA.

import { readFileSync, existsSync } from 'node:fs'

interface PackageCapabilityMap {
  schemaVersion: 1
  mapping: Record<string, { capability: string | null; confidence: number; note?: string }>
}

interface BuildoutLike {
  sessionId: string
  initialPrompt: string | null
  scenarioId: string | null
  addedPackages?: { pm: string; name: string }[]
  addedDirs?: string[]
  outcome?: { allPass: boolean; blendedScore: number } | null
}

interface InferredCapability {
  capability: string
  confidence: number
  source: 'package' | 'dir'
  sourceToken: string
}

interface CapabilityMapSummary {
  distinctPackages: number
  mappedPackages: number
  unmappedPackages: number
  hasAmbiguous: boolean
}

/** Load the hand-curated package → capability map. */
export function loadCapabilityMap(
  path = 'registry/package-to-capability.json',
): PackageCapabilityMap {
  if (!existsSync(path)) {
    return { schemaVersion: 1, mapping: {} }
  }
  const raw = readFileSync(path, 'utf8')
  return JSON.parse(raw) as PackageCapabilityMap
}

/** Classify a single buildout into inferred capabilities. Pure function. */
export function inferCapabilities(
  buildout: BuildoutLike,
  map: PackageCapabilityMap,
): InferredCapability[] {
  const out: InferredCapability[] = []
  const seen = new Set<string>()

  for (const p of buildout.addedPackages ?? []) {
    const entry = map.mapping[p.name]
    if (!entry?.capability) continue
    const key = entry.capability
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      capability: entry.capability,
      confidence: entry.confidence,
      source: 'package',
      sourceToken: `${p.pm}:${p.name}`,
    })
  }

  // Directory hints — very coarse, only fire if the directory name matches
  // a clear domain signal. We're conservative; ambiguous dirs drop through.
  const DIR_TO_CAP: Record<string, { capability: string; confidence: number }> = {
    'src/payments': { capability: 'capability:saas-billing', confidence: 0.7 },
    'src/billing': { capability: 'capability:saas-billing', confidence: 0.7 },
    'src/auth': { capability: 'capability:layout-auth', confidence: 0.6 },
    'src/components/chat': { capability: 'capability:layout-chat', confidence: 0.6 },
    'src/chat': { capability: 'capability:ai-chat-ui', confidence: 0.6 },
    'src/dashboard': { capability: 'capability:layout-dashboard', confidence: 0.5 },
  }
  for (const d of buildout.addedDirs ?? []) {
    const entry = DIR_TO_CAP[d]
    if (!entry) continue
    if (seen.has(entry.capability)) continue
    seen.add(entry.capability)
    out.push({
      capability: entry.capability,
      confidence: entry.confidence,
      source: 'dir',
      sourceToken: d,
    })
  }

  return out
}

/** Summary stats over a mapping (for diagnostic CLIs / tests). */
export function summarizeMap(map: PackageCapabilityMap): CapabilityMapSummary {
  const entries = Object.entries(map.mapping)
  const mapped = entries.filter(([, e]) => e.capability !== null).length
  return {
    distinctPackages: entries.length,
    mappedPackages: mapped,
    unmappedPackages: entries.length - mapped,
    hasAmbiguous: false,
  }
}
