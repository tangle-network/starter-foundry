// Public entrypoint: scoreCandidate({ spec })
//
// The multi-pursue harness iterates candidates from generateIdeas and calls
// scoreCandidate on each. Returns the judge's composite score + promotable
// flag. LLM is used when available; deterministic scoring is the fallback.

import { createLLM, isLLMAvailable } from '../../lib/llm.js'

import type { ArchetypeCandidate } from './nodes/generate.js'
import { judgeNode } from './nodes/judge.js'
import type { CandidateScore } from './nodes/judge.js'

export interface ScoreCandidateInput {
  spec: ArchetypeCandidate
}

export type ScoreCandidateResult = CandidateScore

export async function scoreCandidate(input: ScoreCandidateInput): Promise<ScoreCandidateResult> {
  let llm
  try {
    llm = isLLMAvailable() ? createLLM() : undefined
  } catch {
    llm = undefined
  }
  const out = await judgeNode({
    candidates: [input.spec],
    judgePath: '.evolve/judge/variant_b.jsonl',
    llm,
    useLLM: llm !== undefined,
  })
  return out.scored[0].score
}
