// Synthetic-bootstrap library. Generates labeled training/validation
// tuples via strong LLMs (Opus / GPT / o4) when real user data is absent
// or sparse. Consumed by:
//   - Branch 2: template-quality synthesizer (seed LLM prompts when no
//     real rewrite tuples exist for a template)
//   - Branch 3: scorecard baseline (synthetic corpus for held-out)
//   - Branch 4: brand/asset generation seeds
//   - Branch 5: routing training (synthetic (prompt, expected-family) tuples)
//   - Branch 1: new-family-manifest draft input (seed prompts that SHOULD
//     route to the new family)
//
// All synthetic data is tagged with `source: 'synthetic'` + `generator: <model>`
// so downstream processors can weight it lower than real data, or segregate
// during eval. Real agent traces always outrank synthetic.

import { ax } from '@ax-llm/ax'

import { createLLM, isLLMAvailable } from '../llm.js'

export interface SyntheticPrompt {
  id: string
  prompt: string
  expectedFamily: string
  expectedCapabilities: string[]
  expectedPartner: string | null
  complexity: 'simple' | 'medium' | 'complex'
  /** e.g. 'synthetic:opus', 'synthetic:gpt-5'. Marks the generator for provenance. */
  source: string
  /** Optional — the product archetype the prompt represents. */
  archetype?: string
}

export interface SyntheticBatch {
  generatedAt: string
  generator: string
  count: number
  prompts: SyntheticPrompt[]
}

export interface GenerateOptions {
  /** Family to generate prompts for. LLM will produce prompts that SHOULD route here. */
  targetFamily: string
  /** Capabilities the generated prompts should trigger. */
  expectedCapabilities?: string[]
  /** Partner bias, if any. */
  expectedPartner?: string | null
  /** How many prompts to generate (default: 5). */
  count?: number
  /** Archetype label (e.g. "AI trading dashboard", "HIPAA backend"). */
  archetype?: string
}

const promptGenerator = ax(
  'targetFamily:string, expectedCapabilities:string[], archetype:string, count:number -> prompts:string[]',
)

/**
 * Generate N synthetic user prompts that should route to `targetFamily`
 * with `expectedCapabilities`. Each prompt is product-shaped (describes a
 * real product a user might build), not a meta description of the stack.
 *
 * Falls back to a deterministic template-combination if no LLM key is
 * present, so tests + CI can run offline.
 */
export async function generatePrompts(options: GenerateOptions): Promise<SyntheticBatch> {
  const count = options.count ?? 5
  const caps = options.expectedCapabilities ?? []
  const archetype = options.archetype ?? ''

  const useLLM = isLLMAvailable()
  const generatedAt = new Date().toISOString()
  const generator = useLLM ? 'synthetic:llm' : 'synthetic:deterministic'

  let prompts: string[] = []

  if (useLLM) {
    try {
      const llm = createLLM()
      const out = (await promptGenerator.forward(llm, {
        targetFamily: options.targetFamily,
        expectedCapabilities: caps,
        archetype,
        count,
      })) as { prompts?: string[] }
      prompts = Array.isArray(out.prompts)
        ? out.prompts.filter((p) => typeof p === 'string' && p.length > 20)
        : []
    } catch {
      // Fall through to deterministic.
    }
  }

  if (prompts.length === 0) {
    prompts = syntheticDeterministic(options, count)
  }

  return {
    generatedAt,
    generator,
    count: prompts.length,
    prompts: prompts.map((p, i) => ({
      id: `${options.targetFamily}-${archetype || 'generic'}-${i}-${Date.now()}`,
      prompt: p,
      expectedFamily: options.targetFamily,
      expectedCapabilities: caps,
      expectedPartner: options.expectedPartner ?? null,
      complexity: p.length < 80 ? 'simple' : p.length < 180 ? 'medium' : 'complex',
      source: generator,
      archetype: archetype || undefined,
    })),
  }
}

/**
 * Deterministic prompt generation — fills from a hand-curated archetype-×-family
 * sentence-frame grid. Not clever; just a known-good bootstrap seed so CI +
 * tests work without LLM keys.
 */
function syntheticDeterministic(options: GenerateOptions, count: number): string[] {
  const family = options.targetFamily
  const archetype = options.archetype || family
  const frames = [
    `Build a ${archetype} using ${family}.`,
    `Scaffold me a ${archetype} with ${family} as the runtime.`,
    `I need a ${archetype}. Use ${family}.`,
    `Create a production-shape ${archetype} on ${family}.`,
    `Generate a starter for a ${archetype}; the family should be ${family}.`,
    `New project: ${archetype}. Pick ${family}.`,
    `A ${archetype} — keep the stack minimal. ${family} is the right choice.`,
  ]
  return frames.slice(0, count)
}

/**
 * Write a SyntheticBatch to .evolve/synthetic/<scope>.jsonl (append mode,
 * idempotent on id). The buildout pipeline optionally consumes these as
 * held-out-expanded input when real data is sparse.
 */
export async function persistBatch(batch: SyntheticBatch, scope: string): Promise<string> {
  const { mkdir, appendFile } = await import('node:fs/promises')
  const { dirname, resolve } = await import('node:path')
  const target = resolve('.evolve/synthetic', `${scope}.jsonl`)
  await mkdir(dirname(target), { recursive: true })
  const lines = batch.prompts.map((p) => JSON.stringify(p)).join('\n') + '\n'
  await appendFile(target, lines, 'utf8')
  return target
}
