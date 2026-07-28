import assert from 'node:assert/strict'
import test from 'node:test'

import { HeldOutGate } from '../dist/lib/held-out-gate.js'
import { makeRunRecord, type RunRecord } from '../dist/lib/run-record.js'

const PINNED_MODEL = 'claude-sonnet-4-6@claude-sonnet-4-5-20250929'

function makeBatch(scores: number[], opts: { holdout?: number[] } = {}): RunRecord[] {
  return scores.map((score, i) =>
    makeRunRecord({
      experimentId: 'audit/test',
      candidateId: `c-${i}`,
      seed: i,
      model: PINNED_MODEL,
      promptHash: 'p'.repeat(64),
      configHash: 'c'.repeat(64),
      commitSha: 'sha',
      wallMs: 0,
      costUsd: 0,
      tokenUsage: { input: 0, output: 0 },
      outcome: {
        searchScore: score,
        raw: {},
        ...(opts.holdout ? { holdoutScore: opts.holdout[i] } : {}),
      },
      splitTag: 'search',
      source: 'foundry',
    }),
  )
}

const BASELINE = Array.from({ length: 24 }, (_, i) => 0.42 + (i % 6) * 0.015)
const BETTER = BASELINE.map((score, i) => score + 0.16 + (i % 4) * 0.005)
const WORSE = BASELINE.map((score, i) => score - 0.14 - (i % 3) * 0.005)

test('HOLD below the paired sample floor', () => {
  const decision = new HeldOutGate({ baselineKey: 'b' }).evaluate(
    makeBatch(BETTER.slice(0, 19)),
    makeBatch(BASELINE.slice(0, 19)),
  )

  assert.equal(decision.verdict, 'HOLD')
  assert.match(decision.reason, /below minPairs=20/)
})

test('HOLD when candidate and baseline runs cannot be paired', () => {
  const baseline = makeBatch(BASELINE.slice(0, 23))
  baseline[0] = { ...baseline[0], seed: 99 }
  const decision = new HeldOutGate({ baselineKey: 'b' }).evaluate(makeBatch(BETTER), baseline)

  assert.equal(decision.verdict, 'HOLD')
  assert.equal(decision.evidence.pairedN, 22)
  assert.match(decision.reason, /seed sets differ/)
})

test('pairs by seed rather than array position', () => {
  const baseline = makeBatch(BASELINE).reverse()
  const decision = new HeldOutGate({ baselineKey: 'b', seed: 1 }).evaluate(
    makeBatch(BETTER),
    baseline,
  )

  assert.equal(decision.verdict, 'PROMOTE', decision.reason)
})

test('HOLD when duplicate seeds make pairing ambiguous', () => {
  const candidate = makeBatch(BETTER)
  candidate[1] = { ...candidate[1], seed: candidate[0].seed }
  const decision = new HeldOutGate({ baselineKey: 'b' }).evaluate(candidate, makeBatch(BASELINE))

  assert.equal(decision.verdict, 'HOLD')
  assert.match(decision.reason, /duplicate seed/)
})

test('PROMOTE only when paired evidence clears every requirement', () => {
  const decision = new HeldOutGate({ baselineKey: 'b', seed: 1 }).evaluate(
    makeBatch(BETTER),
    makeBatch(BASELINE),
  )

  assert.equal(decision.verdict, 'PROMOTE', decision.reason)
  assert.ok(
    decision.evidence.pairedDeltaInterval !== null &&
      decision.evidence.pairedDeltaInterval.lower > 0,
  )
  assert.ok(decision.evidence.pairedCohensDz !== null && decision.evidence.pairedCohensDz > 0)
  assert.ok(decision.evidence.signPValue !== null && decision.evidence.signPValue < 0.05)
})

test('REVERT when paired evidence is significantly worse', () => {
  const decision = new HeldOutGate({ baselineKey: 'b', seed: 1 }).evaluate(
    makeBatch(WORSE),
    makeBatch(BASELINE),
  )

  assert.equal(decision.verdict, 'REVERT', decision.reason)
  assert.ok(
    decision.evidence.pairedDeltaInterval !== null &&
      decision.evidence.pairedDeltaInterval.upper < 0,
  )
})

test('REVERT when search performance does not survive held-out evaluation', () => {
  const candidate = makeBatch(BETTER, {
    holdout: BETTER.map((score) => score - 0.3),
  })
  const decision = new HeldOutGate({
    baselineKey: 'b',
    maximumOverfitGap: 0.2,
    seed: 1,
  }).evaluate(candidate, makeBatch(BASELINE))

  assert.equal(decision.verdict, 'REVERT', decision.reason)
  assert.match(decision.reason, /overfit gap/)
})

test('HOLD when held-out scores cover only part of the candidate runs', () => {
  const holdout = BETTER.map((score, index) => (index === 0 ? score : undefined))
  const candidate = makeBatch(BETTER)
  candidate[0] = {
    ...candidate[0],
    outcome: { ...candidate[0].outcome, holdoutScore: holdout[0] },
  }
  const decision = new HeldOutGate({ baselineKey: 'b' }).evaluate(candidate, makeBatch(BASELINE))

  assert.equal(decision.verdict, 'HOLD')
  assert.match(decision.reason, /held-out scores are incomplete/)
})

test('HOLD when a constant non-zero delta makes paired effect undefined', () => {
  const baseline = Array.from({ length: 20 }, () => 0.5)
  const candidate = Array.from({ length: 20 }, () => 0.75)
  const decision = new HeldOutGate({ baselineKey: 'b' }).evaluate(
    makeBatch(candidate),
    makeBatch(baseline),
  )

  assert.equal(decision.verdict, 'HOLD')
  assert.equal(decision.evidence.pairedCohensDz, null)
  assert.match(decision.reason, /undefined/)
})

test('rejects a configured sample floor below the calibrated minimum', () => {
  assert.throws(
    () => new HeldOutGate({ baselineKey: 'b', minPairs: 19 }),
    /minPairs must be at least 20/,
  )
})

test('decision records the baseline key', () => {
  const decision = new HeldOutGate({ baselineKey: 'frontier-2026-04' }).evaluate(
    makeBatch(BETTER),
    makeBatch(BASELINE),
  )
  assert.equal(decision.baselineKey, 'frontier-2026-04')
})
