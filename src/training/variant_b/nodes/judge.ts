// judge node: LLM-as-judge + deterministic checks. Each candidate archetype
// is scored on (a) coverage-gap-fit, (b) keyword specificity, (c) non-overlap
// with existing archetypes, (d) an LLM rubric score on "is this a real,
// useful archetype that future prompts would match".
//
// Swap strategy: replace the rubric signature with a different judge
// (pairwise preference, ensemble, rule-only) without changing the output
// contract.

import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { ax } from '@ax-llm/ax'
import type { AxAIService } from '@ax-llm/ax'
import type { ArchetypeCandidate } from './generate.js'

export interface CandidateScore {
  utility: number
  specificity: number
  novelty: number
  rubric: number
  composite: number
  promotable: boolean
  notes: string
}

export interface ScoredCandidate {
  candidate: ArchetypeCandidate
  score: CandidateScore
}

export interface JudgeInput {
  candidates: ArchetypeCandidate[]
  judgePath: string
  llm?: AxAIService
  useLLM?: boolean
  promoteThreshold?: number
}

export interface JudgeOutput {
  scored: ScoredCandidate[]
}

const rubricAgent = ax(
  '"Score an archetype candidate on four dimensions from 0.0 to 1.0. utility = how often future AI-saas prompts will match. specificity = how unique the keyword set is. novelty = how different from existing archetypes. overall = weighted sum. Return short reasoning." ' +
    'archetypeId:string, description:string, capabilities:string[], promptKeywords:string[], existingArchetypes:string[] -> ' +
    'utility:number, specificity:number, novelty:number, overall:number, reasoning:string',
)

function deterministicScore(c: ArchetypeCandidate): { specificity: number; novelty: number; utility: number } {
  const kw = c.promptKeywords ?? []
  const specificity = Math.min(1, kw.length / 8)
  const utility = c.source === 'cooccurrence' ? 0.8 : c.source === 'coverage-gap' ? 0.7 : 0.5
  const novelty = c.capabilities.length >= 2 ? 0.8 : 0.5
  return { specificity, novelty, utility }
}

export async function judgeNode(input: JudgeInput): Promise<JudgeOutput> {
  const scored: ScoredCandidate[] = []
  await mkdir(path.dirname(input.judgePath), { recursive: true })
  const useLLM = input.useLLM !== false && input.llm !== undefined
  const promoteThreshold = input.promoteThreshold ?? 0.6

  for (const candidate of input.candidates) {
    const det = deterministicScore(candidate)
    let rubric = 0.5
    let notes = ''

    if (useLLM && input.llm) {
      try {
        const raw = (await rubricAgent.forward(
          input.llm,
          {
            archetypeId: candidate.id,
            description: candidate.description,
            capabilities: candidate.capabilities,
            promptKeywords: candidate.promptKeywords,
            existingArchetypes: [],
          },
          { stream: false },
        )) as { utility?: number; specificity?: number; novelty?: number; overall?: number; reasoning?: string }
        const overall = typeof raw.overall === 'number' ? raw.overall : 0.5
        rubric = Math.max(0, Math.min(1, overall))
        notes = raw.reasoning ?? ''
      } catch {
        // LLM blip — deterministic score carries
      }
    }

    const composite = 0.25 * det.utility + 0.25 * det.specificity + 0.2 * det.novelty + 0.3 * rubric
    const promotable = composite >= promoteThreshold && candidate.capabilities.length > 0

    const score: CandidateScore = {
      utility: det.utility,
      specificity: det.specificity,
      novelty: det.novelty,
      rubric,
      composite,
      promotable,
      notes,
    }
    scored.push({ candidate, score })
    await appendFile(
      input.judgePath,
      JSON.stringify({ candidate, score, timestamp: new Date().toISOString() }) + '\n',
    )
  }

  return { scored }
}
