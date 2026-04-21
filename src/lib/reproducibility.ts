// reproducibility — deterministic seed derivation + bit-identical replay
// verification. Given a ComposeSpec, seedForSpec() returns a stable sha256
// so callers can pin to it for byte-identical re-composition.
// Branch 8 commitment: "every compose gets a deterministic seed; bit-identical replay."

import { createHash } from 'node:crypto'
import type { ComposeSpec } from '../types.js'

export interface ComposeLockFile {
  schemaVersion: 1
  generatedAt: string
  spec: ComposeSpec
  seed: string
  foundryVersion: string
  /** Per-file SHA-256 of the composed output — the replay assertion. */
  fileHashes: Record<string, string>
}

/** Stable key order so two logically-equal specs hash to the same seed. */
function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(canonicalize)
  const obj = value as Record<string, unknown>
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort()) {
    if (obj[key] === undefined) continue
    sorted[key] = canonicalize(obj[key])
  }
  return sorted
}

export function seedForSpec(spec: ComposeSpec): string {
  const canonical = JSON.stringify(canonicalize(spec))
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}

/**
 * A deterministic pseudo-random number generator seeded from a string.
 * Replaces uses of `Math.random()` / `Date.now()` in the compose path so
 * the same spec always produces the same output.
 * Algorithm: SplitMix64, seeded from sha256 of the input.
 */
export interface SeededRng {
  next(): number
  nextInt(max: number): number
  pick<T>(items: readonly T[]): T
  hex(bytes: number): string
}

export function seededRng(seed: string): SeededRng {
  let state = BigInt('0x' + createHash('sha256').update(seed).digest('hex').slice(0, 16))
  const MASK_64 = (1n << 64n) - 1n
  const TWO_53 = 0x20000000000000n

  function step(): bigint {
    state = (state + 0x9E3779B97F4A7C15n) & MASK_64
    let z = state
    z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & MASK_64
    z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & MASK_64
    return z ^ (z >> 31n)
  }

  return {
    next() {
      const v = step() & (TWO_53 - 1n)
      return Number(v) / Number(TWO_53)
    },
    nextInt(max: number) {
      if (max <= 0) return 0
      return Math.floor(this.next() * max)
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('pick: empty array')
      return items[this.nextInt(items.length)]!
    },
    hex(bytes: number) {
      let out = ''
      for (let i = 0; i < bytes; i++) {
        const b = Number(step() & 0xFFn)
        out += b.toString(16).padStart(2, '0')
      }
      return out
    },
  }
}

export function buildLockFile(args: {
  spec: ComposeSpec
  foundryVersion: string
  fileHashes: Record<string, string>
}): ComposeLockFile {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    spec: canonicalize(args.spec) as ComposeSpec,
    seed: seedForSpec(args.spec),
    foundryVersion: args.foundryVersion,
    fileHashes: args.fileHashes,
  }
}

export function verifyLockMatches(lock: ComposeLockFile, actualHashes: Record<string, string>): {
  ok: boolean
  missing: string[]
  extra: string[]
  differing: Array<{ path: string; expected: string; actual: string }>
} {
  const expected = lock.fileHashes
  const missing: string[] = []
  const extra: string[] = []
  const differing: Array<{ path: string; expected: string; actual: string }> = []

  for (const [path, expectedSha] of Object.entries(expected)) {
    const actual = actualHashes[path]
    if (actual === undefined) {
      missing.push(path)
    } else if (actual !== expectedSha) {
      differing.push({ path, expected: expectedSha, actual })
    }
  }
  for (const path of Object.keys(actualHashes)) {
    if (expected[path] === undefined) extra.push(path)
  }
  return {
    ok: missing.length === 0 && extra.length === 0 && differing.length === 0,
    missing,
    extra,
    differing,
  }
}
