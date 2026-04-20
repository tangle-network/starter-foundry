import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aggregateByScenario,
  brokenScenarios,
  failingLayerHistogram,
  strongScenarios,
} from '../dist/lib/vb-outcomes.js'
import type { VBExecutionTrace } from '../dist/lib/vb-outcomes.js'

function makeTrace(
  scenarioId: string,
  partner: string,
  allPass: boolean,
  blendedScore: number,
  failingLayers: string[] = [],
): VBExecutionTrace {
  return {
    scenarioId,
    partner,
    latencyMs: 1000,
    timestamp: new Date().toISOString(),
    error: null,
    execution: {
      verticalId: 'ethereum-l1',
      generation: 21,
      variantName: 'test',
      model: 'sonnet',
      outcome: allPass ? 'satisfied' : 'max-wall-time',
      blendedScore,
      allPass,
      failingLayers,
      shotsToConvergence: allPass ? 1 : null,
      shotsRun: 1,
      wallMs: 1000,
      totalCostUsd: null,
      toolCallsTotal: 10,
      toolCallSuccesses: 10,
      toolCallFailures: 0,
      filesTouchedCount: 3,
      bashCommandsTop: [],
      sessionDir: '/tmp/test',
    },
  }
}

test('aggregateByScenario groups by (scenarioId, partner) and computes rates', () => {
  const traces: VBExecutionTrace[] = [
    makeTrace('alpha', 'p1', true, 0.9),
    makeTrace('alpha', 'p1', true, 0.95),
    makeTrace('alpha', 'p1', false, 0.5, ['lint']),
    makeTrace('beta', 'p1', false, 0.1, ['dependencies', 'lint']),
    makeTrace('beta', 'p1', false, 0.2, ['dependencies']),
  ]
  const out = aggregateByScenario(traces)
  const alpha = out.find((o) => o.scenarioId === 'alpha')!
  const beta = out.find((o) => o.scenarioId === 'beta')!
  assert.equal(alpha.runs, 3)
  assert.equal(alpha.passed, 2)
  assert.equal(alpha.passRate, 2 / 3)
  assert.ok(alpha.meanBlendedScore > 0.7 && alpha.meanBlendedScore < 0.85)
  assert.equal(alpha.failingLayersByKind['lint'], 1)
  assert.equal(beta.passRate, 0)
  assert.equal(beta.failingLayersByKind['dependencies'], 2)
})

test('brokenScenarios returns only zero-pass scenarios with at least 2 runs', () => {
  const traces = [
    makeTrace('broken-a', 'p1', false, 0, ['dependencies']),
    makeTrace('broken-a', 'p1', false, 0, ['dependencies']),
    makeTrace('one-off', 'p1', false, 0, ['lint']),
    makeTrace('working', 'p1', true, 1),
    makeTrace('working', 'p1', true, 1),
  ]
  const out = aggregateByScenario(traces)
  const broken = brokenScenarios(out)
  assert.equal(broken.length, 1)
  assert.equal(broken[0]!.scenarioId, 'broken-a')
})

test('strongScenarios returns 100%-pass scenarios with score ≥ 0.9 and ≥2 runs', () => {
  const traces = [
    makeTrace('strong', 'p1', true, 0.95),
    makeTrace('strong', 'p1', true, 0.98),
    makeTrace('mid', 'p1', true, 0.7),
    makeTrace('mid', 'p1', true, 0.7),
  ]
  const out = aggregateByScenario(traces)
  const strong = strongScenarios(out)
  assert.equal(strong.length, 1)
  assert.equal(strong[0]!.scenarioId, 'strong')
})

test('failingLayerHistogram sums across all traces', () => {
  const traces = [
    makeTrace('a', 'p', false, 0, ['lint', 'dependencies']),
    makeTrace('b', 'p', false, 0, ['lint']),
    makeTrace('c', 'p', false, 0, ['semantic']),
  ]
  const hist = failingLayerHistogram(traces)
  assert.equal(hist['lint'], 2)
  assert.equal(hist['dependencies'], 1)
  assert.equal(hist['semantic'], 1)
})
