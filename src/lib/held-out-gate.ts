/**
 * Makes a promotion decision from matched candidate and baseline runs.
 *
 * Promotion requires enough paired observations, a confidence interval wholly
 * above the minimum useful improvement, a significant one-sided sign test, and
 * a defined paired effect size. Missing or mismatched evidence always holds.
 *
 * @public
 */

import {
  BOOTSTRAP_GATE_MIN_N,
  pairedBootstrap,
  pairedCohensDz,
  pairedSignTest,
} from '@tangle-network/agent-eval'

import type { RunRecord } from './run-record.js'

export interface HeldOutGateConfig {
  /** Logical baseline name recorded with the decision. */
  baselineKey: string
  /** Required number of matched runs. Must be at least 20. Default 20. */
  minPairs?: number
  /** Smallest useful paired-score improvement. Default 0. */
  minimumDelta?: number
  /** Search minus held-out score that rejects a candidate. Default 0.20. */
  maximumOverfitGap?: number
  /** Confidence level for the paired bootstrap interval. Default 0.95. */
  confidence?: number
  /** Paired bootstrap resamples. Default 2000. */
  resamples?: number
  /** Significance level for the one-sided exact sign test. Default 0.05. */
  alpha?: number
  /** Deterministic bootstrap seed. Default 0. */
  seed?: number
}

export type GateVerdict = 'PROMOTE' | 'HOLD' | 'REVERT'

export interface GateEvidence {
  candidateN: number
  baselineN: number
  pairedN: number
  holdoutN: number
  pairedDeltaMedian: number | null
  pairedDeltaMean: number | null
  pairedDeltaInterval: { lower: number; upper: number; confidence: number } | null
  pairedCohensDz: number | null
  signPValue: number | null
  searchScore: number
  holdoutScore: number | null
  overfitGap: number | null
}

export interface GateDecision {
  verdict: GateVerdict
  reason: string
  baselineKey: string
  evidence: GateEvidence
}

const DEFAULTS = {
  minPairs: BOOTSTRAP_GATE_MIN_N,
  minimumDelta: 0,
  maximumOverfitGap: 0.2,
  confidence: 0.95,
  resamples: 2000,
  alpha: 0.05,
  seed: 0,
}

function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((sum, value) => sum + value, 0) / xs.length
}

function holdoutSummary(runs: readonly RunRecord[]): { count: number; mean: number | null } {
  const scores = runs
    .map((run) => run.outcome.holdoutScore)
    .filter((value): value is number => typeof value === 'number')
  return {
    count: scores.length,
    mean: scores.length > 0 ? mean(scores) : null,
  }
}

function indexBySeed(runs: readonly RunRecord[]): {
  records: Map<number, RunRecord>
  duplicateSeed: number | null
} {
  const records = new Map<number, RunRecord>()
  for (const run of runs) {
    if (records.has(run.seed)) return { records, duplicateSeed: run.seed }
    records.set(run.seed, run)
  }
  return { records, duplicateSeed: null }
}

export class HeldOutGate {
  private readonly cfg: Required<HeldOutGateConfig>

  constructor(config: HeldOutGateConfig) {
    const minPairs = config.minPairs ?? DEFAULTS.minPairs
    if (minPairs < BOOTSTRAP_GATE_MIN_N) {
      throw new RangeError(`minPairs must be at least ${BOOTSTRAP_GATE_MIN_N}`)
    }

    this.cfg = {
      baselineKey: config.baselineKey,
      minPairs,
      minimumDelta: config.minimumDelta ?? DEFAULTS.minimumDelta,
      maximumOverfitGap: config.maximumOverfitGap ?? DEFAULTS.maximumOverfitGap,
      confidence: config.confidence ?? DEFAULTS.confidence,
      resamples: config.resamples ?? DEFAULTS.resamples,
      alpha: config.alpha ?? DEFAULTS.alpha,
      seed: config.seed ?? DEFAULTS.seed,
    }
  }

  evaluate(candidate: readonly RunRecord[], baseline: readonly RunRecord[]): GateDecision {
    const candidateMean = mean(candidate.map((run) => run.outcome.searchScore))
    const candidateHoldout = holdoutSummary(candidate)
    const completeHoldout =
      candidateHoldout.count === candidate.length ? candidateHoldout.mean : null
    const overfitGap = completeHoldout === null ? null : candidateMean - completeHoldout
    const baseEvidence: GateEvidence = {
      candidateN: candidate.length,
      baselineN: baseline.length,
      pairedN: 0,
      holdoutN: candidateHoldout.count,
      pairedDeltaMedian: null,
      pairedDeltaMean: null,
      pairedDeltaInterval: null,
      pairedCohensDz: null,
      signPValue: null,
      searchScore: candidateMean,
      holdoutScore: candidateHoldout.mean,
      overfitGap,
    }

    const candidateBySeed = indexBySeed(candidate)
    const baselineBySeed = indexBySeed(baseline)
    if (candidateBySeed.duplicateSeed !== null || baselineBySeed.duplicateSeed !== null) {
      const duplicateSeed = candidateBySeed.duplicateSeed ?? baselineBySeed.duplicateSeed
      return this.decision(
        'HOLD',
        `duplicate seed ${duplicateSeed} prevents one-to-one pairing`,
        baseEvidence,
      )
    }

    const candidateSeeds = [...candidateBySeed.records.keys()].sort((a, b) => a - b)
    const missingFromBaseline = candidateSeeds.filter((seed) => !baselineBySeed.records.has(seed))
    const missingFromCandidate = [...baselineBySeed.records.keys()]
      .filter((seed) => !candidateBySeed.records.has(seed))
      .sort((a, b) => a - b)
    const pairedN = candidateSeeds.length - missingFromBaseline.length
    if (missingFromBaseline.length > 0 || missingFromCandidate.length > 0) {
      return this.decision(
        'HOLD',
        `seed sets differ: ${missingFromBaseline.length} missing from baseline, ` +
          `${missingFromCandidate.length} missing from candidate`,
        { ...baseEvidence, pairedN },
      )
    }

    if (pairedN < this.cfg.minPairs) {
      return this.decision('HOLD', `pairedN=${pairedN} below minPairs=${this.cfg.minPairs}`, {
        ...baseEvidence,
        pairedN,
      })
    }

    if (candidateHoldout.count > 0 && candidateHoldout.count < candidate.length) {
      return this.decision(
        'HOLD',
        `held-out scores are incomplete: ${candidateHoldout.count}/${candidate.length}`,
        { ...baseEvidence, pairedN },
      )
    }

    const candidateScores = candidateSeeds.map(
      (seed) => candidateBySeed.records.get(seed)!.outcome.searchScore,
    )
    const baselineScores = candidateSeeds.map(
      (seed) => baselineBySeed.records.get(seed)!.outcome.searchScore,
    )
    const bootstrap = pairedBootstrap(baselineScores, candidateScores, {
      confidence: this.cfg.confidence,
      resamples: this.cfg.resamples,
      statistic: 'median',
      seed: this.cfg.seed,
    })
    const deltas = candidateScores.map((score, index) => score - baselineScores[index])
    const pairedEffect = pairedCohensDz(baselineScores, candidateScores)
    const positiveSignTest = pairedSignTest(deltas, 'greater')
    const negativeSignTest = pairedSignTest(deltas, 'less')
    const evidence: GateEvidence = {
      ...baseEvidence,
      pairedN,
      pairedDeltaMedian: bootstrap.median,
      pairedDeltaMean: bootstrap.mean,
      pairedDeltaInterval: {
        lower: bootstrap.low,
        upper: bootstrap.high,
        confidence: bootstrap.confidence,
      },
      pairedCohensDz: pairedEffect,
      signPValue: positiveSignTest.pValue,
    }

    if (!bootstrap.gateEligible) {
      return this.decision(
        'HOLD',
        `paired bootstrap requires at least ${BOOTSTRAP_GATE_MIN_N} pairs`,
        evidence,
      )
    }

    if (overfitGap !== null && overfitGap >= this.cfg.maximumOverfitGap) {
      return this.decision(
        'REVERT',
        `overfit gap ${overfitGap.toFixed(4)} >= ${this.cfg.maximumOverfitGap}`,
        evidence,
      )
    }

    if (bootstrap.high < 0 && negativeSignTest.pValue < this.cfg.alpha) {
      return this.decision(
        'REVERT',
        `paired interval is below zero and sign p=${negativeSignTest.pValue.toFixed(4)} < ${this.cfg.alpha}`,
        evidence,
      )
    }

    const intervalClearsMinimum = bootstrap.low > this.cfg.minimumDelta
    const signIsSignificant = positiveSignTest.pValue < this.cfg.alpha
    if (intervalClearsMinimum && signIsSignificant && pairedEffect !== null) {
      return this.decision(
        'PROMOTE',
        `paired interval lower bound ${bootstrap.low.toFixed(4)} > ${this.cfg.minimumDelta}; ` +
          `sign p=${positiveSignTest.pValue.toFixed(4)} < ${this.cfg.alpha}; ` +
          `paired Cohen's dz=${pairedEffect.toFixed(3)}`,
        evidence,
      )
    }

    const reasons: string[] = []
    if (!intervalClearsMinimum) {
      reasons.push(
        `paired interval lower bound ${bootstrap.low.toFixed(4)} <= ${this.cfg.minimumDelta}`,
      )
    }
    if (!signIsSignificant) {
      reasons.push(`sign p=${positiveSignTest.pValue.toFixed(4)} >= ${this.cfg.alpha}`)
    }
    if (pairedEffect === null) reasons.push(`paired Cohen's dz is undefined`)
    return this.decision('HOLD', `inconclusive: ${reasons.join('; ')}`, evidence)
  }

  private decision(verdict: GateVerdict, reason: string, evidence: GateEvidence): GateDecision {
    return { verdict, reason, baselineKey: this.cfg.baselineKey, evidence }
  }
}
