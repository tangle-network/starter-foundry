/**
 * Example: pairwise judge usage.
 *
 * Demonstrates the canonical flow:
 *   1. Run rubric eval on two variants (handled by agent-eval:judge-rubric).
 *   2. Feed both result sets into runPairwise with optional judgeFamily.
 *   3. Inspect the bias diagnostics BEFORE acting on the verdict — if
 *      positional bias is non-trivial (|avgDelta| > 0.1), the judge is
 *      not stable and the result should be discarded or the judge swapped.
 */

import {
  runPairwise,
  type PairwiseJudge,
  type VariantOutputs,
} from './pairwise-runner.js'
import { DEFAULT_RUN_SCORE_WEIGHTS } from '@tangle-network/agent-eval'

const exampleVariantA: VariantOutputs = {
  variantId: 'prompt-v1',
  family: 'claude-opus-4',
  scenarios: [
    {
      scenarioId: 'tool-use-basic',
      output: 'I checked the docs and the answer is 42.',
      bundle: { id: 'prompt-v1-bundle', coderPrompt: 'You are concise.', skills: [], rolePrompts: {}, metadata: {} },
      score: {
        success: 0.85,
        goalProgress: 0.9,
        repoGroundedness: 0.7,
        driftPenalty: 0.0,
        toolUseQuality: 0.8,
        patchQuality: 0.0,
        testReality: 0.0,
        finalGate: 0.85,
        reviewerBlockers: 0,
        costUsd: 0.012,
        wallSeconds: 4.2,
      },
    },
  ],
}

const exampleVariantB: VariantOutputs = {
  variantId: 'prompt-v2',
  family: 'gpt-4o',
  scenarios: [
    {
      scenarioId: 'tool-use-basic',
      output:
        'After reading the docs carefully, weighing options, considering edge cases, the most likely answer is 42.',
      bundle: { id: 'prompt-v2-bundle', coderPrompt: 'You think step by step.', skills: [], rolePrompts: {}, metadata: {} },
      score: {
        success: 0.83,
        goalProgress: 0.88,
        repoGroundedness: 0.7,
        driftPenalty: 0.0,
        toolUseQuality: 0.75,
        patchQuality: 0.0,
        testReality: 0.0,
        finalGate: 0.83,
        reviewerBlockers: 0,
        costUsd: 0.018,
        wallSeconds: 6.1,
      },
    },
  ],
}

/**
 * Toy judge for the example: deterministically returns the precomputed
 * `success` dimension. Real callers should plug in an LLM judge that
 * scores `first` and `second` per-presentation so positional bias can
 * actually surface.
 */
const replayJudge: PairwiseJudge = async ({ first, second }) => ({
  firstScore: first.score.success,
  secondScore: second.score.success,
})

export const runExample = async (): Promise<void> => {
  const report = await runPairwise({
    variantA: exampleVariantA,
    variantB: exampleVariantB,
    judge: replayJudge,
    judgeFamily: 'claude-opus-4',
    optimizerConfig: { weights: DEFAULT_RUN_SCORE_WEIGHTS },
  })
  if (Math.abs(report.bias.position.avgDelta) > 0.1) {
    throw new Error(
      `positional bias too high (${report.bias.position.avgDelta.toFixed(4)}); discard result`,
    )
  }
  if (Math.abs(report.bias.verbosity.pearson) > 0.6) {
    throw new Error(
      `verbosity bias too high (r=${report.bias.verbosity.pearson.toFixed(4)}); judge is rewarding length`,
    )
  }
  console.log(`winner: ${report.optimizer.recommendedVariantId}`)
}
