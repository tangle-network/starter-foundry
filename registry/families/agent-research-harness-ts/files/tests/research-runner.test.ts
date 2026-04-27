/**
 * research-harness tests.
 *
 * These exercise the screener + validator + runner directly with a
 * synthetic ScenarioRunner so we don't depend on a live LLM or eval
 * harness. The shape under test:
 *
 *   1. queue load — validates the JSON schema gate before any run.
 *   2. proposer output shape — verifies parseHypotheses + verifier gates.
 *   3. screener ranks correctly — descending by delta, floor enforced.
 *   4. validator gates correctly — promote/reject/inconclusive verdicts.
 *
 * Each test names a concrete regression it would catch.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { propose } from '../src/research/proposer.js'
import { loadQueue, runScreen, runSweep } from '../src/research/runner.js'
import { screen } from '../src/research/screener.js'
import { validate } from '../src/research/validator.js'
import type { Hypothesis, ScenarioRunner, ScenarioSample } from '../src/research/types.js'

function tmpFile(name: string, content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'research-harness-'))
  const path = join(dir, name)
  writeFileSync(path, content, 'utf8')
  return path
}

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'research-harness-results-'))
}

interface FakeRunnerInput {
  scenarioIds: readonly string[]
  /** Map hypothesis id → score per scenario. `null` means baseline. */
  scores: Map<string | null, Map<string, number>>
  costPerCall?: number
  wallPerCall?: number
}

function fakeRunner(input: FakeRunnerInput): ScenarioRunner {
  return {
    scenarioIds: input.scenarioIds,
    runTrial: async ({ hypothesis, scenarioId }): Promise<ScenarioSample> => {
      const key = hypothesis?.id ?? null
      const map = input.scores.get(key)
      const score = map?.get(scenarioId) ?? 0
      return {
        scenarioId,
        score,
        costUsd: input.costPerCall ?? 0.01,
        wallSeconds: input.wallPerCall ?? 1,
        ok: score > 0,
      }
    },
  }
}

test('queue load — rejects malformed queue', () => {
  const bad = tmpFile('bad-queue.json', JSON.stringify({ wrongKey: [] }))
  assert.throws(() => loadQueue(bad), /missing 'hypotheses' array/)

  const good = tmpFile(
    'good-queue.json',
    JSON.stringify({
      hypotheses: [
        {
          id: 'h-1',
          name: 'one',
          rationale: 'because',
          category: 'bug-fix',
          expected_impact: 'pass: +5pp',
          priority: 1,
          treatment: { kind: 'noop' },
        },
      ],
    }),
  )
  const queue = loadQueue(good)
  assert.equal(queue.hypotheses.length, 1)
  assert.equal(queue.hypotheses[0]?.id, 'h-1')
})

test('proposer — verifier rejects malformed LLM output and reports issues', async () => {
  const out = await propose({
    goal: 'reduce judge-rubric failures on tool-use scenarios',
    count: 4,
    callJson: async () => ({ hypotheses: 'not-an-array' }),
    maxShots: 2,
  })
  assert.equal(out.hypotheses.length, 0)
  assert.equal(out.report.finalVerification.pass, false)
  // Reviewer should have run and asked for a revision.
  assert.ok(out.report.shots.length >= 1)
})

test('proposer — verifier accepts well-shaped output covering required categories', async () => {
  const draft: Hypothesis[] = [
    {
      id: 'fix-tool-loop',
      name: 'Fix tool-call loop',
      rationale: 'Trace shows infinite loop on rate-limit; needs backoff.',
      category: 'bug-fix',
      expected_impact: 'pass rate: +3pp',
      priority: 1,
      treatment: { kind: 'patch', sha: 'deadbeef' },
    },
    {
      id: 'parallel-tools',
      name: 'Parallel independent tools',
      rationale: 'Independent tool calls serialised; batch them.',
      category: 'architectural',
      expected_impact: 'wallSeconds: -30%',
      priority: 1,
      treatment: { kind: 'system-prompt-delta', append: '...' },
    },
    {
      id: 'cheaper-model-cot',
      name: 'Cheaper model on CoT',
      rationale: 'CoT scenarios show cost dominated by reasoning tokens.',
      category: 'efficiency',
      expected_impact: 'cost: -25%',
      priority: 2,
      treatment: { kind: 'config', delta: { reasoningModel: 'haiku' } },
    },
  ]
  const out = await propose({
    goal: 'broad improvement sweep',
    count: 3,
    callJson: async () => ({ hypotheses: draft }),
    maxShots: 1,
  })
  assert.equal(out.hypotheses.length, 3)
  assert.equal(out.report.finalVerification.pass, true)
  const ids = out.hypotheses.map((h) => h.id).sort()
  assert.deepEqual(ids, ['cheaper-model-cot', 'fix-tool-loop', 'parallel-tools'])
})

test('screener — ranks descending by delta and enforces floor', async () => {
  const scenarioIds = ['s1', 's2', 's3']
  const baselineMap = new Map([
    ['s1', 0.5],
    ['s2', 0.5],
    ['s3', 0.5],
  ])
  const winnerMap = new Map([
    ['s1', 0.8],
    ['s2', 0.7],
    ['s3', 0.6],
  ])
  const looserMap = new Map([
    ['s1', 0.55],
    ['s2', 0.55],
    ['s3', 0.55],
  ])
  const wreckMap = new Map([
    ['s1', 0.1],
    ['s2', 0.2],
    ['s3', 0.1],
  ])
  const runner = fakeRunner({
    scenarioIds,
    scores: new Map<string | null, Map<string, number>>([
      [null, baselineMap],
      ['winner', winnerMap],
      ['looser', looserMap],
      ['wreck', wreckMap],
    ]),
  })
  const hypotheses: Hypothesis[] = [
    {
      id: 'wreck',
      name: 'wreck',
      rationale: 'r',
      category: 'parameter-tuning',
      expected_impact: 'x',
      priority: 3,
      treatment: {},
    },
    {
      id: 'looser',
      name: 'looser',
      rationale: 'r',
      category: 'efficiency',
      expected_impact: 'x',
      priority: 2,
      treatment: {},
    },
    {
      id: 'winner',
      name: 'winner',
      rationale: 'r',
      category: 'architectural',
      expected_impact: 'x',
      priority: 1,
      treatment: {},
    },
  ]
  const report = await screen({
    hypotheses,
    runner,
    floorTolerance: 0.02,
    now: () => new Date('2026-01-01T00:00:00Z'),
  })
  // Sorted descending by delta: winner > looser > wreck.
  assert.deepEqual(
    report.ranked.map((r) => r.hypothesisId),
    ['winner', 'looser', 'wreck'],
  )
  // Floor: winner + looser pass; wreck rejected.
  assert.deepEqual(report.passedFloor, ['winner', 'looser'])
  const wreckResult = report.ranked.find((r) => r.hypothesisId === 'wreck')
  assert.equal(wreckResult?.verdict, 'reject')
})

test('screener — refuses to run with <3 scenarios (catches anti-overfitting violation)', async () => {
  const runner = fakeRunner({
    scenarioIds: ['only-one'],
    scores: new Map(),
  })
  await assert.rejects(
    () =>
      screen({
        hypotheses: [],
        runner,
      }),
    /requires >= 3 scenarios/,
  )
})

test('validator — promotes when CI lower bound > 0', async () => {
  // Big consistent positive delta → CI strictly > 0.
  const scenarioIds = ['s1', 's2', 's3', 's4']
  const baseMap = new Map(scenarioIds.map((id, i) => [id, 0.4 + i * 0.01]))
  const winMap = new Map(scenarioIds.map((id, i) => [id, 0.85 + i * 0.01]))
  const runner = fakeRunner({
    scenarioIds,
    scores: new Map<string | null, Map<string, number>>([
      [null, baseMap],
      ['big-win', winMap],
    ]),
  })
  const report = await validate({
    hypotheses: [
      {
        id: 'big-win',
        name: 'big',
        rationale: 'r',
        category: 'architectural',
        expected_impact: 'x',
        priority: 1,
        treatment: {},
      },
    ],
    runner,
    reps: 3,
    iterations: 500,
    seed: 42,
  })
  const result = report.results[0]
  assert.ok(result, 'expected a result')
  assert.equal(result.verdict, 'promote')
  assert.ok(result.ci95.lower > 0, `expected ciLower > 0, got ${result.ci95.lower}`)
  assert.equal(report.paretoFrontier.length, 1)
})

test('validator — rejects when CI upper bound < 0', async () => {
  const scenarioIds = ['s1', 's2', 's3', 's4']
  const baseMap = new Map(scenarioIds.map((id, i) => [id, 0.85 + i * 0.01]))
  const loseMap = new Map(scenarioIds.map((id, i) => [id, 0.4 + i * 0.01]))
  const runner = fakeRunner({
    scenarioIds,
    scores: new Map<string | null, Map<string, number>>([
      [null, baseMap],
      ['big-loss', loseMap],
    ]),
  })
  const report = await validate({
    hypotheses: [
      {
        id: 'big-loss',
        name: 'lose',
        rationale: 'r',
        category: 'parameter-tuning',
        expected_impact: 'x',
        priority: 3,
        treatment: {},
      },
    ],
    runner,
    reps: 3,
    iterations: 500,
    seed: 42,
  })
  const result = report.results[0]
  assert.ok(result, 'expected a result')
  assert.equal(result.verdict, 'reject')
  assert.ok(result.ci95.upper < 0, `expected ciUpper < 0, got ${result.ci95.upper}`)
})

test('validator — refuses empty candidate set in runner.runValidate', async () => {
  const queuePath = tmpFile(
    'queue.json',
    JSON.stringify({
      hypotheses: [
        {
          id: 'real-one',
          name: 'real',
          rationale: 'r',
          category: 'bug-fix',
          expected_impact: 'x',
          priority: 1,
          treatment: {},
        },
      ],
    }),
  )
  const { runValidate } = await import('../src/research/runner.js')
  const runner = fakeRunner({
    scenarioIds: ['s1', 's2', 's3'],
    scores: new Map(),
  })
  await assert.rejects(
    () =>
      runValidate({
        queuePath,
        resultsDir: tmpDir(),
        runner,
        candidateIds: ['nonexistent'],
      }),
    /empty candidate set/,
  )
})

test('runSweep — writes scorecard and skips validate when no candidates pass', async () => {
  const scenarioIds = ['s1', 's2', 's3']
  // All hypotheses worse than baseline → none pass screener floor.
  const baseMap = new Map(scenarioIds.map((id) => [id, 0.9]))
  const badMap = new Map(scenarioIds.map((id) => [id, 0.1]))
  const queuePath = tmpFile(
    'queue.json',
    JSON.stringify({
      hypotheses: [
        {
          id: 'bad-1',
          name: 'bad',
          rationale: 'r',
          category: 'parameter-tuning',
          expected_impact: 'x',
          priority: 3,
          treatment: {},
        },
      ],
    }),
  )
  const resultsDir = tmpDir()
  const runner = fakeRunner({
    scenarioIds,
    scores: new Map<string | null, Map<string, number>>([
      [null, baseMap],
      ['bad-1', badMap],
    ]),
  })
  const out = await runSweep({
    queuePath,
    resultsDir,
    runner,
    runId: 'test-sweep',
    now: () => new Date('2026-01-01T00:00:00Z'),
  })
  assert.equal(out.queueSize, 1)
  assert.equal(out.screen.passedFloor.length, 0)
  assert.equal(out.validate, null)
  assert.match(out.scorecardPath, /scorecard\.json$/)
})

test('runScreen — persists report to results dir', async () => {
  const scenarioIds = ['s1', 's2', 's3']
  const baseMap = new Map(scenarioIds.map((id) => [id, 0.5]))
  const winMap = new Map(scenarioIds.map((id) => [id, 0.7]))
  const queuePath = tmpFile(
    'queue.json',
    JSON.stringify({
      hypotheses: [
        {
          id: 'good',
          name: 'good',
          rationale: 'r',
          category: 'architectural',
          expected_impact: 'x',
          priority: 1,
          treatment: {},
        },
      ],
    }),
  )
  const resultsDir = tmpDir()
  const runner = fakeRunner({
    scenarioIds,
    scores: new Map<string | null, Map<string, number>>([
      [null, baseMap],
      ['good', winMap],
    ]),
  })
  const { report, path } = await runScreen({
    queuePath,
    resultsDir,
    runner,
    runId: 'unit-test',
  })
  assert.equal(report.runId, 'unit-test')
  assert.equal(report.passedFloor.length, 1)
  assert.match(path, /unit-test\/screen\.json$/)
})
