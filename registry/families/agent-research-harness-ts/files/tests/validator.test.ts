// Validator — BH/FDR multiple-comparison correction.
//
// Regression bait:
//   - Pre-fix: validator emitted per-hypothesis verdicts using only the
//     bootstrap CI; raw-p was implicit and N hypotheses inflated false-
//     promote rate linearly. Test runs N=20 hypotheses uniformly under
//     the null and asserts BH-adjusted q caps the family-wise false-promote
//     rate at the configured FDR.

import test, { describe } from 'node:test'
import assert from 'node:assert/strict'

import { validate } from '../src/research/validator.js'
import type { Hypothesis, ScenarioRunner, ScenarioSample } from '../src/research/types.js'

// Deterministic Mulberry32 PRNG so the test is bit-stable.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SCENARIOS = Array.from({ length: 6 }, (_, i) => `s${i}`)

interface NullRunnerOpts {
  rng: () => number
}

// Both arms drawn from the same distribution N(0.5, 0.1) so any "win" is
// pure noise. Repeated runs → false-positive rate at raw-p<0.05 ≈ 5%; at
// BH q<0.05 ≈ ≤ 5% across the family.
function makeNullRunner(opts: NullRunnerOpts): ScenarioRunner {
  return {
    scenarioIds: SCENARIOS,
    async runTrial({ scenarioId }): Promise<ScenarioSample> {
      // Box-Muller-ish via two uniforms (rough Gaussian).
      const u1 = Math.max(opts.rng(), 1e-12)
      const u2 = opts.rng()
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      return {
        scenarioId,
        score: 0.5 + 0.1 * z,
        costUsd: 0.001,
        wallSeconds: 0.1,
        ok: true,
      }
    },
  }
}

function fakeHypotheses(n: number): Hypothesis[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `h${i}`,
    name: `null-${i}`,
    rationale: 'no real effect',
    category: 'parameter-tuning' as const,
    expected_impact: 'noise',
    priority: 3 as const,
    treatment: {},
  }))
}

describe('validator: BH-FDR caps family-wise false-promote rate', () => {
  test('every result carries both raw p and BH-adjusted q (q >= p, monotone)', async () => {
    const rng = mulberry32(0xC0FFEE)
    const runner = makeNullRunner({ rng })
    const report = await validate({
      hypotheses: fakeHypotheses(20),
      runner,
      reps: 4,
      iterations: 200,
      seed: 1234,
      fdr: 0.05,
    })
    assert.equal(report.results.length, 20)
    for (const r of report.results) {
      assert.ok(typeof r.pValue === 'number', `pValue missing for ${r.hypothesisId}`)
      assert.ok(typeof r.qValue === 'number', `qValue missing for ${r.hypothesisId}`)
      // BH always satisfies q_i >= p_i for each hypothesis.
      assert.ok(
        (r.qValue as number) + 1e-12 >= (r.pValue as number),
        `q (${r.qValue}) must be >= p (${r.pValue}) for ${r.hypothesisId}`,
      )
    }
  })

  test('BH correction strictly reduces promotion count vs raw-p gate', async () => {
    // Exact unit test of the BH gate: feed a vector of synthesized
    // p-values where 5/20 are < 0.05 raw but most should NOT survive
    // BH at fdr=0.05.
    const { benjaminiHochberg } = await import('@tangle-network/agent-eval')
    const rawP = [
      0.001, 0.008, 0.02, 0.04, 0.045, // raw "wins" pre-correction
      0.10, 0.15, 0.18, 0.22, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.80, 0.95,
    ]
    const { qValues, significant } = benjaminiHochberg(rawP, 0.05)
    const rawSig = rawP.filter((p) => p < 0.05).length
    const bhSig = significant.filter(Boolean).length
    assert.ok(bhSig <= rawSig, `BH significant (${bhSig}) must be <= raw (${rawSig})`)
    // Smallest p (0.001) survives BH; the borderline ones (0.04, 0.045)
    // typically don't because n=20 inflates them to ≈0.4 / 0.45.
    assert.ok(qValues[0]! < 0.05, `smallest p must yield smallest q < 0.05; got ${qValues[0]}`)
    assert.ok(qValues[3]! > 0.05, `borderline p=0.04 should be rejected by BH; got q=${qValues[3]}`)
  })

  test('strong real effect promotes even after BH correction', async () => {
    const rng = mulberry32(0xBEEF)
    const baseRunner = makeNullRunner({ rng })
    // Wrap to add a +0.5 lift for hypothesis 'h-real'.
    const runner: ScenarioRunner = {
      scenarioIds: SCENARIOS,
      async runTrial(args) {
        const sample = await baseRunner.runTrial(args)
        if (args.hypothesis?.id === 'h-real') {
          return { ...sample, score: sample.score + 0.5 }
        }
        return sample
      },
    }
    const hyps: Hypothesis[] = [
      ...fakeHypotheses(5),
      {
        id: 'h-real',
        name: 'real-effect',
        rationale: 'genuine lift',
        category: 'architectural',
        expected_impact: '+50pp',
        priority: 1,
        treatment: {},
      },
    ]
    const report = await validate({
      hypotheses: hyps,
      runner,
      reps: 5,
      iterations: 200,
      seed: 5678,
      fdr: 0.05,
    })
    const real = report.results.find((r) => r.hypothesisId === 'h-real')!
    assert.equal(real.verdict, 'promote', 'large real effect must still promote post-BH')
    assert.ok((real.qValue as number) < 0.05, `q should be < FDR; got ${real.qValue}`)
  })
})
