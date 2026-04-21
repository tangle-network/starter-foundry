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
  // Signal-driven pattern-apply. Extract lines agents consistently ADD to
  // their version of the template, then graft the ones missing from the
  // current template into appropriate sections.
  const current = input.currentSource
  let candidate = current
  const appliedAdditions: string[] = []

  // 1. Find lines that appear in agent rewrites ≥30% of the time AND are
  //    not in the current source. These are high-confidence additions.
  const threshold = Math.max(3, Math.floor(input.harvest.tupleCount * 0.25))
  const frequent = input.harvest.frequentlyAddedLines
    .filter((l) => l.frequency >= threshold)
    .filter((l) => !current.includes(l.line))

  const isCss = input.templatePath.endsWith('.css')
  const isTs = input.templatePath.endsWith('.ts') || input.templatePath.endsWith('.tsx')

  if (isCss && frequent.length > 0) {
    // CSS: line-level signal is insufficient (rules span multiple lines).
    // Skip deterministic CSS pattern-apply entirely when we lack structural
    // parsing — don't ship broken CSS. The LLM path handles this correctly;
    // deterministic falls back to the comment-strip + normalize pass only.
    // Explicit no-op so the reasoning string reflects the decision.
  } else if (isTs && frequent.length > 0) {
    // TS/TSX: low-risk additions limited to imports that 30%+ of agents add.
    const importRegex = /^import\s.+from\s['"][^'"]+['"]/
    const imports = frequent
      .map((l) => l.line)
      .filter((l) => importRegex.test(l))
      .slice(0, 3)
    if (imports.length > 0) {
      candidate = imports.join('\n') + '\n' + candidate
      appliedAdditions.push(...imports)
    }
  }

  // 2. Strip verbose comment runs agents routinely delete.
  const lines = candidate.split('\n')
  const kept: string[] = []
  let commentRun = 0
  for (const line of lines) {
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) {
      commentRun++
      if (commentRun <= 3) kept.push(line)
      continue
    }
    commentRun = 0
    kept.push(line)
  }
  candidate = kept.join('\n')

  // 3. Normalize excess blank lines.
  candidate = candidate.replace(/\n{3,}/g, '\n\n')

  const reasoning = appliedAdditions.length > 0
    ? `Deterministic: grafted ${appliedAdditions.length} line(s) that appeared in ≥25% of ${input.harvest.tupleCount} agent rewrites and were missing from the current template. Stripped long comment runs + normalized blanks.`
    : `Deterministic: no frequent agent additions above the 25% threshold. Stripped long comment runs + normalized blanks only (${input.harvest.tupleCount} tuples analyzed).`

  return { mode: 'deterministic', candidate, reasoning }
}

export async function synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
  const llmResult = await synthesizeLLM(input)
  if (llmResult) return llmResult
  return synthesizeDeterministic(input)
}
