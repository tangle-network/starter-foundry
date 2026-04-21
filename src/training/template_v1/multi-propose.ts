// Multi-proposer synthesis — generate N candidates (mix of LLM prompts +
// deterministic) in parallel, judge each, pick the winner. If scores are
// too close, flag for human review.

import type { HarvestSummary } from './harvest.js'
import { synthesize, type SynthesizeResult } from './synthesize.js'
import { judge, type JudgeResult } from './judge.js'

export interface MultiProposeInput {
  templatePath: string
  currentSource: string
  harvest: HarvestSummary
  familyId: string
  /** Default 3. Increase for hard cases; decrease for fast dry-runs. */
  proposerCount?: number
  /** Score spread below which we emit a tie-break flag. Default 0.05. */
  tieThreshold?: number
}

export interface MultiProposeResult {
  winner: { candidate: SynthesizeResult; score: JudgeResult }
  runnerUps: Array<{ candidate: SynthesizeResult; score: JudgeResult }>
  needsHumanTieBreak: boolean
  proposerCount: number
}

export async function multiPropose(input: MultiProposeInput): Promise<MultiProposeResult> {
  const count = input.proposerCount ?? 3
  const proposals = await Promise.all(
    Array.from({ length: count }, () =>
      synthesize({
        templatePath: input.templatePath,
        currentSource: input.currentSource,
        harvest: input.harvest,
        familyId: input.familyId,
      }),
    ),
  )

  const judged = proposals.map((candidate) => ({
    candidate,
    score: judge({
      templatePath: input.templatePath,
      currentSource: input.currentSource,
      candidate: candidate.candidate,
      harvest: input.harvest,
    }),
  }))

  judged.sort((a, b) => b.score.score - a.score.score)
  const winner = judged[0]!
  const runnerUps = judged.slice(1)
  const tie = runnerUps[0] && Math.abs(winner.score.score - runnerUps[0].score.score) < (input.tieThreshold ?? 0.05)

  return {
    winner,
    runnerUps,
    needsHumanTieBreak: !!tie,
    proposerCount: count,
  }
}
