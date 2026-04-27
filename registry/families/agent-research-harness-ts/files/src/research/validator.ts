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

import { benjaminiHochberg, bootstrapCi, cohensD } from '@tangle-network/agent-eval'

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
  /**
   * False discovery rate threshold for Benjamini–Hochberg correction.
   * Verdict 'promote' / 'reject' require q < fdr. Default 0.05.
   */
  fdr?: number
  /** RNG seed forwarded to bootstrapCi for reproducibility. */
  seed?: number
  runId?: string
  now?: () => Date
}

/**
 * Two-sided Welch t-test p-value, computed without scipy. Returns the
 * approximate p-value via the survival of the standard normal at |t|;
 * conservative tail approximation but adequate for BH-FDR ranking. Mirrors
 * the contract of the Python sibling's `welch_t_test` (we only need p, not
 * the full t statistic).
 */
function welchPValue(a: number[], b: number[]): number {
  if (a.length < 2 || b.length < 2) return 1
  const meanA = a.reduce((s, x) => s + x, 0) / a.length
  const meanB = b.reduce((s, x) => s + x, 0) / b.length
  const varA = a.reduce((s, x) => s + (x - meanA) ** 2, 0) / (a.length - 1)
  const varB = b.reduce((s, x) => s + (x - meanB) ** 2, 0) / (b.length - 1)
  const se = Math.sqrt(varA / a.length + varB / b.length)
  if (se === 0) return meanA === meanB ? 1 : 0
  const t = (meanB - meanA) / se
  // 2 * (1 - Φ(|t|)) using erf approximation. Abramowitz & Stegun 7.1.26.
  const z = Math.abs(t) / Math.SQRT2
  const erf = approxErf(z)
  return Math.max(0, Math.min(1, 1 - erf))
}

function approxErf(x: number): number {
  // Abramowitz & Stegun 7.1.26 — accurate to ~1.5e-7.
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const t = 1 / (1 + p * ax)
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax)
  return sign * y
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
  qValue: number
  fdr: number
}): { verdict: Verdict; reason: string } {
  const { ciLower, ciUpper, delta, cohensDValue, effectFloor, qValue, fdr } = args
  // Promote requires BOTH a CI strictly above 0 AND BH-adjusted q below
  // the configured FDR. CI alone inflates false-promote rate when N
  // hypotheses are tested jointly.
  if (ciLower > 0 && qValue < fdr) {
    return {
      verdict: 'promote',
      reason: `CI95=[${ciLower.toFixed(4)}, ${ciUpper.toFixed(4)}] strictly > 0; q=${qValue.toFixed(4)} < ${fdr}; cohensD=${cohensDValue.toFixed(3)}`,
    }
  }
  if (ciUpper < 0 && qValue < fdr) {
    return {
      verdict: 'reject',
      reason: `CI95=[${ciLower.toFixed(4)}, ${ciUpper.toFixed(4)}] strictly < 0; q=${qValue.toFixed(4)} < ${fdr}; cohensD=${cohensDValue.toFixed(3)}`,
    }
  }
  if (Math.abs(cohensDValue) >= effectFloor && Math.abs(delta) > 0) {
    return {
      verdict: 'candidate',
      reason: `signal present (|cohensD|=${Math.abs(cohensDValue).toFixed(3)} >= ${effectFloor}) but FDR-adjusted q=${qValue.toFixed(4)} ≥ ${fdr} or CI straddles 0; needs more reps`,
    }
  }
  return {
    verdict: 'inconclusive',
    reason: `CI95=[${ciLower.toFixed(4)}, ${ciUpper.toFixed(4)}], q=${qValue.toFixed(4)}, |cohensD|=${Math.abs(cohensDValue).toFixed(3)} — no signal`,
  }
}

export async function validate(options: ValidatorOptions): Promise<ValidatorReport> {
  const { hypotheses, runner } = options
  const reps = options.reps ?? 5
  const alpha = options.alpha ?? 0.05
  const iterations = options.iterations ?? 2000
  const effectFloor = options.effectFloor ?? 0.2
  const fdr = options.fdr ?? 0.05
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

  // First pass: run reps for every hypothesis, compute raw stats + p-values.
  interface Pending {
    hypothesisId: string
    candidateVector: number[]
    meanCandidate: number
    meanBaseline: number
    delta: number
    ciLower: number
    ciUpper: number
    cohensDValue: number
    pValue: number
    meanCostUsd: number
    meanWallSeconds: number
  }
  const pending: Pending[] = []
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
    const p = welchPValue(baselineVector, candidateVector)
    pending.push({
      hypothesisId: hypothesis.id,
      candidateVector,
      meanCandidate,
      meanBaseline,
      delta,
      ciLower: ci.ciLower,
      ciUpper: ci.ciUpper,
      cohensDValue: d,
      pValue: p,
      meanCostUsd: scenarioCount > 0 ? costSum / scenarioCount : 0, // muffle-ok: zero-scenario means zero cost by definition; verdict 'insufficient-data' is enforced upstream when reps<2 so an empty cost is never read as "fast & free"
      meanWallSeconds: scenarioCount > 0 ? wallSum / scenarioCount : 0, // muffle-ok: zero-scenario means zero wall-time by definition; same upstream gate
    })
  }

  // Second pass: BH-adjust p-values across the hypothesis family, classify
  // with q-values. Without this, raw-p verdicts inflate false positives
  // linearly with the number of hypotheses tested in a single run.
  const pValues = pending.map((p) => p.pValue)
  const { qValues } = pValues.length > 0
    ? benjaminiHochberg(pValues, fdr)
    : { qValues: [] as number[] }

  const results: HypothesisResult[] = []
  const paretoFrontier: ValidatorReport['paretoFrontier'] = []
  for (let i = 0; i < pending.length; i += 1) {
    const r = pending[i]!
    const q = qValues[i] ?? 1
    const { verdict, reason } = classify({
      ciLower: r.ciLower,
      ciUpper: r.ciUpper,
      delta: r.delta,
      cohensDValue: r.cohensDValue,
      effectFloor,
      qValue: q,
      fdr,
    })
    results.push({
      hypothesisId: r.hypothesisId,
      reps,
      meanScore: r.meanCandidate,
      meanBaseline: r.meanBaseline,
      delta: r.delta,
      ci95: { lower: r.ciLower, upper: r.ciUpper },
      cohensD: r.cohensDValue,
      meanCostUsd: r.meanCostUsd,
      meanWallSeconds: r.meanWallSeconds,
      pValue: r.pValue,
      qValue: q,
      verdict,
      reason,
    })
    if (verdict === 'promote' || verdict === 'candidate') {
      paretoFrontier.push({
        hypothesisId: r.hypothesisId,
        quality: r.meanCandidate,
        costUsd: r.meanCostUsd,
        wallSeconds: r.meanWallSeconds,
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
