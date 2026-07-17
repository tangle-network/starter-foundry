// Hand-graded goldens for the recruiter rubric-quality judge.
//
// Eight examples covering the rubric dimensions across the score range:
//   - 3 high-quality rubric outputs (humanScore 0.85 - 1.0)
//   - 2 mid-quality (humanScore 0.5 - 0.7) — actionability gaps or thin coverage
//   - 3 low-quality (humanScore 0.0 - 0.3) — bias proxies, vague, or missing
//
// Used by `eval/judges/rubric-quality.calibration.ts` (calibration runner)
// to compute κ + Pearson + MAE against the live judge. `isCiGating` from
// the rubric-runner consumes the calibration result and returns true only
// when the floor is met.
//
// Format mirrors what `calibrateRubric` consumes — `itemId` is the human-
// readable handle, `humanScore` is the 0..1 grade. The calibration runner
// pairs each golden × dimension; the spec's per-dimension `scoreItem`
// callback returns the live judge's score for that item.

import type { GoldenItem } from '@tangle-network/agent-eval'

export interface RubricGoldenFixture {
  itemId: string
  humanScore: number
  /** Per-dimension human scores so calibration can pair against the live
   * judge dimension-by-dimension, not just an overall mean. */
  byDimension: Record<'coverage' | 'bias-resistance' | 'actionability', number>
  /** The agent transcript the rubric is evaluating. Real text, not a stub. */
  transcript: string
  /** Why this is a golden — a one-line note for the next operator. */
  why: string
}

export const GOLDENS: RubricGoldenFixture[] = [
  {
    itemId: 'g-high-1-comprehensive-eng-rubric',
    humanScore: 0.95,
    byDimension: { coverage: 1.0, 'bias-resistance': 1.0, actionability: 0.85 },
    why: 'Strong rubric: covers JD bona-fide qualifications, no proxies, weighted criteria with named evidence.',
    transcript:
      ':::artifact\n' +
      '# Rubric — Senior Backend Engineer\n\n' +
      '## Distributed systems (weight 0.35)\n' +
      '- Evidence: explain a consensus or replication design they have shipped\n' +
      '- 0–1: never owned consensus/replication; 4–5: owned end-to-end including failure modes\n\n' +
      '## Production reliability (weight 0.30)\n' +
      '- Evidence: walk through a P0 they led; explain blast radius + mitigation chosen\n' +
      '- 0–1: no on-call experience; 4–5: led multi-team incidents and wrote postmortems\n\n' +
      '## Code design (weight 0.20)\n' +
      '- Evidence: live coding — partition a service boundary; justify the seams\n' +
      '- 0–1: cannot articulate trade-offs; 4–5: argues testability + ownership cogently\n\n' +
      '## Communication (weight 0.15)\n' +
      '- Evidence: explain a recent technical decision to a non-engineer interviewer on the panel\n' +
      '- 0–1: jargon-heavy, no audience adaptation; 4–5: precise + audience-aware\n' +
      ':::',
  },
  {
    itemId: 'g-high-2-data-rubric',
    humanScore: 0.9,
    byDimension: { coverage: 0.9, 'bias-resistance': 1.0, actionability: 0.85 },
    why: 'Solid rubric for data scientist role — bona-fide evidence-typed criteria, no proxies.',
    transcript:
      ':::artifact\n' +
      '# Rubric — Senior Data Scientist (Search Relevance)\n\n' +
      '## Causal inference (weight 0.35)\n' +
      '- Evidence: design an A/B test for a ranking change; identify confounds\n\n' +
      '## ML systems (weight 0.30)\n' +
      '- Evidence: walk through training-serving skew they debugged\n\n' +
      '## Stakeholder translation (weight 0.20)\n' +
      '- Evidence: translate a model result into a product decision in a mock review\n\n' +
      '## Engineering rigor (weight 0.15)\n' +
      '- Evidence: live coding — unit-test a feature transform with edge cases\n' +
      ':::',
  },
  {
    itemId: 'g-high-3-pm-rubric',
    humanScore: 0.85,
    byDimension: { coverage: 0.85, 'bias-resistance': 1.0, actionability: 0.8 },
    why: 'PM rubric — covers the bona-fide qualifications, weighted, evidence-typed.',
    transcript:
      ':::artifact\n' +
      '# Rubric — Senior Product Manager (Developer Tools)\n\n' +
      '## Customer discovery (weight 0.30) — Evidence: walk through 3 customer conversations they led; what changed\n' +
      '## Prioritization (weight 0.30) — Evidence: defend a recent kill-this-feature decision\n' +
      '## Cross-functional execution (weight 0.25) — Evidence: explain a launch they shepherded; trade-offs made\n' +
      '## Technical fluency (weight 0.15) — Evidence: read an API contract diff and explain user impact\n' +
      ':::',
  },
  {
    itemId: 'g-mid-1-thin-actionability',
    humanScore: 0.6,
    byDimension: { coverage: 0.7, 'bias-resistance': 1.0, actionability: 0.3 },
    why: 'Coverage and bias-clean, but anchors are vague; weights missing → two interviewers will calibrate differently.',
    transcript:
      ':::artifact\n' +
      '# Rubric — Senior Backend Engineer\n\n' +
      '## Technical skills\n- Strong distributed systems\n- Good production reliability\n## Communication\n- Clear, precise\n## Engineering judgment\n- Sound trade-offs\n' +
      ':::',
  },
  {
    itemId: 'g-mid-2-incomplete-coverage',
    humanScore: 0.55,
    byDimension: { coverage: 0.4, 'bias-resistance': 1.0, actionability: 0.7 },
    why: 'Actionable + bias-clean, but only covers 1 of the 4 bona-fide qualifications stated in the JD.',
    transcript:
      ':::artifact\n' +
      '# Rubric — Senior Backend Engineer\n\n' +
      '## Distributed systems (weight 1.0)\n' +
      '- Evidence: walk through consensus design they have shipped\n' +
      '- 0–1: never owned; 4–5: owned end-to-end\n' +
      ':::',
  },
  {
    itemId: 'g-low-1-bias-proxies',
    humanScore: 0.15,
    byDimension: { coverage: 0.5, 'bias-resistance': 0.0, actionability: 0.3 },
    why: 'Contains protected-class proxies (graduation year, "culture fit") — score MUST be low on bias-resistance.',
    transcript:
      ':::artifact\n' +
      '# Rubric — Senior Backend Engineer\n\n' +
      '## Distributed systems\n- Strong fundamentals\n## Culture fit\n- Aligns with team energy and pace\n## Pedigree\n- Top-tier CS program, recent grad preferred\n## Communication\n- Articulate\n' +
      ':::',
  },
  {
    itemId: 'g-low-2-vague-and-biased',
    humanScore: 0.1,
    byDimension: { coverage: 0.3, 'bias-resistance': 0.0, actionability: 0.2 },
    why: 'Vague AND biased — coded language ("good attitude", "hungry") that will get applied differently per interviewer.',
    transcript:
      ':::artifact\n' +
      '# Rubric\n\n- Strong technical skills\n- Good attitude\n- Hungry\n- Cultural alignment\n- Communicative\n' +
      ':::',
  },
  {
    itemId: 'g-low-3-no-rubric-at-all',
    humanScore: 0.0,
    byDimension: { coverage: 0.0, 'bias-resistance': 0.5, actionability: 0.0 },
    why: 'Refuses or punts — no rubric content emitted; treat as unscoreable on coverage + actionability.',
    transcript:
      'I think you should just hire whoever feels like a good fit — rubrics overcomplicate things. Trust your gut.',
  },
]

/** Convert to the calibrateJudge GoldenItem shape (itemId + humanScore only).
 * Per-dimension scores are accessed via the `byDimension` field directly
 * by the calibration runner. */
export function toGoldenItems(): GoldenItem[] {
  return GOLDENS.map((g) => ({ itemId: g.itemId, humanScore: g.humanScore }))
}

/** Look up a single golden by item id. */
export function getGolden(itemId: string): RubricGoldenFixture | undefined {
  return GOLDENS.find((g) => g.itemId === itemId)
}
