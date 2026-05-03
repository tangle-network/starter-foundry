/**
 * HeldOutGate — promote/hold/revert decision over a candidate vs baseline.
 *
 * Composes from `@tangle-network/agent-eval@0.19.1` primitives:
 *   - `bootstrapCi` for paired-delta CI
 *   - `pairedTTest` for paired p-value
 *   - `cohensD` for effect size
 *   - `welchsTTest` for unpaired fallback
 *   - `benjaminiHochberg` for FDR adjustment
 *
 * The shape is the v0.16 agent-eval `HeldOutGate` API exactly so the swap is
 * rename-only:
 *
 *   import { HeldOutGate } from '@tangle-network/agent-eval'
 *   `rm src/lib/held-out-gate.ts`
 *
 * Verdict logic:
 *   - REVERT if pairedDeltaMedian < 0 AND pValue < 0.05
 *     (candidate is significantly worse on the search distribution)
 *   - REVERT if overfitGap >= overfitGapThreshold AND holdoutScore is known
 *     (candidate gamed the search judge — held-out shows the gap)
 *   - PROMOTE if pairedDeltaMedian >= pairedDeltaThreshold AND
 *     cohensD >= cohensDThreshold AND
 *     n >= minProductiveRuns AND
 *     (pValue (or qValueBh) < 0.05) AND
 *     overfitGap < overfitGapThreshold (or holdoutScore unknown)
 *   - HOLD otherwise (insufficient evidence)
 *
 * @public
 */

import {
  benjaminiHochberg,
  bootstrapCi,
  cohensD,
  pairedTTest,
  welchsTTest,
} from '@tangle-network/agent-eval'

import type { RunRecord } from './run-record.js'

export interface HeldOutGateConfig {
  /** Logical baseline name — recorded on the decision for traceability. */
  baselineKey: string
  /** Floor below which we always HOLD (not enough data). Default 3. */
  minProductiveRuns?: number
  /** Median paired-delta required for PROMOTE. Default 0. */
  pairedDeltaThreshold?: number
  /**
   * Held-out vs search-score gap above which we REVERT (overfit). Default 0.20
   * (20pp — operator-locked).
   */
  overfitGapThreshold?: number
  /** Minimum |Cohen's d| required for PROMOTE. Default 0.5. */
  cohensDThreshold?: number
  /** Apply Benjamini-Hochberg correction across this evaluation. Default true. */
  applyBHCorrection?: boolean
  /** Confidence alpha for the bootstrap CI. Default 0.05 (95% CI). */
  alpha?: number
  /** Bootstrap iterations. Default 1000. */
  iterations?: number
  /** RNG seed for the bootstrap (reproducibility). */
  seed?: number
}

export type GateVerdict = 'PROMOTE' | 'HOLD' | 'REVERT'

export interface GateEvidence {
  n: number
  pairedDeltaMedian: number
  pairedDeltaCi95: { lower: number; upper: number }
  cohensD: number
  searchScore: number
  holdoutScore: number | null
  overfitGap: number | null
  pValue: number
  /** BH-corrected q-value for this single hypothesis. null if applyBHCorrection: false. */
  qValueBh: number | null
}

export interface GateDecision {
  verdict: GateVerdict
  reason: string
  baselineKey: string
  evidence: GateEvidence
}

const DEFAULTS = {
  minProductiveRuns: 3,
  pairedDeltaThreshold: 0,
  overfitGapThreshold: 0.2,
  cohensDThreshold: 0.5,
  applyBHCorrection: true,
  alpha: 0.05,
  iterations: 1000,
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  let s = 0
  for (const x of xs) s += x
  return s / xs.length
}

/** Average outcome.holdoutScore over runs where it's defined, else null. */
function meanHoldoutScore(runs: readonly RunRecord[]): number | null {
  const xs = runs
    .map((r) => r.outcome.holdoutScore)
    .filter((v): v is number => typeof v === 'number')
  if (xs.length === 0) return null
  return mean(xs)
}

export class HeldOutGate {
  private readonly cfg: Required<HeldOutGateConfig>

  constructor(config: HeldOutGateConfig) {
    this.cfg = {
      baselineKey: config.baselineKey,
      minProductiveRuns: config.minProductiveRuns ?? DEFAULTS.minProductiveRuns,
      pairedDeltaThreshold: config.pairedDeltaThreshold ?? DEFAULTS.pairedDeltaThreshold,
      overfitGapThreshold: config.overfitGapThreshold ?? DEFAULTS.overfitGapThreshold,
      cohensDThreshold: config.cohensDThreshold ?? DEFAULTS.cohensDThreshold,
      applyBHCorrection: config.applyBHCorrection ?? DEFAULTS.applyBHCorrection,
      alpha: config.alpha ?? DEFAULTS.alpha,
      iterations: config.iterations ?? DEFAULTS.iterations,
      seed: config.seed ?? 0,
    }
  }

  /**
   * Evaluate a candidate vs baseline. Both arrays are RunRecords; pairing
   * is positional (record i in candidate paired with record i in baseline).
   * If lengths differ, the smaller length is used for paired stats and a
   * note is included in the reason.
   */
  evaluate(candidate: readonly RunRecord[], baseline: readonly RunRecord[]): GateDecision {
    const n = Math.min(candidate.length, baseline.length)
    const candidateScores = candidate.map((r) => r.outcome.searchScore)
    const baselineScores = baseline.map((r) => r.outcome.searchScore)

    const candidateMean = mean(candidateScores)
    const baselineMean = mean(baselineScores)

    if (n < this.cfg.minProductiveRuns) {
      return this.decision('HOLD', `n=${n} below minProductiveRuns=${this.cfg.minProductiveRuns}`, {
        n,
        pairedDeltaMedian: 0,
        pairedDeltaCi95: { lower: 0, upper: 0 },
        cohensD: 0,
        searchScore: candidateMean,
        holdoutScore: meanHoldoutScore(candidate),
        overfitGap: null,
        pValue: 1,
        qValueBh: null,
      })
    }

    const pairedDeltas: number[] = []
    for (let i = 0; i < n; i += 1) {
      pairedDeltas.push(candidateScores[i] - baselineScores[i])
    }
    const pairedDeltaMedian = median(pairedDeltas)

    const boot = bootstrapCi(baselineScores, candidateScores, {
      alpha: this.cfg.alpha,
      iterations: this.cfg.iterations,
      seed: this.cfg.seed,
    })
    const ci95 = { lower: boot.ciLower, upper: boot.ciUpper }

    const d = cohensD(baselineScores, candidateScores)

    // Use paired t-test when arrays are equal length; fall back to Welch's
    // when they differ (rare; documented in reason).
    let pValue: number
    if (candidateScores.length === baselineScores.length) {
      pValue = pairedTTest(baselineScores, candidateScores).p
    } else {
      pValue = welchsTTest(baselineScores, candidateScores).p
    }

    const qValueBh = this.cfg.applyBHCorrection
      ? benjaminiHochberg([pValue], this.cfg.alpha).qValues[0]
      : null

    const candidateHoldout = meanHoldoutScore(candidate)
    const overfitGap = candidateHoldout !== null ? candidateMean - candidateHoldout : null

    const evidence: GateEvidence = {
      n,
      pairedDeltaMedian,
      pairedDeltaCi95: ci95,
      cohensD: d,
      searchScore: candidateMean,
      holdoutScore: candidateHoldout,
      overfitGap,
      pValue,
      qValueBh,
    }

    const effectiveP = qValueBh ?? pValue

    // REVERT: significantly worse on search
    if (pairedDeltaMedian < 0 && effectiveP < this.cfg.alpha) {
      return this.decision(
        'REVERT',
        `paired-delta median ${pairedDeltaMedian.toFixed(4)} < 0 with p=${effectiveP.toFixed(4)} < alpha=${this.cfg.alpha}`,
        evidence,
      )
    }

    // REVERT: overfit (held-out gap exceeds threshold)
    if (overfitGap !== null && overfitGap >= this.cfg.overfitGapThreshold) {
      return this.decision(
        'REVERT',
        `overfit-gap ${overfitGap.toFixed(4)} >= threshold ${this.cfg.overfitGapThreshold}`,
        evidence,
      )
    }

    // PROMOTE: positive median delta + adequate effect size + significant
    const positiveDelta = pairedDeltaMedian >= this.cfg.pairedDeltaThreshold
    const adequateEffect = Math.abs(d) >= this.cfg.cohensDThreshold && d > 0
    const significant = effectiveP < this.cfg.alpha
    if (positiveDelta && adequateEffect && significant) {
      return this.decision(
        'PROMOTE',
        `paired-delta ${pairedDeltaMedian.toFixed(4)} >= ${this.cfg.pairedDeltaThreshold}, ` +
          `cohen's d ${d.toFixed(3)} >= ${this.cfg.cohensDThreshold}, ` +
          `p=${effectiveP.toFixed(4)} < ${this.cfg.alpha}` +
          (overfitGap !== null
            ? `, overfit-gap ${overfitGap.toFixed(4)} < ${this.cfg.overfitGapThreshold}`
            : ''),
        evidence,
      )
    }

    // HOLD with explanation
    const reasons: string[] = []
    if (!positiveDelta)
      reasons.push(
        `paired-delta ${pairedDeltaMedian.toFixed(4)} < ${this.cfg.pairedDeltaThreshold}`,
      )
    if (!adequateEffect)
      reasons.push(`|cohen's d| ${Math.abs(d).toFixed(3)} < ${this.cfg.cohensDThreshold}`)
    if (!significant) reasons.push(`p=${effectiveP.toFixed(4)} >= ${this.cfg.alpha}`)
    return this.decision('HOLD', `insufficient evidence: ${reasons.join('; ')}`, evidence)
  }

  private decision(verdict: GateVerdict, reason: string, evidence: GateEvidence): GateDecision {
    return { verdict, reason, baselineKey: this.cfg.baselineKey, evidence }
  }
}
