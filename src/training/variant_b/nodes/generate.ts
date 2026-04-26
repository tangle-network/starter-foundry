// generate node: looks at coverage gaps in the traces + uncovered capability
// co-occurrences, then uses an ax program to propose new archetype definitions
// (capability bundles) that would plug the gaps. Output is candidates, not
// committed archetypes — the judge + rank + promote nodes decide what lands.

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import { ax } from '@ax-llm/ax'
import type { AxAIService } from '@ax-llm/ax'

import type { Trace } from './collect.js'

export interface ArchetypeCandidate {
  id: string
  description: string
  family: string
  capabilities: string[]
  promptKeywords: string[]
  rationale: string
  // The source that produced this candidate — lets the judge weight by provenance
  source: 'coverage-gap' | 'cooccurrence' | 'llm-proposed'
}

export interface GenerateInput {
  registryRoot: string
  traces: Trace[]
  llm: AxAIService
  maxCandidates?: number
}

export interface GenerateOutput {
  candidates: ArchetypeCandidate[]
  existingArchetypes: string[]
}

async function loadExistingArchetypes(registryRoot: string): Promise<string[]> {
  try {
    const dir = path.join(registryRoot, 'layers', 'capability')
    const entries = await readdir(dir, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}

async function loadCapabilityKeywords(
  registryRoot: string,
  existing: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  for (const id of existing) {
    try {
      const manifestPath = path.join(registryRoot, 'layers', 'capability', id, 'manifest.json')
      const raw = await readFile(manifestPath, 'utf8')
      const manifest = JSON.parse(raw) as { keywords?: string[] }
      out.set(id, manifest.keywords ?? [])
    } catch {
      // skip
    }
  }
  return out
}

// Derive candidates from real data first. LLM proposal is layered on top —
// the judge will separate signal from slop.
function mineCandidatesFromTraces(traces: Trace[], existingIds: Set<string>): ArchetypeCandidate[] {
  const cooccur = new Map<string, Map<string, number>>()
  for (const t of traces) {
    const caps = t.expectedCapabilities
    for (let i = 0; i < caps.length; i++) {
      for (let j = i + 1; j < caps.length; j++) {
        const a = caps[i]
        const b = caps[j]
        const key = a < b ? `${a}|${b}` : `${b}|${a}`
        const [l, r] = key.split('|') as [string, string]
        if (!cooccur.has(l)) cooccur.set(l, new Map())
        cooccur.get(l)!.set(r, (cooccur.get(l)!.get(r) ?? 0) + 1)
      }
    }
  }

  const bundles: ArchetypeCandidate[] = []
  for (const [l, rs] of cooccur) {
    for (const [r, count] of rs) {
      if (count < 3) continue
      const pairId = `${l.replace('capability:', '')}-${r.replace('capability:', '')}`
      const id = `bundle-${pairId}`
      if (existingIds.has(id)) continue
      const keywords = new Set<string>()
      for (const t of traces) {
        if (t.expectedCapabilities.includes(l) && t.expectedCapabilities.includes(r)) {
          for (const w of t.prompt
            .toLowerCase()
            .split(/\W+/)
            .filter((w) => w.length >= 4)) {
            keywords.add(w)
          }
        }
      }
      bundles.push({
        id,
        description: `Bundle of ${l} + ${r} — co-occurs in ${count} training prompts.`,
        family: 'fullstack-ts',
        capabilities: [l, r],
        promptKeywords: [...keywords].slice(0, 12),
        rationale: `Co-occurrence count ${count} in ideasai corpus.`,
        source: 'cooccurrence',
      })
    }
  }

  // Plus: each high-miss capability that's present in the corpus but missed
  // in traces becomes a candidate archetype that binds the capability +
  // its strongest partner capability.
  const missByCap = new Map<string, number>()
  for (const t of traces) {
    for (const cap of t.expectedCapabilities) {
      if (!t.actualCapabilities.includes(cap)) {
        missByCap.set(cap, (missByCap.get(cap) ?? 0) + 1)
      }
    }
  }
  const topMiss = [...missByCap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  for (const [cap, missCount] of topMiss) {
    const id = `gap-${cap.replace('capability:', '')}`
    if (existingIds.has(id)) continue
    const keywords = new Set<string>()
    for (const t of traces) {
      if (t.expectedCapabilities.includes(cap)) {
        for (const w of t.prompt
          .toLowerCase()
          .split(/\W+/)
          .filter((w) => w.length >= 4)) {
          keywords.add(w)
        }
      }
    }
    bundles.push({
      id,
      description: `Fill coverage gap for ${cap} — missed in ${missCount} training traces.`,
      family: 'fullstack-ts',
      capabilities: [cap],
      promptKeywords: [...keywords].slice(0, 12),
      rationale: `Top-N coverage gap (miss count ${missCount}).`,
      source: 'coverage-gap',
    })
  }

  return bundles
}

// LLM-proposed archetype node: takes the top-N coverage gaps + a sample of
// prompts and asks for a structured archetype name + capability bundle that
// would plug the gaps. Kept narrow on purpose — judge & rank filter the noise.
const proposerAgent = ax(
  '"Propose a new product archetype that would help route ambiguous AI-product prompts to the right capability bundle. The archetype id must be kebab-case. Capabilities must be drawn ONLY from knownCapabilities. Promptkeywords must be single tokens that actually appear in problemPrompts." ' +
    'coverageGaps:string[], problemPrompts:string[], knownCapabilities:string[] -> ' +
    'archetypeId:string, description:string, family:string, capabilities:string[], promptKeywords:string[], rationale:string',
)

export async function generateNode(input: GenerateInput): Promise<GenerateOutput> {
  const existing = await loadExistingArchetypes(input.registryRoot)
  const existingSet = new Set(existing)
  const capKeywords = await loadCapabilityKeywords(input.registryRoot, existing)
  const knownCapabilities = [...capKeywords.keys()].map((id) => `capability:${id}`)

  const mined = mineCandidatesFromTraces(input.traces, existingSet)

  // LLM proposal: surface the worst-covered gaps + real prompts as context.
  const missByCap = new Map<string, number>()
  for (const t of input.traces) {
    for (const cap of t.expectedCapabilities) {
      if (!t.actualCapabilities.includes(cap)) missByCap.set(cap, (missByCap.get(cap) ?? 0) + 1)
    }
  }
  const topGaps = [...missByCap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([c]) => c)
  const problemPrompts = input.traces
    .filter((t) => t.capabilityHit < 0.5 && t.corpus === 'ideasai')
    .slice(0, 8)
    .map((t) => t.prompt)

  const llmCandidates: ArchetypeCandidate[] = []
  if (problemPrompts.length > 0 && topGaps.length > 0) {
    try {
      const raw = (await proposerAgent.forward(
        input.llm,
        {
          coverageGaps: topGaps,
          problemPrompts,
          knownCapabilities,
        },
        { stream: false },
      )) as {
        archetypeId?: string
        description?: string
        family?: string
        capabilities?: string[]
        promptKeywords?: string[]
        rationale?: string
      }
      if (raw.archetypeId && Array.isArray(raw.capabilities) && raw.capabilities.length > 0) {
        const validCaps = raw.capabilities.filter((c) => knownCapabilities.includes(c))
        if (validCaps.length > 0 && !existingSet.has(raw.archetypeId)) {
          llmCandidates.push({
            id: raw.archetypeId,
            description: raw.description ?? '',
            family: raw.family ?? 'fullstack-ts',
            capabilities: validCaps,
            promptKeywords: (raw.promptKeywords ?? []).filter(
              (w) => typeof w === 'string' && w.length > 2,
            ),
            rationale: raw.rationale ?? '',
            source: 'llm-proposed',
          })
        }
      }
    } catch {
      // LLM proposal is optional — mined candidates carry the loop alone
    }
  }

  const max = input.maxCandidates ?? 12
  const candidates = [...mined, ...llmCandidates].slice(0, max)
  return { candidates, existingArchetypes: existing }
}
