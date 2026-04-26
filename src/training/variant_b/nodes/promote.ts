// promote node: takes top ranked candidates that passed the judge and writes
// them as minimal capability manifests under registry/layers/capability/<id>/.
// Stops at top-K promotable-only. Idempotent — won't overwrite existing
// manifests. The registry is the system of record.
//
// Swap strategy: replace the manifest writer with a PR-opener or a dry-run
// committer without changing the node contract.

import { mkdir, writeFile, access } from 'node:fs/promises'
import path from 'node:path'

import type { RankedCandidate } from './rank.js'

export interface PromoteInput {
  ranked: RankedCandidate[]
  registryRoot: string
  maxPromotions?: number
  dryRun?: boolean
}

export interface PromoteOutput {
  promoted: string[]
  skipped: { id: string; reason: string }[]
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

export async function promoteNode(input: PromoteInput): Promise<PromoteOutput> {
  const promoted: string[] = []
  const skipped: { id: string; reason: string }[] = []
  const max = input.maxPromotions ?? 8

  const candidates = input.ranked.filter((c) => c.score.promotable).slice(0, max)

  for (const c of candidates) {
    const dir = path.join(input.registryRoot, 'layers', 'capability', c.candidate.id)
    if (await exists(dir)) {
      skipped.push({ id: c.candidate.id, reason: 'already-exists' })
      continue
    }
    const manifest = {
      id: c.candidate.id,
      description: c.candidate.description,
      appliesTo: [c.candidate.family],
      defaults: {},
      files: [],
      contextHints: {
        extensionPoints: [],
        notes: `Promoted by variant_b flow (rank=${c.rank}, composite=${c.score.composite.toFixed(3)}).`,
      },
      keywords: c.candidate.promptKeywords,
      buildHints: {
        capabilityBundle: c.candidate.capabilities,
        rationale: c.candidate.rationale,
      },
      // variant_b metadata so a future reviewer can filter promoted
      // archetypes and audit the loop's output.
      provenance: {
        generatedBy: 'variant_b',
        source: c.candidate.source,
        scores: c.score,
        promotedAt: new Date().toISOString(),
      },
    }
    if (input.dryRun) {
      promoted.push(c.candidate.id)
      continue
    }
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
    promoted.push(c.candidate.id)
  }
  return { promoted, skipped }
}
