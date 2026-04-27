/**
 * Proposer — LLM-assisted hypothesis drafting via `runProposeReview`.
 *
 * Given a goal description + a snapshot of recent run state, returns a
 * batch of candidate `Hypothesis` records the operator can append to
 * `hypotheses/queue.json`. The proposer never writes to the queue
 * itself — the human stays in the loop on what gets tested.
 *
 * The propose / verify / review primitive from agent-eval drives the
 * inner loop: each shot proposes hypotheses, the verifier checks shape +
 * coverage (categories, count, distinct ids), the reviewer either
 * accepts or asks for a revision. Default cap: 3 shots.
 */

import {
  runProposeReview,
  type ProposeReviewReport,
  type Verification,
} from '@tangle-network/agent-eval'

import type { Hypothesis, HypothesisCategory } from './types.js'

export interface ProposerInput {
  /** What the operator wants the harness to explore. */
  goal: string
  /** Number of hypotheses to generate. */
  count?: number
  /** Categories the proposer should cover (priority order). */
  categories?: HypothesisCategory[]
  /**
   * LLM call hook. Returns a JSON-shaped object the proposer parses into
   * `Hypothesis[]`. Consumers wire this to router.tangle.tools or any
   * compatible inference endpoint.
   */
  callJson: (req: { system: string; user: string }) => Promise<unknown>
  /** Existing queue ids to avoid duplicates. */
  existingIds?: readonly string[]
  maxShots?: number
}

export interface ProposerOutput {
  hypotheses: Hypothesis[]
  report: ProposeReviewReport<ProposerState, ProposerSummary>
}

interface ProposerState {
  draft: Hypothesis[]
  attempt: number
}

interface ProposerSummary {
  rejectedCount: number
  notes: string[]
}

const SYSTEM_PROMPT = `You are a research-program lead drafting hypotheses for a research-harness that runs prompt + steering optimization on @tangle-network/agent-eval. Output STRICT JSON of shape:

{ "hypotheses": Hypothesis[] }

Each Hypothesis must have:
- id: kebab-case, unique, descriptive
- name: short human label
- rationale: WHY this should work + what evidence supports it
- category: one of "bug-fix" | "architectural" | "efficiency" | "parameter-tuning"
- expected_impact: e.g. "pass rate: +5-10pp" or "cost: -20%"
- risk: what could regress
- priority: 1 | 2 | 3
- treatment: object describing the change (config delta, prompt delta, code change description)

Rules:
- Bug fixes first, then architectural, then efficiency, then parameter-tuning
- No two hypotheses with the same id
- No hypotheses that "tune to" a specific scenario id
- Prefer architectural over parameter tuning when impact is comparable`

function isCategory(value: unknown): value is HypothesisCategory {
  return (
    value === 'bug-fix' ||
    value === 'architectural' ||
    value === 'efficiency' ||
    value === 'parameter-tuning'
  )
}

function isPriority(value: unknown): value is 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3
}

function parseHypotheses(raw: unknown): { hypotheses: Hypothesis[]; notes: string[] } {
  const notes: string[] = []
  if (raw === null || typeof raw !== 'object') {
    return { hypotheses: [], notes: ['response was not a JSON object'] }
  }
  const root = raw as Record<string, unknown>
  const list = root.hypotheses
  if (!Array.isArray(list)) {
    return { hypotheses: [], notes: ['response.hypotheses was not an array'] }
  }
  const out: Hypothesis[] = []
  list.forEach((entry, idx) => {
    if (entry === null || typeof entry !== 'object') {
      notes.push(`item[${idx}] not an object`)
      return
    }
    const e = entry as Record<string, unknown>
    if (
      typeof e.id !== 'string' ||
      typeof e.name !== 'string' ||
      typeof e.rationale !== 'string' ||
      typeof e.expected_impact !== 'string' ||
      !isCategory(e.category) ||
      !isPriority(e.priority) ||
      typeof e.treatment !== 'object' ||
      e.treatment === null
    ) {
      notes.push(`item[${idx}] failed shape check`)
      return
    }
    const hypothesis: Hypothesis = {
      id: e.id,
      name: e.name,
      rationale: e.rationale,
      category: e.category,
      expected_impact: e.expected_impact,
      priority: e.priority,
      treatment: e.treatment as Record<string, unknown>,
    }
    if (typeof e.risk === 'string') hypothesis.risk = e.risk
    out.push(hypothesis)
  })
  return { hypotheses: out, notes }
}

export async function propose(input: ProposerInput): Promise<ProposerOutput> {
  const count = input.count ?? 5
  const categories = input.categories ?? [
    'bug-fix',
    'architectural',
    'efficiency',
    'parameter-tuning',
  ]
  const existingIds = new Set(input.existingIds ?? [])
  const maxShots = input.maxShots ?? 3

  const report = await runProposeReview<ProposerState, ProposerSummary>({
    goal: input.goal,
    initialState: { draft: [], attempt: 0 },
    maxShots,
    propose: async ({ shot, goal, priorReview }) => {
      const userPrompt = [
        `Goal: ${goal}`,
        `Generate ${count} hypotheses covering categories: ${categories.join(', ')}.`,
        existingIds.size > 0
          ? `Avoid these ids (already queued): ${[...existingIds].join(', ')}`
          : 'No existing ids to avoid.',
        priorReview
          ? `Reviewer feedback: ${priorReview.nextShotInstruction}`
          : 'This is the first attempt.',
        'Return JSON only — no commentary.',
      ].join('\n\n')
      const raw = await input.callJson({ system: SYSTEM_PROMPT, user: userPrompt })
      const { hypotheses, notes } = parseHypotheses(raw)
      return {
        state: { draft: hypotheses, attempt: shot },
        traceSummary: { rejectedCount: notes.length, notes },
      }
    },
    verify: async (state): Promise<Verification> => {
      const issues: string[] = []
      if (state.draft.length === 0) issues.push('no hypotheses parsed')
      const ids = new Set<string>()
      for (const h of state.draft) {
        if (ids.has(h.id)) issues.push(`duplicate id ${h.id}`)
        ids.add(h.id)
        if (existingIds.has(h.id)) issues.push(`id ${h.id} already in queue`)
      }
      const haveCategories = new Set(state.draft.map((h) => h.category))
      const requiredCategories = categories.filter((c) => c !== 'parameter-tuning')
      for (const c of requiredCategories) {
        if (!haveCategories.has(c)) issues.push(`category ${c} missing`)
      }
      const pass = issues.length === 0 && state.draft.length >= Math.min(count, 3)
      return {
        pass,
        score: pass ? 1 : 0,
        details: { issues, count: state.draft.length },
      }
    },
    review: async ({ verification, state }) => {
      const issues =
        (verification.details as { issues?: string[] } | undefined)?.issues ?? []
      if (verification.pass) {
        return {
          observations: `${state.draft.length} hypotheses parsed, all categories covered`,
          diagnosis: 'shape valid',
          nextShotInstruction: 'no further changes',
          shouldContinue: false,
          confidence: 0.9,
        }
      }
      return {
        observations: `verifier rejected: ${issues.join('; ')}`,
        diagnosis: 'shape invalid or coverage insufficient',
        nextShotInstruction: `Fix these issues: ${issues.join('; ')}. Return ${count} hypotheses minimum, all required categories covered, no duplicate or pre-existing ids.`,
        shouldContinue: true,
        confidence: 0.4,
      }
    },
  })

  return {
    hypotheses: report.finalState.draft,
    report,
  }
}
