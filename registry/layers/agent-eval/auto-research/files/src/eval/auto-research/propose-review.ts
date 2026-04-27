/**
 * auto-research:propose-review — typed wrapper around `runProposeReview`.
 *
 * The propose/verify/review primitive is the inner loop of any
 * hypothesis-driven research run: given a goal + a verifier, iterate up to
 * N shots, each refining the proposal using the prior verification output.
 *
 * This wrapper enforces the shape every research-harness consumer cares
 * about (goal description in, typed final state + score out) so families
 * compose this layer without re-deriving the agent-eval surface.
 */

import {
  runProposeReview,
  type ProposeReviewConfig,
  type ProposeReviewReport,
} from '@tangle-network/agent-eval'

export interface ProposeReviewInput<State, Summary = unknown>
  extends ProposeReviewConfig<State, Summary> {}

export interface ProposeReviewOutput<State, Summary = unknown>
  extends ProposeReviewReport<State, Summary> {}

/**
 * Drive a propose / verify / review loop until the verifier passes, the
 * shot cap is hit, or the reviewer signals stop. Returns the final state +
 * the per-shot trace for downstream reporting.
 */
export async function proposeReview<State, Summary = unknown>(
  config: ProposeReviewInput<State, Summary>,
): Promise<ProposeReviewOutput<State, Summary>> {
  return runProposeReview<State, Summary>(config)
}

export type { ProposeReviewConfig, ProposeReviewReport } from '@tangle-network/agent-eval'
