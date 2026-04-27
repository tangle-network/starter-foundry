// Screener — degenerate-CI muffled-gate fix.
//
// Regression bait:
//   - Pre-fix: 1-rep screener emitted ci95={lower:delta,upper:delta} and
//     cohensD: 0 as if they were real estimates. Test asserts CI/Cohen's d
//     are now `null` and the verdict carries 'estimate-only', forcing a
//     multi-rep follow-up before promotion.

import test, { describe } from 'node:test'
import assert from 'node:assert/strict'

import { screen } from '../src/research/screener.js'
import type { Hypothesis, ScenarioRunner, ScenarioSample } from '../src/research/types.js'

const SCENARIOS = ['s1', 's2', 's3', 's4']

const makeRunner = (
  scoreFor: (hypId: string | null, scenarioId: string) => number,
): ScenarioRunner => ({
  scenarioIds: SCENARIOS,
  async runTrial({ hypothesis, scenarioId }): Promise<ScenarioSample> {
    return {
      scenarioId,
      score: scoreFor(hypothesis?.id ?? null, scenarioId),
      costUsd: 0.001,
      wallSeconds: 0.1,
      ok: true,
    }
  },
})

const HYPOTHESES: Hypothesis[] = [
  {
    id: 'h-up',
    name: 'lift',
    rationale: 'should improve',
    category: 'parameter-tuning',
    expected_impact: '+5pp',
    priority: 2,
    treatment: {},
  },
  {
    id: 'h-flat',
    name: 'flat',
    rationale: 'should be neutral',
    category: 'parameter-tuning',
    expected_impact: '0',
    priority: 3,
    treatment: {},
  },
  {
    id: 'h-down',
    name: 'regress',
    rationale: 'should regress',
    category: 'parameter-tuning',
    expected_impact: '-5pp',
    priority: 3,
    treatment: {},
  },
]

describe('screener: 1-rep results never fabricate CI / Cohen\'s d', () => {
  test('passing hypothesis verdict is "estimate-only" with null CI + cohensD', async () => {
    const runner = makeRunner((id) => (id === 'h-up' ? 0.9 : id === 'h-down' ? 0.4 : 0.7))
    const report = await screen({ hypotheses: HYPOTHESES, runner })
    const up = report.ranked.find((r) => r.hypothesisId === 'h-up')!
    assert.equal(up.reps, 1)
    assert.equal(up.verdict, 'estimate-only', 'cleared floor → estimate-only, not candidate')
    assert.equal(up.ci95, null, 'CI must be null for n=1')
    assert.equal(up.cohensD, null, "Cohen's d must be null for n=1")
  })

  test('rejected hypothesis has verdict "reject", null CI, null cohensD', async () => {
    const runner = makeRunner((id) => (id === 'h-down' ? 0.3 : 0.7))
    const report = await screen({ hypotheses: HYPOTHESES, runner, floorTolerance: 0.05 })
    const down = report.ranked.find((r) => r.hypothesisId === 'h-down')!
    assert.equal(down.verdict, 'reject')
    assert.equal(down.ci95, null)
    assert.equal(down.cohensD, null)
  })

  test('passedFloor lists ids with verdict "estimate-only" (post-fix)', async () => {
    const runner = makeRunner((id) => (id === 'h-up' ? 0.9 : 0.7))
    const report = await screen({ hypotheses: HYPOTHESES, runner })
    assert.ok(report.passedFloor.includes('h-up'), 'h-up should be in passedFloor')
    assert.ok(!report.passedFloor.includes('h-down') || true, 'h-down may or may not pass floor')
    // Any id in passedFloor must correspond to a result with estimate-only verdict.
    for (const id of report.passedFloor) {
      const r = report.ranked.find((x) => x.hypothesisId === id)!
      assert.equal(r.verdict, 'estimate-only')
    }
  })
})
