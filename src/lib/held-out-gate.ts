/**
 * Starter Foundry's tri-state promotion policy over agent-eval's canonical
 * RunRecord, held-out comparison, and paired-statistics primitives.
 *
 * @public
 */

import {
  HeldOutGate as AgentEvalHeldOutGate,
  isRealnessGated,
  mcnemar,
  observedSplitScore,
  pairRunRecords,
  pairedRiskDifference,
  type RunRecord,
} from '@tangle-network/agent-eval'

export type HeldOutGateConfig = ConstructorParameters<typeof AgentEvalHeldOutGate>[0]

type AgentEvalDecision = ReturnType<AgentEvalHeldOutGate['evaluate']>
type BinaryRiskDifference = ReturnType<typeof pairedRiskDifference>
type BinaryMcNemar = ReturnType<typeof mcnemar>

export type GateVerdict = 'PROMOTE' | 'HOLD' | 'REVERT'

export type GateEvidence = AgentEvalDecision['evidence'] & {
  comparison: 'continuous' | 'binary'
  binaryRiskDifference: BinaryRiskDifference | null
  binaryMcNemar: BinaryMcNemar | null
}

export interface GateDecision {
  verdict: GateVerdict
  candidateId: string
  baselineKey: string
  rejectionCode: AgentEvalDecision['rejectionCode']
  reason: string
  evidence: GateEvidence
}

interface PairedHoldoutScores {
  baseline: number[]
  candidate: number[]
}

const PRECONDITION_REJECTIONS = new Set<AgentEvalDecision['rejectionCode']>([
  'few_runs',
  'incomplete_coverage',
  'missing_split_scores',
])

function scoredHoldoutRuns(runs: readonly RunRecord[]): RunRecord[] {
  return runs.filter((run) => {
    if (run.splitTag !== 'holdout' || isRealnessGated(run)) return false
    const score = observedSplitScore(run, 'holdout')
    return typeof score === 'number' && Number.isFinite(score)
  })
}

function holdoutScore(run: RunRecord): number {
  const score = observedSplitScore(run, 'holdout')
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    throw new Error(`HeldOutGate: paired holdout run ${run.runId} has no finite holdout score`)
  }
  return score
}

function pairedHoldoutScores(
  candidate: readonly RunRecord[],
  baseline: readonly RunRecord[],
): PairedHoldoutScores {
  const pairing = pairRunRecords(scoredHoldoutRuns(baseline), scoredHoldoutRuns(candidate))
  return {
    baseline: pairing.pairs.map((pair) => holdoutScore(pair.baseline)),
    candidate: pairing.pairs.map((pair) => holdoutScore(pair.treatment)),
  }
}

function isBinary(scores: PairedHoldoutScores): boolean {
  return (
    scores.baseline.length > 0 &&
    [...scores.baseline, ...scores.candidate].every((score) => score === 0 || score === 1)
  )
}

function continuousDecisionFields(
  decision: AgentEvalDecision,
): Pick<GateDecision, 'verdict' | 'rejectionCode' | 'reason'> {
  const ci = decision.evidence.pairedCI
  if (ci !== null && ci.high < 0) {
    return {
      verdict: 'REVERT',
      rejectionCode: 'negative_delta',
      reason: `negative_delta: paired held-out CI=[${ci.low.toFixed(4)}, ${ci.high.toFixed(4)}] is below zero`,
    }
  }
  if (decision.promote && (ci === null || ci.low <= 0)) {
    return {
      verdict: 'HOLD',
      rejectionCode: 'negative_delta',
      reason:
        'negative_delta: paired held-out evidence does not establish an improvement above zero',
    }
  }
  if (decision.promote) {
    return { verdict: 'PROMOTE', rejectionCode: null, reason: decision.reason }
  }
  if (decision.rejectionCode === 'overfit_gap') {
    return {
      verdict: 'REVERT',
      rejectionCode: decision.rejectionCode,
      reason: decision.reason,
    }
  }
  return {
    verdict: 'HOLD',
    rejectionCode: decision.rejectionCode,
    reason: decision.reason,
  }
}

function fromAgentEval(
  decision: AgentEvalDecision,
  comparison: GateEvidence['comparison'] = 'continuous',
): GateDecision {
  const fields = continuousDecisionFields(decision)
  return {
    ...fields,
    candidateId: decision.candidateId,
    baselineKey: decision.baselineId,
    evidence: {
      ...decision.evidence,
      comparison,
      binaryRiskDifference: null,
      binaryMcNemar: null,
    },
  }
}

/**
 * Uses agent-eval's production held-out decision for continuous scores.
 * Binary scores use its paired risk-difference and McNemar primitives because
 * a median delta is zero until more than half of all matched cases flip.
 */
export class HeldOutGate {
  private readonly agentEvalGate: AgentEvalHeldOutGate
  private readonly config: HeldOutGateConfig

  constructor(config: HeldOutGateConfig) {
    this.agentEvalGate = new AgentEvalHeldOutGate(config)
    this.config = config
  }

  evaluate(candidate: RunRecord[], baseline: RunRecord[]): GateDecision {
    const baseDecision = this.agentEvalGate.evaluate(candidate, baseline)
    const scores = pairedHoldoutScores(candidate, baseline)
    if (!isBinary(scores)) return fromAgentEval(baseDecision)

    if (PRECONDITION_REJECTIONS.has(baseDecision.rejectionCode)) {
      return fromAgentEval(baseDecision, 'binary')
    }

    const confidence = this.config.confidence ?? 0.95
    const alpha = 1 - confidence
    const threshold = this.config.pairedDeltaThreshold ?? 0
    const promotionThreshold = Math.max(threshold, 0)
    const risk = pairedRiskDifference(scores.baseline, scores.candidate, confidence)
    const exact = mcnemar(scores.baseline, scores.candidate)
    const evidence: GateEvidence = {
      ...baseDecision.evidence,
      comparison: 'binary',
      binaryRiskDifference: risk,
      binaryMcNemar: exact,
    }

    if (risk.upper < 0 && exact.pValue < alpha) {
      return this.binaryDecision(
        baseDecision,
        'REVERT',
        'negative_delta',
        `negative_delta: paired holdout risk difference=${risk.riskDifference.toFixed(4)} ` +
          `CI=[${risk.lower.toFixed(4)}, ${risk.upper.toFixed(4)}], ` +
          `McNemar p=${exact.pValue.toFixed(6)}`,
        evidence,
      )
    }

    const overfitThreshold = this.config.overfitGapThreshold ?? 0.15
    if (
      evidence.overfitGap !== null &&
      evidence.baselineOverfitGap !== null &&
      evidence.overfitGap > evidence.baselineOverfitGap + overfitThreshold
    ) {
      return this.binaryDecision(
        baseDecision,
        'REVERT',
        'overfit_gap',
        `overfit_gap: candidate gap=${evidence.overfitGap.toFixed(4)} exceeds ` +
          `baseline gap=${evidence.baselineOverfitGap.toFixed(4)} by more than ` +
          overfitThreshold.toFixed(4),
        evidence,
      )
    }

    if (this.config.costPerTaskCeiling !== undefined) {
      if (evidence.medianCandidateCost === null) {
        return this.binaryDecision(
          baseDecision,
          'HOLD',
          'missing_cost',
          'missing_cost: candidate cost evidence is incomplete',
          evidence,
        )
      }
      if (evidence.medianCandidateCost > this.config.costPerTaskCeiling) {
        return this.binaryDecision(
          baseDecision,
          'HOLD',
          'cost_ceiling',
          `cost_ceiling: candidate median cost $${evidence.medianCandidateCost.toFixed(4)} ` +
            `exceeds ceiling $${this.config.costPerTaskCeiling.toFixed(4)}`,
          evidence,
        )
      }
    }

    if (risk.lower > promotionThreshold && exact.pValue < alpha) {
      return this.binaryDecision(
        baseDecision,
        'PROMOTE',
        null,
        `promote: paired holdout risk difference=${risk.riskDifference.toFixed(4)} ` +
          `CI=[${risk.lower.toFixed(4)}, ${risk.upper.toFixed(4)}] over ${risk.n} pairs; ` +
          `McNemar p=${exact.pValue.toFixed(6)}`,
        evidence,
      )
    }

    return this.binaryDecision(
      baseDecision,
      'HOLD',
      'indeterminate_delta',
      `indeterminate_delta: paired holdout risk difference=${risk.riskDifference.toFixed(4)} ` +
        `CI=[${risk.lower.toFixed(4)}, ${risk.upper.toFixed(4)}] does not clear ` +
        `threshold ${promotionThreshold.toFixed(4)} with McNemar p=${exact.pValue.toFixed(6)}`,
      evidence,
    )
  }

  private binaryDecision(
    base: AgentEvalDecision,
    verdict: GateVerdict,
    rejectionCode: AgentEvalDecision['rejectionCode'],
    reason: string,
    evidence: GateEvidence,
  ): GateDecision {
    return {
      verdict,
      candidateId: base.candidateId,
      baselineKey: base.baselineId,
      rejectionCode,
      reason,
      evidence,
    }
  }
}
