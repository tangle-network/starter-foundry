// compose-seed.ts — deterministic seed for bit-identical replay of
// composeStarter(). Every component of the compose result that's
// seed-dependent (variant picks, library version picks, brand-tokens
// hash fallback) reads a single 32-byte seed derived from:
//
//   SHA-256(projectName + "|" + family + "|" + sorted(layers).join(",") + "|" + partnerId)
//
// Plus an optional STARTER_FOUNDRY_SEED env override for testing or
// explicit replay. Passing the same spec + same seed to composeStarter
// must produce byte-identical output — the reproducibility guarantee
// consumers need for signed audit trails + supply-chain provenance.

import { createHash } from 'node:crypto'
import type { ComposeSpec } from '../types.js'

/**
 * Derive the 32-byte replay seed for a compose spec. Pure function of
 * the spec shape — not of time, random, or env unless the operator
 * explicitly overrides via STARTER_FOUNDRY_SEED.
 */
export function deriveComposeSeed(spec: ComposeSpec, envSeed?: string): Buffer {
  const override = envSeed ?? process.env['STARTER_FOUNDRY_SEED']
  if (override && /^[a-f0-9]{64}$/i.test(override)) {
    return Buffer.from(override, 'hex')
  }
  const layers = [...(spec.layers ?? [])].sort().join(',')
  const parts = [
    spec.projectName,
    spec.family,
    layers,
    spec.partner ?? '',
  ]
  return createHash('sha256').update(parts.join('|')).digest()
}

/**
 * Convenience: first 4 bytes as uint32 (for modulo picks).
 */
export function seedToUint32(seed: Buffer): number {
  return seed.readUInt32BE(0)
}

/**
 * Convenience: hex-encoded seed for logging + audit trails.
 */
export function seedToHex(seed: Buffer): string {
  return seed.toString('hex')
}
