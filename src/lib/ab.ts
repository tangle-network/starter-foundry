// A/B experiment primitive. Consumers pick a variant at compose time
// based on a stable hash of the caller-supplied key (usually sessionId).
// When a variant is promoted, emit its outcome back via emitBuildoutEvent
// tagged with `abExperiment: <name>` + `abVariant: <a|b>` — the detector
// aggregates outcomes per variant, the judge decides.

export interface AbExperiment {
  name: string
  variants: Record<string, { weight: number }>
  /** Ramp — 0.0 to 1.0, fraction of traffic included in the experiment. Non-included users get "control". */
  ramp?: number
}

export interface AbDecision {
  experiment: string
  variant: string
  included: boolean
}

function stableHash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * Pick a variant for `key` given `experiment`. Deterministic — same key
 * gets the same variant across processes. Use sessionId or stable userId
 * as the key, NEVER the prompt (you want a user's experience consistent
 * across their session).
 */
export function abDecide(experiment: AbExperiment, key: string): AbDecision {
  const ramp = experiment.ramp ?? 1.0
  const hash = stableHash(`${experiment.name}|${key}`)
  const rampBucket = (hash % 1000) / 1000
  if (rampBucket >= ramp) {
    return { experiment: experiment.name, variant: 'control', included: false }
  }
  const variants = Object.entries(experiment.variants)
  const totalWeight = variants.reduce((a, [, v]) => a + v.weight, 0)
  const choiceBucket = ((hash >> 10) % 1000) / 1000 * totalWeight
  let accum = 0
  for (const [name, cfg] of variants) {
    accum += cfg.weight
    if (choiceBucket < accum) {
      return { experiment: experiment.name, variant: name, included: true }
    }
  }
  const last = variants[variants.length - 1]!
  return { experiment: experiment.name, variant: last[0], included: true }
}
