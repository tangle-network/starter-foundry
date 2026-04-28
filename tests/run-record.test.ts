/**
 * RunRecord validation tests — bare-alias rejection, missing-field rejection,
 * and happy-path round-trip via makeRunRecord.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isPinnedModel,
  makeRunRecord,
  RunRecordValidationError,
  validateRunRecord,
} from '../dist/lib/run-record.js'

const VALID = {
  runId: '00000000-0000-0000-0000-000000000001',
  experimentId: 'audit/gen17',
  candidateId: 'remix-static-ts',
  seed: 0,
  model: 'claude-sonnet-4-6@claude-sonnet-4-5-20250929',
  promptHash: 'a'.repeat(64),
  configHash: 'b'.repeat(64),
  commitSha: 'deadbeef',
  wallMs: 1234,
  costUsd: 0.012,
  tokenUsage: { input: 100, output: 200 },
  outcome: { searchScore: 0.85, raw: { install: true, typecheck: true } },
  splitTag: 'search' as const,
  source: 'foundry' as const,
}

test('validateRunRecord accepts a fully-formed record', () => {
  const record = validateRunRecord(VALID)
  assert.equal(record.runId, VALID.runId)
  assert.equal(record.outcome.searchScore, 0.85)
})

test('validateRunRecord rejects bare alias model', () => {
  const bad = { ...VALID, model: 'claude-sonnet-4-6' }
  assert.throws(
    () => validateRunRecord(bad),
    (e: unknown) =>
      e instanceof RunRecordValidationError && e.issues.some((i) => i.includes('not pinned')),
  )
})

test('validateRunRecord rejects missing required fields', () => {
  const { runId: _runId, ...partial } = VALID
  assert.throws(
    () => validateRunRecord(partial),
    (e: unknown) => e instanceof RunRecordValidationError && e.issues.some((i) => i.includes('runId')),
  )
})

test('validateRunRecord rejects bad outcome.raw value', () => {
  const bad = {
    ...VALID,
    outcome: { searchScore: 0.5, raw: { broken: 'string-value' as unknown as number } },
  }
  assert.throws(
    () => validateRunRecord(bad),
    (e: unknown) =>
      e instanceof RunRecordValidationError && e.issues.some((i) => i.includes('outcome.raw.broken')),
  )
})

test('validateRunRecord allows historical sentinel only with splitTag=historical', () => {
  const ok = { ...VALID, model: 'claude-sonnet-4-6@unknown-historical', splitTag: 'historical' as const }
  assert.doesNotThrow(() => validateRunRecord(ok))

  const bad = { ...VALID, model: 'claude-sonnet-4-6@unknown-historical', splitTag: 'search' as const }
  assert.throws(
    () => validateRunRecord(bad),
    (e: unknown) => e instanceof RunRecordValidationError && e.issues.some((i) => i.includes('not pinned')),
  )
})

test('isPinnedModel basic shape checks', () => {
  assert.equal(isPinnedModel('claude-sonnet-4-6@claude-sonnet-4-5-20250929'), true)
  assert.equal(isPinnedModel('claude-sonnet-4-6'), false)
  assert.equal(isPinnedModel('@no-alias'), false)
  assert.equal(isPinnedModel('alias@'), false)
  assert.equal(isPinnedModel('claude-sonnet-4-6@unknown-historical', 'historical'), true)
  assert.equal(isPinnedModel('claude-sonnet-4-6@unknown-historical', 'search'), false)
})

test('makeRunRecord round-trips through validation', () => {
  const r = makeRunRecord({
    experimentId: 'proposer/family',
    candidateId: 'remix-static-ts',
    seed: 42,
    model: 'claude-sonnet-4-6@claude-sonnet-4-5-20250929',
    promptHash: 'p'.repeat(64),
    configHash: 'c'.repeat(64),
    commitSha: 'feedface',
    wallMs: 10,
    costUsd: 0.001,
    tokenUsage: { input: 1, output: 2 },
    outcome: { searchScore: 1, holdoutScore: 0.9, raw: { passed: true } },
    splitTag: 'search',
    source: 'foundry',
  })
  assert.match(r.runId, /^[0-9a-f-]{36}$/)
  assert.equal(r.outcome.holdoutScore, 0.9)
})
