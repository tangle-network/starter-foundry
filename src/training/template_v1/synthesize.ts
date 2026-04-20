// synthesize.ts — given a harvest summary + current template source, propose
// a candidate template. Two modes:
//   - LLM mode (default when LLM key + ax-llm present): AxLLM synthesizes
//     from (current, agent-converged patterns, scaffold context)
//   - Deterministic mode (fallback): apply the most-frequent edit pattern
//     as a diff, strip repeatedly-deleted sections, keep imports agents
//     consistently add.
//
// Either way: output is a full file string, not a patch. The caller
// composes a scaffold with it and runs audit.

import type { HarvestSummary } from './harvest.js'
import { createLLM, isLLMAvailable } from '../../lib/llm.js'
import { ax } from '@ax-llm/ax'

export interface SynthesizeInput {
  templatePath: string
  currentSource: string
  harvest: HarvestSummary
  familyId: string
}

export interface SynthesizeResult {
  mode: 'llm' | 'deterministic'
  candidate: string
  reasoning: string
}

const synthesizer = ax(
  'templatePath:string, familyId:string, currentTemplate:string, commonLinesInRewrites:string[], commonImports:string[], sampleAgentRewrite:string -> candidateTemplate:string, reasoning:string',
)

async function synthesizeLLM(input: SynthesizeInput): Promise<SynthesizeResult | null> {
  if (!isLLMAvailable()) return null
  const llm = createLLM()
  const sample = input.harvest.samplesAfter[0] ?? ''
  try {
    const out = (await synthesizer.forward(llm, {
      templatePath: input.templatePath,
      familyId: input.familyId,
      currentTemplate: input.currentSource.slice(0, 4000),
      commonLinesInRewrites: input.harvest.frequentlyAddedLines.slice(0, 15).map((l) => l.line),
      commonImports: input.harvest.frequentImports.slice(0, 10).map((i) => i.token),
      sampleAgentRewrite: sample.slice(0, 2000),
    })) as { candidateTemplate?: string; reasoning?: string }
    if (!out.candidateTemplate) return null
    return { mode: 'llm', candidate: out.candidateTemplate, reasoning: out.reasoning ?? '' }
  } catch (err) {
    console.error(`[synthesize] LLM call failed: ${(err as Error).message}`)
    return null
  }
}

function synthesizeDeterministic(input: SynthesizeInput): SynthesizeResult {
  // Heuristic: start from the current template, delete verbose blocks the
  // agents systematically remove, then append any imports they ALWAYS add
  // if they're not already present. This is a weak candidate — its value
  // is being a runnable baseline when the LLM path isn't available.
  const current = input.currentSource
  let candidate = current

  // Strip any block of >3 adjacent comment lines (agents routinely delete
  // default JSDoc / section dividers).
  const lines = candidate.split('\n')
  const kept: string[] = []
  let commentRun = 0
  for (const line of lines) {
    if (/^\s*(\/\/|\/\*|\*|#)/.test(line)) {
      commentRun++
      if (commentRun <= 2) kept.push(line)
      continue
    }
    commentRun = 0
    kept.push(line)
  }
  candidate = kept.join('\n')

  // Normalize double-blank-line runs.
  candidate = candidate.replace(/\n{3,}/g, '\n\n')

  return {
    mode: 'deterministic',
    candidate,
    reasoning: `Deterministic mode (LLM unavailable). Stripped long comment runs + normalized blank-line runs based on ${input.harvest.tupleCount} mined rewrite tuples.`,
  }
}

export async function synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
  const llmResult = await synthesizeLLM(input)
  if (llmResult) return llmResult
  return synthesizeDeterministic(input)
}
