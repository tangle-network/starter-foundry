/**
 * Screener — cheap 1-rep pass over every queued hypothesis.
 *
 * Goal: rank hypotheses by point-estimate score delta vs the baseline so
 * the validator only spends real budget on plausible winners. Statistical
 * sign-off lives in the validator (bootstrapCi, cohensD); the screener
 * exists to cull obvious losers before paying for 5-rep runs.
 *
 * Floor logic: a hypothesis "passes the floor" if its mean score across
 * the screener scenario set is no worse than `baselineMean - tolerance`.
 * Anything below that is rejected outright. Default tolerance = 0.02.
 */

import type {
  Hypothesis,
  HypothesisResult,
  ScenarioRunner,
  ScenarioSample,
  ScreenerReport,
} from './types.js'

export interface ScreenerOptions {
  hypotheses: Hypothesis[]
  runner: ScenarioRunner
  /** Score floor relative to baseline mean. Default 0.02. */
  floorTolerance?: number
  runId?: string
  now?: () => Date
}

function meanOf(samples: ScenarioSample[], pick: (s: ScenarioSample) => number): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (const s of samples) sum += pick(s)
  return sum / samples.length
}

async function runOne(
  runner: ScenarioRunner,
  hypothesis: Hypothesis | null,
): Promise<ScenarioSample[]> {
  const samples: ScenarioSample[] = []
  for (const scenarioId of runner.scenarioIds) {
    const sample = await runner.runTrial({ hypothesis, scenarioId, rep: 0 })
    samples.push(sample)
  }
  return samples
}

export async function screen(options: ScreenerOptions): Promise<ScreenerReport> {
  const { hypotheses, runner } = options
  const floorTolerance = options.floorTolerance ?? 0.02
  const now = options.now ?? (() => new Date())
  const runId = options.runId ?? `screen-${now().toISOString().replace(/[:.]/g, '-')}`

  if (runner.scenarioIds.length < 3) {
    throw new Error(
      `screener requires >= 3 scenarios to rank meaningfully; got ${runner.scenarioIds.length}`,
    )
  }

  const baseline = await runOne(runner, null)
  const baselineMean = meanOf(baseline, (s) => s.score)

  const ranked: HypothesisResult[] = []
  for (const hypothesis of hypotheses) {
    const samples = await runOne(runner, hypothesis)
    const meanScore = meanOf(samples, (s) => s.score)
    const meanCostUsd = meanOf(samples, (s) => s.costUsd)
    const meanWallSeconds = meanOf(samples, (s) => s.wallSeconds)
    const delta = meanScore - baselineMean
    const passesFloor = meanScore >= baselineMean - floorTolerance
    ranked.push({
      hypothesisId: hypothesis.id,
      reps: 1,
      meanScore,
      meanBaseline: baselineMean,
      delta,
      // 1-rep — no CI, surface point estimate.
      ci95: { lower: delta, upper: delta },
      cohensD: 0,
      meanCostUsd,
      meanWallSeconds,
      verdict: passesFloor ? 'candidate' : 'reject',
      reason: passesFloor
        ? `screener delta ${delta.toFixed(4)} cleared floor (baseline ${baselineMean.toFixed(4)} - tolerance ${floorTolerance})`
        : `screener mean ${meanScore.toFixed(4)} below baseline ${baselineMean.toFixed(4)} - tolerance ${floorTolerance}`,
    })
  }

  ranked.sort((a, b) => b.delta - a.delta)
  const passedFloor = ranked.filter((r) => r.verdict === 'candidate').map((r) => r.hypothesisId)

  return {
    runId,
    generatedAt: now().toISOString(),
    ranked,
    passedFloor,
  }
}
