/**
 * Validator — winners-only multi-rep pass with statistical gates.
 *
 * Runs `reps` (default 5) trials per scenario for each candidate
 * hypothesis, computes the per-scenario score vector + a baseline vector,
 * and applies agent-eval's `bootstrapCi` (paired-shape on per-scenario
 * means) + `cohensD` to decide promote / reject / candidate / inconclusive.
 *
 * Verdict policy (mirrors the /research skill):
 *   - `promote`     — CI lower bound > 0 (significant improvement).
 *   - `reject`      — CI upper bound < 0 (significant regression).
 *   - `candidate`   — CI straddles 0 but |delta| > 0 with |cohensD| >= 0.2.
 *                     Weak signal, more data needed.
 *   - `inconclusive`— CI straddles 0 and effect size near zero.
 *
 * Held-out scenarios: callers pass `runner` with the FULL scenario set,
 * not the screener subset. The screener floor is cheap; the validator is
 * the gate. Mixing the two collapses the held-out check.
 */

import { bootstrapCi, cohensD } from '@tangle-network/agent-eval'

import type {
  Hypothesis,
  HypothesisResult,
  ScenarioRunner,
  ScenarioSample,
  ValidatorReport,
  Verdict,
} from './types.js'

export interface ValidatorOptions {
  hypotheses: Hypothesis[]
  runner: ScenarioRunner
  reps?: number
  /** alpha for bootstrapCi. Default 0.05 → 95% CI. */
  alpha?: number
  /** Bootstrap iterations. Default 2000. */
  iterations?: number
  /** Cohen's d magnitude considered "non-trivial". Default 0.2. */
  effectFloor?: number
  /** RNG seed forwarded to bootstrapCi for reproducibility. */
  seed?: number
  runId?: string
  now?: () => Date
}

interface RepBundle {
  perScenarioMeans: Map<string, number>
  perScenarioCost: Map<string, number>
  perScenarioWall: Map<string, number>
  flatScores: number[]
}

async function runReps(
  runner: ScenarioRunner,
  hypothesis: Hypothesis | null,
  reps: number,
): Promise<RepBundle> {
  const acc = new Map<string, ScenarioSample[]>()
  for (const scenarioId of runner.scenarioIds) acc.set(scenarioId, [])
  for (let rep = 0; rep < reps; rep += 1) {
    for (const scenarioId of runner.scenarioIds) {
      const sample = await runner.runTrial({ hypothesis, scenarioId, rep })
      acc.get(scenarioId)!.push(sample)
    }
  }
  const perScenarioMeans = new Map<string, number>()
  const perScenarioCost = new Map<string, number>()
  const perScenarioWall = new Map<string, number>()
  const flatScores: number[] = []
  for (const [scenarioId, samples] of acc) {
    if (samples.length === 0) continue
    let scoreSum = 0
    let costSum = 0
    let wallSum = 0
    for (const s of samples) {
      scoreSum += s.score
      costSum += s.costUsd
      wallSum += s.wallSeconds
      flatScores.push(s.score)
    }
    perScenarioMeans.set(scenarioId, scoreSum / samples.length)
    perScenarioCost.set(scenarioId, costSum / samples.length)
    perScenarioWall.set(scenarioId, wallSum / samples.length)
  }
  return { perScenarioMeans, perScenarioCost, perScenarioWall, flatScores }
}

function classify(args: {
  ciLower: number
  ciUpper: number
  delta: number
  cohensDValue: number
  effectFloor: number
}): { verdict: Verdict; reason: string } {
  const { ciLower, ciUpper, delta, cohensDValue, effectFloor } = args
  if (ciLower > 0) {
    return {
      verdict: 'promote',
      reason: `CI95=[${ciLower.toFixed(4)}, ${ciUpper.toFixed(4)}] strictly > 0; cohensD=${cohensDValue.toFixed(3)}`,
    }
  }
  if (ciUpper < 0) {
    return {
      verdict: 'reject',
      reason: `CI95=[${ciLower.toFixed(4)}, ${ciUpper.toFixed(4)}] strictly < 0; cohensD=${cohensDValue.toFixed(3)}`,
    }
  }
  if (Math.abs(cohensDValue) >= effectFloor && Math.abs(delta) > 0) {
    return {
      verdict: 'candidate',
      reason: `CI straddles 0 but |cohensD|=${Math.abs(cohensDValue).toFixed(3)} >= ${effectFloor}; needs more reps`,
    }
  }
  return {
    verdict: 'inconclusive',
    reason: `CI95=[${ciLower.toFixed(4)}, ${ciUpper.toFixed(4)}] straddles 0; |cohensD|=${Math.abs(cohensDValue).toFixed(3)} < ${effectFloor}`,
  }
}

export async function validate(options: ValidatorOptions): Promise<ValidatorReport> {
  const { hypotheses, runner } = options
  const reps = options.reps ?? 5
  const alpha = options.alpha ?? 0.05
  const iterations = options.iterations ?? 2000
  const effectFloor = options.effectFloor ?? 0.2
  const seed = options.seed
  const now = options.now ?? (() => new Date())
  const runId = options.runId ?? `validate-${now().toISOString().replace(/[:.]/g, '-')}`

  if (reps < 2) {
    throw new Error(`validator requires reps >= 2 to compute CI; got ${reps}`)
  }

  const baseline = await runReps(runner, null, reps)
  const baselineVector: number[] = []
  for (const scenarioId of runner.scenarioIds) {
    const v = baseline.perScenarioMeans.get(scenarioId)
    if (v !== undefined) baselineVector.push(v)
  }

  const results: HypothesisResult[] = []
  const paretoFrontier: ValidatorReport['paretoFrontier'] = []

  for (const hypothesis of hypotheses) {
    const candidate = await runReps(runner, hypothesis, reps)
    const candidateVector: number[] = []
    let costSum = 0
    let wallSum = 0
    let scenarioCount = 0
    for (const scenarioId of runner.scenarioIds) {
      const v = candidate.perScenarioMeans.get(scenarioId)
      if (v !== undefined) candidateVector.push(v)
      const c = candidate.perScenarioCost.get(scenarioId)
      const w = candidate.perScenarioWall.get(scenarioId)
      if (c !== undefined) {
        costSum += c
        scenarioCount += 1
      }
      if (w !== undefined) {
        wallSum += w
      }
    }
    const meanCandidate = mean(candidateVector)
    const meanBaseline = mean(baselineVector)
    const delta = meanCandidate - meanBaseline
    const ci = bootstrapCi(baselineVector, candidateVector, {
      alpha,
      iterations,
      seed,
    })
    const d = cohensD(baselineVector, candidateVector)
    const { verdict, reason } = classify({
      ciLower: ci.ciLower,
      ciUpper: ci.ciUpper,
      delta,
      cohensDValue: d,
      effectFloor,
    })
    const meanCostUsd = scenarioCount > 0 ? costSum / scenarioCount : 0
    const meanWallSeconds = scenarioCount > 0 ? wallSum / scenarioCount : 0
    results.push({
      hypothesisId: hypothesis.id,
      reps,
      meanScore: meanCandidate,
      meanBaseline,
      delta,
      ci95: { lower: ci.ciLower, upper: ci.ciUpper },
      cohensD: d,
      meanCostUsd,
      meanWallSeconds,
      verdict,
      reason,
    })
    if (verdict === 'promote' || verdict === 'candidate') {
      paretoFrontier.push({
        hypothesisId: hypothesis.id,
        quality: meanCandidate,
        costUsd: meanCostUsd,
        wallSeconds: meanWallSeconds,
      })
    }
  }

  return {
    runId,
    generatedAt: now().toISOString(),
    results,
    paretoFrontier,
  }
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  let s = 0
  for (const x of xs) s += x
  return s / xs.length
}
