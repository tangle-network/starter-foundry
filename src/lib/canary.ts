/**
 * Canary release routing.
 *
 * Routes a configurable fraction of compose requests to a canary registry
 * (parallel to `registry/` at `registry-canary/`). Decision is deterministic
 * given a `consumerKey`, so the same consumer always lands in the same bucket
 * for the lifetime of an experiment — no session-affinity store needed.
 *
 * Hash function: FNV-1a 32-bit over `experiment:consumerKey`. The output is
 * uniformly distributed so `mod 10000 < pct*100` gives the target split to
 * within ±0.5pp over any reasonable sample of consumer keys.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { resolveRepoRoot } from './fs.js'

export interface CanaryExperiment {
  name: string
  /** 0..1 — fraction of consumers routed to canary */
  percent: number
  /** ISO timestamp after which the experiment is considered inactive */
  expiresAt?: string | null
  /** Optional explicit consumer key allowlist (always routed to canary) */
  force?: string[]
  /** Optional explicit consumer key denylist (always routed to main) */
  exclude?: string[]
}

export type CanaryBucket = 'canary' | 'main'

const FNV_OFFSET_32 = 0x811c9dc5
const FNV_PRIME_32 = 0x01000193

/**
 * FNV-1a 32-bit. Deterministic and dependency-free. Output is [0, 2^32).
 * Multiplication is force-truncated with Math.imul to avoid 53-bit float drift
 * on strings > ~6 chars where the running product silently overflows.
 */
function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_32
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME_32)
  }
  return hash >>> 0
}

/**
 * Core A/B decision primitive. Given a consumer key and an experiment,
 * returns which bucket the consumer lands in.
 *
 * Deterministic: the same `(consumerKey, experiment.name)` tuple always
 * produces the same bucket. Change the experiment name (not just the
 * percentage) to re-randomize.
 */
export function decideCanaryBucket(consumerKey: string, experiment: CanaryExperiment): CanaryBucket {
  if (experiment.exclude?.includes(consumerKey)) return 'main'
  if (experiment.force?.includes(consumerKey)) return 'canary'

  if (experiment.expiresAt) {
    const expires = Date.parse(experiment.expiresAt)
    if (!Number.isNaN(expires) && Date.now() > expires) return 'main'
  }

  const pct = Math.max(0, Math.min(1, experiment.percent))
  if (pct <= 0) return 'main'
  if (pct >= 1) return 'canary'

  // 4-digit resolution — 0.01% granularity is plenty for 5% rollouts.
  const bucket = fnv1a32(`${experiment.name}:${consumerKey}`) % 10000
  return bucket < Math.floor(pct * 10000) ? 'canary' : 'main'
}

/**
 * Select the registry version (canary vs main) for a given consumer.
 * Returns an absolute path the composer should use as its registry root.
 *
 * Falls back to `registry/` if:
 *   - experiment routes the consumer to main
 *   - `registry-canary/` doesn't exist on disk (guard against missing dir)
 */
export async function selectCanaryVersion(
  consumerKey: string,
  experiment: CanaryExperiment,
): Promise<{ bucket: CanaryBucket; registryRoot: string }> {
  const repoRoot = await resolveRepoRoot()
  const mainRoot = path.join(repoRoot, 'registry')
  const canaryRoot = path.join(repoRoot, 'registry-canary')

  const bucket = decideCanaryBucket(consumerKey, experiment)
  if (bucket === 'main') return { bucket, registryRoot: mainRoot }

  try {
    const stat = await fs.stat(canaryRoot)
    if (!stat.isDirectory()) return { bucket: 'main', registryRoot: mainRoot }
  } catch {
    return { bucket: 'main', registryRoot: mainRoot }
  }
  return { bucket: 'canary', registryRoot: canaryRoot }
}

/**
 * Default 5%-canary experiment the CI/CD pipeline promotes by name.
 * Tests import this to exercise the canonical config.
 */
export const DEFAULT_CANARY_EXPERIMENT: CanaryExperiment = {
  name: 'registry-canary-v1',
  percent: 0.05,
}
