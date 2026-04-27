// Per-turn scorer — unmeasured-vs-failed disambiguation.
//
// Regression bait:
//   - Pre-fix bug: turns with `weightTotal === 0` (no rubric matched any
//     span) returned aggregateScore=0, which severityFromScore promoted
//     to 'critical' findings in gradeSemanticStatus. Test asserts those
//     turns now report `status: 'unmeasured'`, aggregateScore=null,
//     contribute zero weight to cumulative, and never produce 'critical'.

import test, { describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  scorePerTurn,
} from '../src/eval/trace/per-turn-scorer.js'
import type {
  StepRubric,
  Trajectory,
  TrajectoryStep,
  Span,
} from '@tangle-network/agent-eval'

function llmStep(index: number, spanId: string, runId: string, output: string): TrajectoryStep {
  const span: Span = {
    spanId,
    runId,
    kind: 'llm',
    name: 'gen',
    startedAt: 0,
    endedAt: 1,
    status: 'ok',
    model: 'test-model',
    messages: [{ role: 'user', content: 'hi' }],
    output,
  }
  return { index, span, depth: 0, events: [] }
}

function buildFiveTurnTrajectory(runId: string): {
  trajectory: Trajectory
  stepsByTurn: TrajectoryStep[][]
} {
  const turns: TrajectoryStep[][] = []
  const all: TrajectoryStep[] = []
  let idx = 0
  for (let t = 1; t <= 5; t += 1) {
    // Turns 2 and 4 are tool spans (non-llm) so the llm-only rubric won't match.
    const isLlm = t !== 2 && t !== 4
    if (isLlm) {
      const step = llmStep(idx, `s${idx}`, runId, `output for turn ${t}`)
      turns.push([step])
      all.push(step)
      idx += 1
    } else {
      const span: Span = {
        spanId: `s${idx}`,
        runId,
        kind: 'tool',
        name: 'noop',
        startedAt: 0,
        endedAt: 1,
        status: 'ok',
        toolName: 'noop',
        args: {},
      }
      const step: TrajectoryStep = { index: idx, span, depth: 0, events: [] }
      turns.push([step])
      all.push(step)
      idx += 1
    }
  }
  const trajectory: Trajectory = {
    runId,
    steps: all,
    llmTurns: 3,
    toolCalls: 2,
    judgeVerdicts: 0,
    retrievals: 0,
    totalDurationMs: 5,
  }
  return { trajectory, stepsByTurn: turns }
}

const llmOnlyRubric: StepRubric = {
  id: 'llm-output-good',
  kinds: ['llm'],
  weight: 1,
  grade: async () => ({ score: 0.9, rationale: 'looks good' }),
}

describe('per-turn-scorer: unmeasured turns are not silently failed', () => {
  test('5-turn run with llm-only rubric reports turns 2 + 4 as unmeasured', async () => {
    const { trajectory, stepsByTurn } = buildFiveTurnTrajectory('run-1')
    const report = await scorePerTurn({
      scenarioId: 'scenario-1',
      runId: 'run-1',
      trajectory,
      stepsByTurn,
      rubrics: [llmOnlyRubric],
    })
    assert.equal(report.perTurn.length, 5)
    assert.equal(report.perTurn[0]!.status, 'measured')
    assert.equal(report.perTurn[1]!.status, 'unmeasured', 'turn 2 had no llm span')
    assert.equal(report.perTurn[2]!.status, 'measured')
    assert.equal(report.perTurn[3]!.status, 'unmeasured', 'turn 4 had no llm span')
    assert.equal(report.perTurn[4]!.status, 'measured')
    assert.equal(report.perTurn[1]!.aggregateScore, null)
    assert.equal(report.perTurn[3]!.aggregateScore, null)
  })

  test('cumulative score excludes unmeasured turns (no zero-pollution)', async () => {
    const { trajectory, stepsByTurn } = buildFiveTurnTrajectory('run-2')
    const report = await scorePerTurn({
      scenarioId: 'scenario-1',
      runId: 'run-2',
      trajectory,
      stepsByTurn,
      rubrics: [llmOnlyRubric],
    })
    // 3 measured turns × 0.9 → cumulative 0.9, NOT (3*0.9 + 2*0)/5 = 0.54.
    assert.ok(
      Math.abs(report.cumulativeScore - 0.9) < 1e-9,
      `cumulative should be 0.9 (excluding unmeasured), got ${report.cumulativeScore}`,
    )
  })

  test('convergence turn lands on first measured turn meeting threshold', async () => {
    const { trajectory, stepsByTurn } = buildFiveTurnTrajectory('run-3')
    const report = await scorePerTurn({
      scenarioId: 'scenario-1',
      runId: 'run-3',
      trajectory,
      stepsByTurn,
      rubrics: [llmOnlyRubric],
      threshold: 0.7,
    })
    // Turn 1 is measured at 0.9 ≥ 0.7 → converges at turn 1.
    assert.equal(report.convergenceTurn, 1)
  })

  test('all-unmeasured run does not emit critical findings or fake convergence', async () => {
    // Build a run where every step is a tool span, so the llm-only rubric never matches.
    const span = (i: number): TrajectoryStep => ({
      index: i,
      span: {
        spanId: `s${i}`,
        runId: 'run-x',
        kind: 'tool',
        name: 't',
        startedAt: 0,
        endedAt: 1,
        status: 'ok',
        toolName: 't',
        args: {},
      },
      depth: 0,
      events: [],
    })
    const steps = [span(0), span(1), span(2)]
    const trajectory: Trajectory = {
      runId: 'run-x',
      steps,
      llmTurns: 0,
      toolCalls: 3,
      judgeVerdicts: 0,
      retrievals: 0,
      totalDurationMs: 3,
    }
    const stepsByTurn = [[steps[0]!], [steps[1]!], [steps[2]!]]
    const report = await scorePerTurn({
      scenarioId: 'scenario-x',
      runId: 'run-x',
      trajectory,
      stepsByTurn,
      rubrics: [llmOnlyRubric],
    })
    assert.equal(report.cumulativeScore, 0)
    assert.equal(report.convergenceTurn, null, 'no measured turn ⇒ no convergence')
    // gradeSemanticStatus saw `available: false`. Status must NOT be 'pass'
    // — there's nothing to pass. Either 'unavailable' or 'fail' is acceptable;
    // 'pass' would be a muffled gate.
    assert.notEqual(report.status, 'pass', 'all-unmeasured run must not falsely pass')
  })
})
