// Public entrypoint: generateIdeas({ registryRoot, tracesPath })
//
// Scans the traces directory for the most recent trace file, rehydrates
// Trace[] from it, then invokes the generate node. The scripts/multi-pursue-eval.ts
// harness calls this and feeds the result into judge.scoreCandidate.

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { createLLM, isLLMAvailable } from '../../lib/llm.js'

import type { Trace } from './nodes/collect.js'
import { generateNode } from './nodes/generate.js'
import type { ArchetypeCandidate } from './nodes/generate.js'

export interface GenerateIdeasInput {
  registryRoot: string
  tracesPath: string
  maxCandidates?: number
}

async function loadLatestTraces(tracesDir: string): Promise<Trace[]> {
  let files: string[]
  try {
    files = (await readdir(tracesDir))
      .filter((f) => f.startsWith('variant_b-') && f.endsWith('.jsonl'))
      .sort()
  } catch {
    return []
  }
  if (files.length === 0) return []
  const latest = files[files.length - 1]
  const raw = await readFile(path.join(tracesDir, latest), 'utf8')
  const traces: Trace[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      traces.push(JSON.parse(trimmed) as Trace)
    } catch {
      // skip malformed lines
    }
  }
  return traces
}

export async function generateIdeas(input: GenerateIdeasInput): Promise<ArchetypeCandidate[]> {
  const traces = await loadLatestTraces(input.tracesPath)
  // Create an LLM only if we can — the mine-from-traces path runs anyway.
  let llm
  try {
    llm = isLLMAvailable() ? createLLM() : undefined
  } catch {
    llm = undefined
  }
  if (!llm) {
    // Use a fake AxAIService-compatible shim only for mined candidates. Node
    // handles the llm-undefined branch internally when proposerAgent fails.
    // Easier: pass a harmless throw to skip LLM path.
    const throwing = {
      async chat() {
        throw new Error('no-llm')
      },
      getId: () => 'noop',
    } as unknown as Parameters<typeof generateNode>[0]['llm']
    const out = await generateNode({
      registryRoot: input.registryRoot,
      traces,
      llm: throwing,
      maxCandidates: input.maxCandidates,
    })
    return out.candidates
  }
  const out = await generateNode({
    registryRoot: input.registryRoot,
    traces,
    llm,
    maxCandidates: input.maxCandidates,
  })
  return out.candidates
}
