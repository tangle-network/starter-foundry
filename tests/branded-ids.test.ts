// Branded ID type guards — runtime + compile-time. The compile-time
// guards are *static checks* expressed via @ts-expect-error annotations:
// if the brand stops working, the @ts-expect-error fails to fire and the
// test fails to compile. Any change that re-allows raw-string assignment
// to a branded slot will surface here as a CI compile failure.

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  familyId,
  layerId,
  partnerId,
  capabilityId,
  isFamilyId,
  isLayerId,
  unsafeFamilyId,
  type FamilyId,
  type LayerId,
  type CapabilityId,
} from '../dist/types/ids.js'

// ── Runtime constructors validate format ──────────────────────────────

test('familyId() validates kebab-case and brands', () => {
  const id: FamilyId = familyId('agent-runtime-research')
  assert.equal(typeof id, 'string')
  assert.equal(id, 'agent-runtime-research')
})

test('familyId() throws on invalid format', () => {
  assert.throws(() => familyId('Foo'), /must match/)
  assert.throws(() => familyId('foo bar'), /must match/)
  assert.throws(() => familyId('foo_bar'), /must match/)
  assert.throws(() => familyId('-foo'), /must match/)
  assert.throws(() => familyId('1foo'), /must match/)
  assert.throws(() => familyId(''), /must match/)
})

test('layerId() accepts both kebab-case and "group:id" forms', () => {
  assert.equal(layerId('postgres'), 'postgres')
  assert.equal(layerId('database:postgres'), 'database:postgres')
  assert.equal(layerId('agent-tools:phony-voice'), 'agent-tools:phony-voice')
})

test('layerId() rejects malformed inputs', () => {
  assert.throws(() => layerId('Database:Postgres'), /must be kebab-case/)
  assert.throws(() => layerId('database:'), /must be kebab-case/)
  assert.throws(() => layerId(':postgres'), /must be kebab-case/)
  assert.throws(() => layerId('database:postgres:extra'), /must be kebab-case/)
})

test('partnerId() and capabilityId() share the kebab rule', () => {
  assert.equal(partnerId('coinbase'), 'coinbase')
  assert.equal(capabilityId('voice-stt'), 'voice-stt')
  assert.throws(() => partnerId('Coinbase'), /must match/)
  assert.throws(() => capabilityId('Voice STT'), /must match/)
})

// ── Type guards narrow correctly ─────────────────────────────────────

test('isFamilyId() narrows unknown to FamilyId', () => {
  const x: unknown = 'agent-runtime-research'
  if (isFamilyId(x)) {
    // x is now FamilyId; this assignment compiles.
    const id: FamilyId = x
    assert.equal(id, 'agent-runtime-research')
  } else {
    assert.fail('should have narrowed')
  }
})

test('isLayerId() distinguishes valid from invalid', () => {
  assert.equal(isLayerId('postgres'), true)
  assert.equal(isLayerId('database:postgres'), true)
  assert.equal(isLayerId('Database'), false)
  assert.equal(isLayerId(123), false)
  assert.equal(isLayerId(null), false)
})

// ── unsafeFamilyId() bypasses validation (manifest-loader path) ───────

test('unsafeFamilyId() brands without validating — caller asserts trust', () => {
  // Real-world use: the manifest loader has already validated via JSON schema,
  // so we skip the regex re-check.
  const id: FamilyId = unsafeFamilyId('any-string-the-caller-trusts')
  assert.equal(id, 'any-string-the-caller-trusts')
})

// ── Compile-time guards (these annotations require the brand to work) ─

test('compile-time: FamilyId is not assignable from raw string', () => {
  // @ts-expect-error — raw string is not a FamilyId without the brand.
  const wrong: FamilyId = 'agent-runtime-research'
  assert.equal(typeof wrong, 'string') // runtime still works; brand is type-only
})

test('compile-time: FamilyId and LayerId are mutually incompatible', () => {
  const fid: FamilyId = familyId('foo')
  // @ts-expect-error — can't pass FamilyId where LayerId is expected.
  const wrong: LayerId = fid
  assert.equal(wrong, 'foo')
})

test('compile-time: CapabilityId is distinct from FamilyId', () => {
  const cid: CapabilityId = capabilityId('voice-stt')
  // @ts-expect-error — CapabilityId is not a FamilyId.
  const wrong: FamilyId = cid
  assert.equal(wrong, 'voice-stt')
})
