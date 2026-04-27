// Pairwise runner — REAL position-bias correction tests.
//
// Regression bait:
//   - Bug pre-fix: the runner reused the per-variant rubric score for both
//     orderings (`posA1Win = sa >= sb; posB1Win = sb >= sa`) so positional
//     bias was structurally undetectable. Test asserts that a position-
//     biased judge surfaces with non-trivial avgDelta and forces ties.
//   - Bug pre-fix: judge was never invoked twice. Test counts judge calls
//     and asserts 2× shared scenarios (one per ordering).

import test, { describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  runPairwise,
  type PairwiseJudge,
  type ScenarioOutput,
  type VariantOutputs,
} from '../src/eval/judges/pairwise-runner.js'

const baseScore = {
  success: 0.8,
  goalProgress: 0.8,
  repoGroundedness: 0.7,
  driftPenalty: 0.0,
  toolUseQuality: 0.8,
  patchQuality: 0.0,
  testReality: 0.0,
  finalGate: 0.8,
  reviewerBlockers: 0,
  costUsd: 0.01,
  wallSeconds: 1,
}

function scenario(id: string, output: string): ScenarioOutput {
  return {
    scenarioId: id,
    output,
    bundle: {
      id: `${id}-bundle`,
      coderPrompt: 'p',
      skills: [],
      rolePrompts: {},
      metadata: {},
    },
    score: baseScore,
  }
}

const variantA: VariantOutputs = {
  variantId: 'A',
  family: 'claude-opus-4',
  scenarios: [scenario('s1', 'a-one'), scenario('s2', 'a-two'), scenario('s3', 'a-three')],
}

const variantB: VariantOutputs = {
  variantId: 'B',
  family: 'gpt-4o',
  scenarios: [scenario('s1', 'b-one'), scenario('s2', 'b-two'), scenario('s3', 'b-three')],
}

describe('pairwise-runner: real position-bias correction', () => {
  test('judge is invoked twice per shared scenario (both orderings)', async () => {
    const calls: Array<{ first: string; second: string; scenarioId: string }> = []
    const judge: PairwiseJudge = async ({ first, second, scenarioId }) => {
      calls.push({ first: first.output, second: second.output, scenarioId })
      return { firstScore: 0.7, secondScore: 0.6 }
    }
    await runPairwise({ variantA, variantB, judge })
    // 3 shared scenarios × 2 orderings = 6 invocations.
    assert.equal(calls.length, 6, 'judge must run twice per scenario')
    // Spot-check: every scenario id appears with each variant in the
    // first slot at least once.
    const aFirst = calls.filter((c) => c.first.startsWith('a-'))
    const bFirst = calls.filter((c) => c.first.startsWith('b-'))
    assert.equal(aFirst.length, 3, 'A presented first 3 times')
    assert.equal(bFirst.length, 3, 'B presented first 3 times')
  })

  test('position-biased judge (always prefers second slot) → INCONCLUSIVE / ties + high bias', async () => {
    // Adversarial judge: always scores whichever variant is in the SECOND
    // slot higher. With real position-bias correction, both orderings can
    // never agree on a winner → every scenario is a tie.
    const judge: PairwiseJudge = async () => ({ firstScore: 0.5, secondScore: 0.9 })
    const report = await runPairwise({ variantA, variantB, judge })
    assert.equal(report.winCounts.tie, 3, 'every scenario should tie under pure position bias')
    assert.equal(report.winCounts.a, 0)
    assert.equal(report.winCounts.b, 0)
    // avgDelta from positionalBias() = mean(first-second). Always-second-wins
    // judge yields per-variant first-minus-second of -0.4 → avgDelta -0.4.
    assert.ok(
      Math.abs(report.bias.position.avgDelta) >= 0.3,
      `expected non-trivial position bias, got ${report.bias.position.avgDelta}`,
    )
  })

  test('clean stable judge → A wins both orderings yields verdict A', async () => {
    // Realistic judge: A is genuinely better, no positional confound.
    const judge: PairwiseJudge = async ({ first }) => {
      const firstIsA = first.output.startsWith('a-')
      return firstIsA
        ? { firstScore: 0.9, secondScore: 0.6 } // A first, B second
        : { firstScore: 0.6, secondScore: 0.9 } // B first, A second
    }
    const report = await runPairwise({ variantA, variantB, judge })
    assert.equal(report.winCounts.a, 3, 'A must win every scenario')
    assert.equal(report.winCounts.tie, 0)
    // Position bias should be near zero — judge agrees A wins regardless of slot.
    assert.ok(
      Math.abs(report.bias.position.avgDelta) < 0.05,
      `position bias should be ~0 for stable judge, got ${report.bias.position.avgDelta}`,
    )
  })

  test('per-scenario observations expose all four raw scores for forensics', async () => {
    let calls = 0
    const judge: PairwiseJudge = async () => {
      calls += 1
      // Distinguishable score per call so we can verify they land in the right slot.
      return { firstScore: 0.5 + calls * 0.01, secondScore: 0.4 + calls * 0.01 }
    }
    const report = await runPairwise({
      variantA: { ...variantA, scenarios: variantA.scenarios.slice(0, 1) },
      variantB: { ...variantB, scenarios: variantB.scenarios.slice(0, 1) },
      judge,
    })
    assert.equal(report.perScenario.length, 1)
    const obs = report.perScenario[0]!.observations
    const close = (got: number, want: number, label: string) =>
      assert.ok(Math.abs(got - want) < 1e-9, `${label}: expected ${want}, got ${got}`)
    close(obs.aFirstScore, 0.51, 'order1 firstScore = A first')
    close(obs.bSecondScore, 0.41, 'order1 secondScore = B second')
    close(obs.bFirstScore, 0.52, 'order2 firstScore = B first')
    close(obs.aSecondScore, 0.42, 'order2 secondScore = A second')
  })
})
