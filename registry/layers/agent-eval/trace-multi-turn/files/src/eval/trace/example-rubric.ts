/**
 * Example StepRubric set for multi-turn agent eval.
 *
 * Composes built-in agent-eval rubrics with two custom step-level scorers:
 *   - `relevanceRubric`     — LLM span output should reference the user's
 *                             current turn (cheap keyword overlap proxy).
 *   - `progressTowardGoalRubric` — assistant outputs should monotonically
 *                                  reduce the gap between the user's stated
 *                                  goal and the run's intermediate state.
 *
 * Customize for your domain. The built-ins below are intentionally generic
 * so the layer composes cleanly without domain assumptions.
 */

import {
  outputLengthRubric,
  toolSuccessRubric,
  toolNonRedundantRubric,
  toolIntentAlignmentRubric,
  type StepRubric,
} from '@tangle-network/agent-eval'

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'as', 'by', 'this', 'that',
  'it', 'its', 'i', 'you', 'we', 'they', 'he', 'she', 'them', 'us', 'me',
])

const tokenize = (s: string): Set<string> => {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
  )
}

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter += 1
  return inter / (a.size + b.size - inter)
}

/**
 * Reward LLM responses whose token set overlaps the most recent user turn.
 * Cheap, deterministic, no LLM call. Pairs with stricter LLM-judged rubrics.
 */
export const relevanceRubric = (args: { weight?: number } = {}): StepRubric => ({
  id: 'relevance',
  kinds: ['llm'],
  weight: args.weight ?? 1,
  grade: async (ctx) => {
    const span = ctx.step.span
    if (span.kind !== 'llm') return null
    const lastUser = [...span.messages].reverse().find((m) => m.role === 'user')
    if (!lastUser?.content) return null
    const output = span.output ?? ''
    if (!output) return null
    const score = jaccard(tokenize(lastUser.content), tokenize(output))
    return {
      score,
      rationale: `jaccard=${score.toFixed(3)} between user turn and assistant output`,
    }
  },
})

/**
 * Reward assistant outputs that reference the goal phrase (declared in the
 * scenario's first user message). A flat or decreasing referenceability
 * score across turns indicates topical drift.
 */
export const progressTowardGoalRubric = (args: { goalPhrase: string; weight?: number }): StepRubric => {
  const goalTokens = tokenize(args.goalPhrase)
  return {
    id: 'progress-toward-goal',
    kinds: ['llm'],
    weight: args.weight ?? 1,
    grade: async (ctx) => {
      const span = ctx.step.span
      if (span.kind !== 'llm') return null
      const output = span.output ?? ''
      if (!output) return null
      const overlap = jaccard(goalTokens, tokenize(output))
      return {
        score: overlap,
        rationale: `goal-token overlap=${overlap.toFixed(3)}`,
      }
    },
  }
}

/**
 * Default rubric set — composes built-ins with relevance + goal progress.
 * Pass a `goalPhrase` from the scenario's success criteria.
 */
export const defaultStepRubrics = (goalPhrase: string): StepRubric[] => [
  outputLengthRubric({ minChars: 16, maxChars: 4000, weight: 0.5 }),
  toolSuccessRubric({ weight: 1 }),
  toolNonRedundantRubric({ weight: 1 }),
  toolIntentAlignmentRubric({ weight: 1 }),
  relevanceRubric({ weight: 1 }),
  progressTowardGoalRubric({ goalPhrase, weight: 1.5 }),
]
