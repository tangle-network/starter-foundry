/**
 * HeldOutGate decision tests — productive-runs floor, paired-delta + Cohen's d
 * thresholds, overfit-gap REVERT path, BH correction.
 *
 * No mocked stats — uses the real `bootstrapCi` / `pairedTTest` / `cohensD` /
 * `benjaminiHochberg` from current agent-eval.
 */

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

test('HOLD when n < minProductiveRuns', () => {
  const gate = new HeldOutGate({ baselineKey: 'b' })
  const decision = gate.evaluate(makeBatch([0.9, 0.95]), makeBatch([0.5, 0.55]))
  assert.equal(decision.verdict, 'HOLD')
  assert.match(decision.reason, /below minProductiveRuns/)
})

test('PROMOTE on a clear positive delta with adequate effect size', () => {
  const gate = new HeldOutGate({ baselineKey: 'b', seed: 1 })
  // Large, consistent improvement: candidate ~0.9, baseline ~0.5
  const baseline = makeBatch([0.5, 0.52, 0.48, 0.51, 0.49, 0.53, 0.5, 0.48])
  const candidate = makeBatch([0.92, 0.89, 0.94, 0.88, 0.93, 0.9, 0.95, 0.87])
  const decision = gate.evaluate(candidate, baseline)
  assert.equal(
    decision.verdict,
    'PROMOTE',
    `expected PROMOTE got ${decision.verdict}: ${decision.reason}`,
  )
  assert.ok(decision.evidence.cohensD !== null && decision.evidence.cohensD > 0.5)
  assert.ok(decision.evidence.pairedDeltaMedian > 0)
})

test('REVERT on overfit (held-out gap exceeds threshold)', () => {
  const gate = new HeldOutGate({ baselineKey: 'b', overfitGapThreshold: 0.2, seed: 1 })
  const baseline = makeBatch([0.5, 0.52, 0.48, 0.51, 0.49, 0.53])
  // Candidate scores 0.95 on search but only 0.5 on held-out → overfit gap = 0.45
  const candidate = makeBatch([0.95, 0.95, 0.95, 0.95, 0.95, 0.95], {
    holdout: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  })
  const decision = gate.evaluate(candidate, baseline)
  assert.equal(
    decision.verdict,
    'REVERT',
    `expected REVERT got ${decision.verdict}: ${decision.reason}`,
  )
  assert.match(decision.reason, /overfit-gap/)
  assert.ok(decision.evidence.overfitGap !== null && decision.evidence.overfitGap >= 0.2)
})

test('REVERT on significantly worse paired-delta', () => {
  const gate = new HeldOutGate({ baselineKey: 'b', seed: 1 })
  const baseline = makeBatch([0.9, 0.92, 0.88, 0.91, 0.89, 0.93, 0.9, 0.88])
  const candidate = makeBatch([0.48, 0.55, 0.47, 0.53, 0.46, 0.57, 0.49, 0.44])
  const decision = gate.evaluate(candidate, baseline)
  assert.equal(
    decision.verdict,
    'REVERT',
    `expected REVERT got ${decision.verdict}: ${decision.reason}`,
  )
  assert.ok(decision.evidence.pairedDeltaMedian < 0)
})

test("HOLD when delta exists but Cohen's d below threshold", () => {
  // Pick widely-spread distributions so the effect size is small even with
  // a positive mean delta. Threshold set high so d falls below it.
  const gate = new HeldOutGate({ baselineKey: 'b', cohensDThreshold: 5.0, seed: 1 })
  const baseline = makeBatch([0.1, 0.3, 0.5, 0.7, 0.9, 0.45, 0.55, 0.65])
  const candidate = makeBatch([0.2, 0.4, 0.6, 0.8, 0.95, 0.55, 0.65, 0.75])
  const decision = gate.evaluate(candidate, baseline)
  assert.equal(
    decision.verdict,
    'HOLD',
    `expected HOLD got ${decision.verdict}: ${decision.reason}`,
  )
  assert.ok(decision.evidence.cohensD !== null && Math.abs(decision.evidence.cohensD) < 5.0)
})

test('BH correction applies q-value when applyBHCorrection: true', () => {
  const gate = new HeldOutGate({ baselineKey: 'b', applyBHCorrection: true, seed: 1 })
  const baseline = makeBatch([0.5, 0.52, 0.48, 0.51, 0.49, 0.53])
  const candidate = makeBatch([0.92, 0.89, 0.94, 0.88, 0.93, 0.9])
  const decision = gate.evaluate(candidate, baseline)
  assert.notEqual(decision.evidence.qValueBh, null)
})

test('q-value is null when applyBHCorrection: false', () => {
  const gate = new HeldOutGate({ baselineKey: 'b', applyBHCorrection: false, seed: 1 })
  const baseline = makeBatch([0.5, 0.52, 0.48, 0.51, 0.49, 0.53])
  const candidate = makeBatch([0.9, 0.92, 0.88, 0.91, 0.89, 0.93])
  const decision = gate.evaluate(candidate, baseline)
  assert.equal(decision.evidence.qValueBh, null)
})

test('HOLD when constant non-zero deltas make paired significance undefined', () => {
  const gate = new HeldOutGate({ baselineKey: 'b' })
  const decision = gate.evaluate(makeBatch([0.75, 0.75, 0.75]), makeBatch([0.5, 0.5, 0.5]))

  assert.equal(decision.verdict, 'HOLD')
  assert.equal(decision.evidence.cohensD, null)
  assert.equal(decision.evidence.pValue, null)
  assert.match(decision.reason, /undefined/)
})

test('decision carries baselineKey for traceability', () => {
  const gate = new HeldOutGate({ baselineKey: 'frontier-2026-04' })
  const decision = gate.evaluate(makeBatch([0.9, 0.9, 0.9]), makeBatch([0.5, 0.5, 0.5]))
  assert.equal(decision.baselineKey, 'frontier-2026-04')
})
