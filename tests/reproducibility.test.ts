// Reproducibility — the seed+lock contract that guarantees bit-identical
// replay. The compose pipeline itself is still being hardened; this test
// locks in the `seedForSpec`, `seededRng`, and lock-file math.

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  seedForSpec,
  seededRng,
  buildLockFile,
  verifyLockMatches,
} from '../dist/lib/reproducibility.js'
import type { ComposeSpec } from '../dist/types.js'

const sampleSpec: ComposeSpec = {
  projectName: 'atlas',
  family: 'nextjs-ts',
  layers: ['framework:nextjs-app-router', 'capability:tailwind', 'capability:shadcn'],
  partner: null,
  slots: { auth: 'auth:better-auth' },
  variables: { headline: 'h', subheadline: 's' },
}

test('seedForSpec: logically-equal specs hash to the same seed (key order, layer order irrelevant to outcome)', () => {
  const a = seedForSpec({ ...sampleSpec })
  // Same layers in a different object order — canonicalize sorts keys.
  const reordered: ComposeSpec = {
    variables: { subheadline: 's', headline: 'h' },
    slots: { auth: 'auth:better-auth' },
    partner: null,
    layers: ['framework:nextjs-app-router', 'capability:tailwind', 'capability:shadcn'],
    family: 'nextjs-ts',
    projectName: 'atlas',
  }
  const b = seedForSpec(reordered)
  assert.equal(a, b, 'key-order-only difference must not change the seed')
})

test('seedForSpec: different specs produce different seeds', () => {
  const a = seedForSpec(sampleSpec)
  const b = seedForSpec({ ...sampleSpec, projectName: 'orion' })
  assert.notEqual(a, b)
})

test('seedForSpec: undefined fields do not contribute to the seed', () => {
  const a = seedForSpec(sampleSpec)
  const withUndef = { ...sampleSpec, extra: undefined } as ComposeSpec
  const b = seedForSpec(withUndef)
  assert.equal(a, b)
})

test('seededRng: same seed yields the same sequence', () => {
  const r1 = seededRng('deadbeef')
  const r2 = seededRng('deadbeef')
  const seq1 = [r1.next(), r1.next(), r1.nextInt(100), r1.nextInt(100), r1.hex(4)]
  const seq2 = [r2.next(), r2.next(), r2.nextInt(100), r2.nextInt(100), r2.hex(4)]
  assert.deepEqual(seq1, seq2)
})

test('seededRng: different seeds yield different sequences', () => {
  const r1 = seededRng('seed-a')
  const r2 = seededRng('seed-b')
  const s1 = Array.from({ length: 10 }, () => r1.next())
  const s2 = Array.from({ length: 10 }, () => r2.next())
  assert.notDeepEqual(s1, s2)
})

test('seededRng: pick is deterministic', () => {
  const r1 = seededRng('fixed')
  const r2 = seededRng('fixed')
  const items = ['a', 'b', 'c', 'd', 'e']
  for (let i = 0; i < 5; i++) {
    assert.equal(r1.pick(items), r2.pick(items))
  }
})

test('buildLockFile: captures seed + foundryVersion + hashes in the lock', () => {
  const fileHashes = { 'package.json': 'aa', 'AGENTS.md': 'bb' }
  const lock = buildLockFile({ spec: sampleSpec, foundryVersion: '0.5.4', fileHashes })
  assert.equal(lock.schemaVersion, 1)
  assert.equal(lock.seed, seedForSpec(sampleSpec))
  assert.equal(lock.foundryVersion, '0.5.4')
  assert.deepEqual(lock.fileHashes, fileHashes)
})

test('verifyLockMatches: identical hashes → ok=true', () => {
  const fileHashes = { 'package.json': 'aa', 'AGENTS.md': 'bb' }
  const lock = buildLockFile({ spec: sampleSpec, foundryVersion: '0.5.4', fileHashes })
  const result = verifyLockMatches(lock, fileHashes)
  assert.equal(result.ok, true)
  assert.deepEqual(result.differing, [])
  assert.deepEqual(result.missing, [])
  assert.deepEqual(result.extra, [])
})

test('verifyLockMatches: differing + missing + extra surface cleanly', () => {
  const fileHashes = { 'package.json': 'aa', 'AGENTS.md': 'bb' }
  const lock = buildLockFile({ spec: sampleSpec, foundryVersion: '0.5.4', fileHashes })
  const actual = { 'package.json': 'cc', 'llms.txt': 'dd' }
  const result = verifyLockMatches(lock, actual)
  assert.equal(result.ok, false)
  assert.deepEqual(result.missing, ['AGENTS.md'])
  assert.deepEqual(result.extra, ['llms.txt'])
  assert.equal(result.differing.length, 1)
  assert.equal(result.differing[0]!.path, 'package.json')
  assert.equal(result.differing[0]!.expected, 'aa')
  assert.equal(result.differing[0]!.actual, 'cc')
})
