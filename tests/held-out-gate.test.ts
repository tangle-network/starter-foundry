import assert from 'node:assert/strict'
import test from 'node:test'

import { validateRunRecord, type RunRecord, type RunSplitTag } from '@tangle-network/agent-eval'

import { HeldOutGate } from '../dist/lib/held-out-gate.js'

const PINNED_MODEL = 'claude-sonnet-4-6@2025-09-29'
let runSequence = 0

function makeRun(
  candidateId: string,
  scenarioId: string,
  splitTag: RunSplitTag,
  score: number,
  seed = 0,
): RunRecord {
  runSequence += 1
  return validateRunRecord({
    runId: `00000000-0000-4000-8000-${String(runSequence).padStart(12, '0')}`,
    experimentId: 'audit/held-out',
    scenarioId,
    candidateId,
    seed,
    model: PINNED_MODEL,
    promptHash: 'a'.repeat(64),
    configHash: 'b'.repeat(64),
    commitSha: 'deadbeef',
    wallMs: 1,
    costUsd: 0,
    costProvenance: { kind: 'observed', usd: 0 },
    tokenUsage: { input: 0, output: 0 },
    terminalOutcome: 'succeeded',
    outcome:
      splitTag === 'holdout' ? { holdoutScore: score, raw: {} } : { searchScore: score, raw: {} },
    splitTag,
  })
}

function makeArm(
  candidateId: string,
  searchScores: readonly number[],
  holdoutScores: readonly number[],
): RunRecord[] {
  assert.equal(searchScores.length, holdoutScores.length)
  return searchScores.flatMap((searchScore, index) => {
    const scenarioId = `case-${index}`
    return [
      makeRun(candidateId, scenarioId, 'search', searchScore),
      makeRun(candidateId, scenarioId, 'holdout', holdoutScores[index]!),
    ]
  })
}

function decisionFor(candidate: RunRecord[], baseline: RunRecord[]) {
  return new HeldOutGate({
    baselineKey: 'baseline',
    minProductiveRuns: 20,
    pairedDeltaThreshold: 0,
    overfitGapThreshold: 0.2,
    seed: 1,
  }).evaluate(candidate, baseline)
}

test('rejects the exact 40-pair candidate that regresses held-out by 0.295', () => {
  const n = 40
  const candidate = makeArm(
    'candidate',
    Array.from({ length: n }, () => 0.615),
    Array.from({ length: n }, () => 0.52),
  ).reverse()
  const baseline = makeArm(
    'baseline',
    Array.from({ length: n }, () => 0.415),
    Array.from({ length: n }, () => 0.815),
  )

  const decision = decisionFor(candidate, baseline)

  assert.equal(decision.verdict, 'REVERT', decision.reason)
  assert.equal(decision.rejectionCode, 'negative_delta')
  assert.equal(decision.evidence.productiveRuns, 40)
  assert.ok(Math.abs(decision.evidence.searchScore! - 0.615) < 1e-12)
  assert.ok(Math.abs(decision.evidence.holdoutScore! - 0.52) < 1e-12)
  assert.ok(Math.abs(decision.evidence.medianPairedDelta! - -0.295) < 1e-12)
  assert.ok(decision.evidence.pairedCI !== null && decision.evidence.pairedCI.high < 0)
})

test('never promotes a held-out regression through a negative configured threshold', () => {
  const scores = Array.from({ length: 24 }, () => 0.6)
  const regressed = Array.from({ length: 24 }, () => 0.5)
  const decision = new HeldOutGate({
    baselineKey: 'baseline',
    minProductiveRuns: 20,
    pairedDeltaThreshold: -0.2,
    seed: 1,
  }).evaluate(makeArm('candidate', regressed, regressed), makeArm('baseline', scores, scores))

  assert.equal(decision.verdict, 'REVERT', decision.reason)
  assert.equal(decision.rejectionCode, 'negative_delta')
  assert.ok(decision.evidence.pairedCI !== null && decision.evidence.pairedCI.high < 0)
})

test('promotes the exact 100-pair binary improvement from 50% to 75%', () => {
  const baselineScores = Array.from({ length: 100 }, (_, index) => (index < 50 ? 1 : 0))
  const candidateScores = Array.from({ length: 100 }, (_, index) => (index < 75 ? 1 : 0))
  const candidate = makeArm('candidate', candidateScores, candidateScores).reverse()
  const baseline = makeArm('baseline', baselineScores, baselineScores)

  const decision = decisionFor(candidate, baseline)

  assert.equal(decision.verdict, 'PROMOTE', decision.reason)
  assert.equal(decision.rejectionCode, null)
  assert.equal(decision.evidence.comparison, 'binary')
  assert.equal(decision.evidence.productiveRuns, 100)
  assert.equal(decision.evidence.medianPairedDelta, 0)
  assert.deepEqual(decision.evidence.pairedCI, { low: 0, high: 0 })
  assert.equal(decision.evidence.binaryRiskDifference?.riskDifference, 0.25)
  assert.ok((decision.evidence.binaryRiskDifference?.lower ?? 0) > 0)
  assert.equal(decision.evidence.binaryMcNemar?.b, 25)
  assert.equal(decision.evidence.binaryMcNemar?.c, 0)
  assert.ok((decision.evidence.binaryMcNemar?.pValue ?? 1) < 0.05)
})

test('pairs by scenarioId and seed rather than input position or seed alone', () => {
  const baseline: RunRecord[] = []
  const candidate: RunRecord[] = []
  for (let scenario = 0; scenario < 12; scenario += 1) {
    for (const seed of [0, 1]) {
      const scenarioId = `seeded-case-${scenario}`
      const baselineScore = seed === 0 ? 0.1 : 0.7
      const candidateScore = baselineScore + 0.2
      baseline.push(
        makeRun('baseline', scenarioId, 'search', baselineScore, seed),
        makeRun('baseline', scenarioId, 'holdout', baselineScore, seed),
      )
      candidate.push(
        makeRun('candidate', scenarioId, 'search', candidateScore, seed),
        makeRun('candidate', scenarioId, 'holdout', candidateScore, seed),
      )
    }
  }

  const decision = decisionFor(candidate.reverse(), baseline)

  assert.equal(decision.verdict, 'PROMOTE', decision.reason)
  assert.equal(decision.evidence.productiveRuns, 24)
  assert.ok(Math.abs(decision.evidence.medianPairedDelta! - 0.2) < 1e-12)
})

test('holds below the configured paired sample floor', () => {
  const baselineScores = Array.from({ length: 19 }, () => 0.4)
  const candidateScores = Array.from({ length: 19 }, () => 0.8)

  const decision = decisionFor(
    makeArm('candidate', candidateScores, candidateScores),
    makeArm('baseline', baselineScores, baselineScores),
  )

  assert.equal(decision.verdict, 'HOLD')
  assert.equal(decision.rejectionCode, 'few_runs')
})

test('throws when a split contains duplicate scenarioId and seed identities', () => {
  const baselineScores = Array.from({ length: 20 }, () => 0.4)
  const candidateScores = Array.from({ length: 20 }, () => 0.8)
  const candidate = makeArm('candidate', candidateScores, candidateScores)
  candidate[2] = {
    ...candidate[2]!,
    scenarioId: candidate[0]!.scenarioId,
    seed: candidate[0]!.seed,
  }

  assert.throws(
    () => decisionFor(candidate, makeArm('baseline', baselineScores, baselineScores)),
    /duplicate/i,
  )
})
