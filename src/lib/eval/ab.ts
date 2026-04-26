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

interface ExperimentVariant {
  id: string
  /** Relative weight within the participating population (defaults to 1). */
  weight?: number
}

interface Experiment {
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
    n = n * 256 + h[i]
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
    throw new Error(
      `abDecide: experiment ${experiment.id} has invalid rampPct ${experiment.rampPct}`,
    )
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
    cum += weights[i] / total
    if (variantBucket < cum) {
      return {
        experimentId: experiment.id,
        variantId: experiment.variants[i].id,
        inRamp: true,
        bucket: variantBucket,
      }
    }
  }
  // Numerical fallback (shouldn't hit unless floating point slop).
  return {
    experimentId: experiment.id,
    variantId: experiment.variants[experiment.variants.length - 1].id,
    inRamp: true,
    bucket: variantBucket,
  }
}
