/**
 * A/B experiment primitive.
 *
 * Experiments live as JSON files in `.evolve/experiments/*.json`. They are
 * loaded and consulted at runtime by abDecide(), which deterministically
 * bucket a caller into a variant based on an opaque key (typically the
 * sessionId or compose spec signature) and the experiment's ramp.
 *
 * Deterministic: same (experimentId, bucketKey) always yields the same variant.
 * This is critical so that:
 *   - a single session sees one variant throughout,
 *   - analysis by bucketKey is consistent across re-processing.
 *
 * Ramp semantics:
 *   - rampPct: 0..100 — fraction of keys that participate. The rest see
 *     controlVariant (if set) or are "excluded" (variant=null).
 *   - Among participants, variants are weighted by their `weight` field
 *     (defaults to equal weight).
 */

import { createHash } from 'node:crypto'

export interface ExperimentVariant {
  id: string
  /** Relative weight within the participating population (defaults to 1). */
  weight?: number
}

export interface Experiment {
  schemaVersion: 1
  /** Unique experiment id, e.g. "brand-voice-test". */
  id: string
  /** Human-readable description. */
  description: string
  /** Absolute percentage of keys that participate (0-100). */
  rampPct: number
  /** ISO 8601. null = running. */
  startedAt: string
  stoppedAt: string | null
  /** Variants the experiment splits traffic across. At least two. */
  variants: ExperimentVariant[]
  /**
   * Fallback variant id for callers outside the ramp. null = those callers
   * get variant = null from abDecide().
   */
  controlVariantId: string | null
  /** Primary success metric (free-form, for analysis). */
  primaryMetric: string
}

/** Back-compat alias — earlier API shipped as `AbExperiment`. */
export type AbExperiment = Experiment

export interface AbDecision {
  experimentId: string
  variantId: string | null
  /** True if the key fell inside the ramp. */
  inRamp: boolean
  /** The hash bucket in [0,1). Useful for debugging + per-key audit. */
  bucket: number
}

function hashToBucket(experimentId: string, bucketKey: string): number {
  // SHA-256 first 8 bytes interpreted as big-endian uint64, divided by max.
  const h = createHash('sha256').update(`${experimentId}::${bucketKey}`).digest()
  // Use top 52 bits (max precision of Number) to avoid precision loss.
  let n = 0
  for (let i = 0; i < 7; i++) {
    n = n * 256 + h[i]!
  }
  // 7 bytes = 56 bits; divide by 2^56.
  return n / 2 ** 56
}

/**
 * Deterministically assign a bucket key to a variant of the given experiment.
 * Stable across process invocations.
 */
export function abDecide(experiment: Experiment, bucketKey: string): AbDecision {
  if (!experiment.variants.length) {
    throw new Error(`abDecide: experiment ${experiment.id} has no variants`)
  }
  if (experiment.rampPct < 0 || experiment.rampPct > 100) {
    throw new Error(`abDecide: experiment ${experiment.id} has invalid rampPct ${experiment.rampPct}`)
  }

  // Two independent buckets derived from the same key so ramp and
  // variant selection don't correlate.
  const rampBucket = hashToBucket(`${experiment.id}::ramp`, bucketKey)
  const inRamp = rampBucket * 100 < experiment.rampPct

  if (!inRamp) {
    return {
      experimentId: experiment.id,
      variantId: experiment.controlVariantId,
      inRamp: false,
      bucket: rampBucket,
    }
  }

  const variantBucket = hashToBucket(`${experiment.id}::variant`, bucketKey)
  const weights = experiment.variants.map((v) => v.weight ?? 1)
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) throw new Error(`abDecide: total variant weight is 0 for ${experiment.id}`)

  let cum = 0
  for (let i = 0; i < experiment.variants.length; i++) {
    cum += weights[i]! / total
    if (variantBucket < cum) {
      return {
        experimentId: experiment.id,
        variantId: experiment.variants[i]!.id,
        inRamp: true,
        bucket: variantBucket,
      }
    }
  }
  // Numerical fallback (shouldn't hit unless floating point slop).
  return {
    experimentId: experiment.id,
    variantId: experiment.variants[experiment.variants.length - 1]!.id,
    inRamp: true,
    bucket: variantBucket,
  }
}

/**
 * Two-sample Welch's t-test. Returns the t-statistic, degrees of freedom,
 * and a two-sided p-value. Used by ab-analyze to report significance.
 *
 * Inputs: two arrays of observations (e.g. per-session scores for variant A
 * vs variant B). Returns null when a sample has <2 observations or
 * zero variance.
 */
export interface TTestResult {
  /** Number of observations in each sample. */
  nA: number
  nB: number
  meanA: number
  meanB: number
  varA: number
  varB: number
  t: number
  df: number
  /** Two-sided p-value in [0,1]. */
  pValue: number
  /** Convenience: p < 0.05. */
  significant: boolean
}

export function welchTTest(a: number[], b: number[]): TTestResult | null {
  const nA = a.length
  const nB = b.length
  if (nA < 2 || nB < 2) return null
  const meanA = a.reduce((x, y) => x + y, 0) / nA
  const meanB = b.reduce((x, y) => x + y, 0) / nB
  const varA = a.reduce((x, y) => x + (y - meanA) ** 2, 0) / (nA - 1)
  const varB = b.reduce((x, y) => x + (y - meanB) ** 2, 0) / (nB - 1)
  if (varA === 0 && varB === 0) return null
  const se = Math.sqrt(varA / nA + varB / nB)
  if (se === 0) return null
  const t = (meanA - meanB) / se
  const num = (varA / nA + varB / nB) ** 2
  const den = (varA / nA) ** 2 / (nA - 1) + (varB / nB) ** 2 / (nB - 1)
  const df = num / den
  const pValue = twoSidedPValue(t, df)
  return { nA, nB, meanA, meanB, varA, varB, t, df, pValue, significant: pValue < 0.05 }
}

// Student's t cumulative distribution using the regularized incomplete beta
// function. Handles the general (non-integer) df case needed by Welch's test.
function twoSidedPValue(t: number, df: number): number {
  const x = df / (df + t * t)
  const p = incompleteBeta(x, df / 2, 0.5)
  // Clamp to [0,1].
  return Math.max(0, Math.min(1, p))
}

function logGamma(z: number): number {
  const g = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 1.208650973866179e-3,
    -5.395239384953e-6,
  ]
  let x = z
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let i = 0; i < 6; i++) {
    x += 1
    ser += g[i]! / x
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / z)
}

function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  )
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(x, a, b)) / a
  }
  return 1 - (bt * betacf(1 - x, b, a)) / b
}

function betacf(x: number, a: number, b: number): number {
  const fpmin = 1e-30
  const maxIter = 200
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < fpmin) d = fpmin
  d = 1 / d
  let h = d
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < fpmin) d = fpmin
    c = 1 + aa / c
    if (Math.abs(c) < fpmin) c = fpmin
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < fpmin) d = fpmin
    c = 1 + aa / c
    if (Math.abs(c) < fpmin) c = fpmin
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 3e-7) break
  }
  return h
}
