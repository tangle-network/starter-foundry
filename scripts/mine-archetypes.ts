#!/usr/bin/env node
// Offline archetype/keyword miner.
//
// Loads the full registry + corpus, asks an LLM to find coverage gaps where
// prompts route to the wrong family or miss expected capabilities, and emits
// manifest-patch proposals (new archetypes, new keywords, new capability
// layers) to .evolve/mining/proposals-{ts}.json for human review.
//
// Uses the same ax-llm client as the production rewriter, but applies ax's
// agent() with a JS runtime so the LLM can programmatically explore the
// combined context (corpus + 40 families + 91 capabilities) rather than
// stuffing everything into a single prompt.
//
// Usage:
//   node scripts/mine-archetypes.ts [--corpus <path>] [--out <path>] [--provider <groq|anthropic|openai>]

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { agent, axCreateJSRuntime, AxJSRuntimePermission } from '@ax-llm/ax'
import { createLLM, isLLMAvailable } from '../dist/lib/llm.js'

const argv = process.argv.slice(2)
function arg(k, fallback) {
  const i = argv.indexOf(k)
  return i >= 0 ? argv[i + 1] : fallback
}

const corpusPath = arg('--corpus', 'corpus/ideasai-prompts.json')
const outPath = arg('--out', `.evolve/mining/proposals-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
const provider = arg('--provider', undefined)

if (!isLLMAvailable()) {
  console.error('No LLM provider configured. Set GROQ_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY.')
  process.exit(2)
}

function loadAllManifests(registryRoot) {
  const manifests = []
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const s = statSync(full)
      if (s.isDirectory()) walk(full)
      else if (name === 'manifest.json') {
        try {
          const parsed = JSON.parse(readFileSync(full, 'utf8'))
          manifests.push({
            path: full.replace(registryRoot + '/', ''),
            id: parsed.id,
            kind: parsed.kind ?? (full.includes('/families/') ? 'family' : 'layer'),
            description: parsed.description,
            keywords: parsed.keywords ?? parsed.tieredKeywords ?? null,
            appliesTo: parsed.appliesTo ?? null,
            group: parsed.group ?? null,
          })
        } catch {
          // skip malformed
        }
      }
    }
  }
  walk(registryRoot)
  return manifests
}

const registryRoot = resolve('registry')
const manifests = loadAllManifests(registryRoot)
const families = manifests.filter((m) => m.path.includes('/families/'))
const layers = manifests.filter((m) => m.path.includes('/layers/'))

const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'))
const corpusScenarios = Array.isArray(corpus) ? corpus : corpus.scenarios ?? []

console.log(`loaded: ${families.length} families, ${layers.length} layers, ${corpusScenarios.length} scenarios`)

// Compact JSON representations to keep context tight.
const familySummary = families.map((f) => ({
  id: f.id,
  description: f.description,
  keywords: f.keywords,
}))
const capabilitySummary = layers
  .filter((l) => l.group === 'capability' || l.path.includes('/layers/capability/'))
  .map((l) => ({ id: l.id, description: l.description, keywords: l.keywords ?? null }))

const runtime = axCreateJSRuntime({
  permissions: [AxJSRuntimePermission.ReadOnlyFS],
  resourceLimits: { maxCpuMs: 30_000, maxMemoryMb: 256 },
})

const miner = agent(
  'corpus:json, families:json, capabilities:json -> ' +
    'proposedArchetypes:json, proposedKeywords:json, coverageGaps:json',
  {
    maxSteps: 12,
    contextFields: ['corpus', 'families', 'capabilities'],
    runtime,
    contextPolicy: 'checkpointed',
  },
)

const llm = createLLM(provider ? { provider } : {})

console.log('invoking miner...')
const t0 = performance.now()
let result
try {
  result = await miner.forward(llm, {
    corpus: corpusScenarios,
    families: familySummary,
    capabilities: capabilitySummary,
  })
} catch (err) {
  console.error('miner failed:', err?.message ?? err)
  // Fallback: try a plain ax() call without RLM runtime so partial value is still captured.
  const { ax } = await import('@ax-llm/ax')
  const fallback = ax(
    'corpus:json, families:json, capabilities:json -> proposedArchetypes:json, proposedKeywords:json, coverageGaps:json',
  )
  try {
    result = await fallback.forward(llm, {
      corpus: corpusScenarios.slice(0, 30),
      families: familySummary,
      capabilities: capabilitySummary,
    })
    result._fallback = 'plain-ax-no-runtime'
  } catch (e2) {
    console.error('fallback also failed:', e2?.message ?? e2)
    process.exit(1)
  }
}
const durationMs = performance.now() - t0

const proposal = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  corpusPath,
  corpusScenarioCount: corpusScenarios.length,
  familyCount: families.length,
  capabilityCount: capabilitySummary.length,
  durationMs,
  proposedArchetypes: result.proposedArchetypes ?? [],
  proposedKeywords: result.proposedKeywords ?? {},
  coverageGaps: result.coverageGaps ?? [],
  notes: result._fallback
    ? 'RLM runtime unavailable; proposal generated from a sampled corpus without programmatic exploration.'
    : null,
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(proposal, null, 2))
console.log(`proposals written: ${outPath}`)
console.log(`  archetypes: ${proposal.proposedArchetypes.length}`)
console.log(
  `  keywords: ${
    Array.isArray(proposal.proposedKeywords)
      ? proposal.proposedKeywords.length
      : Object.keys(proposal.proposedKeywords).length
  }`,
)
console.log(`  coverageGaps: ${proposal.coverageGaps.length}`)
console.log(`  durationMs: ${durationMs.toFixed(0)}`)
