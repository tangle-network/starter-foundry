/**
 * research-harness shared types.
 *
 * `Hypothesis` is the schema callers add to `hypotheses/queue.json`. The
 * shape mirrors the /research skill — keep it in sync with
 * ~/.claude/skills/research/SKILL.md if either changes.
 */

export type HypothesisCategory =
  | 'bug-fix'
  | 'architectural'
  | 'efficiency'
  | 'parameter-tuning'

export interface Hypothesis {
  /** kebab-case stable id; surfaces in result filenames + reports. */
  id: string
  /** Short human label. */
  name: string
  /** Why this should work + what evidence supports it. */
  rationale: string
  category: HypothesisCategory
  /** e.g. "pass rate: +5-10pp", "cost: -20%". */
  expected_impact: string
  /** What could regress; required so the validator gate has something to check. */
  risk?: string
  /** 1 = ship-blocker, 2 = important, 3 = nice-to-have. */
  priority: 1 | 2 | 3
  /**
   * Free-form treatment payload. The runner is treatment-agnostic — consumers
   * decide whether this is a config delta, a steering bundle id, a code patch,
   * or anything else. The harness passes it to `applyTreatment` verbatim.
   */
  treatment: Record<string, unknown>
}

export interface HypothesisQueue {
  hypotheses: Hypothesis[]
}

/**
 * Per-scenario score sample collected by the runner. Mirrors the salient
 * fields of agent-eval's `RunScore` so the harness stays decoupled from
 * the upstream type while keeping the bootstrap-CI math honest.
 */
export interface ScenarioSample {
  scenarioId: string
  score: number
  costUsd: number
  wallSeconds: number
  ok: boolean
}

export interface HypothesisRun {
  hypothesisId: string
  rep: number
  samples: ScenarioSample[]
  startedAt: string
  finishedAt: string
}

export type Verdict = 'promote' | 'reject' | 'candidate' | 'inconclusive'

export interface HypothesisResult {
  hypothesisId: string
  reps: number
  meanScore: number
  meanBaseline: number
  delta: number
  ci95: { lower: number; upper: number }
  cohensD: number
  meanCostUsd: number
  meanWallSeconds: number
  verdict: Verdict
  /** Reason string surfaced in the scorecard. */
  reason: string
}

export interface ScreenerReport {
  runId: string
  generatedAt: string
  ranked: HypothesisResult[]
  passedFloor: string[]
}

export interface ValidatorReport {
  runId: string
  generatedAt: string
  results: HypothesisResult[]
  paretoFrontier: Array<{
    hypothesisId: string
    quality: number
    costUsd: number
    wallSeconds: number
  }>
}

export interface ScenarioRunner {
  scenarioIds: readonly string[]
  /**
   * Apply the treatment + run a single (hypothesis × scenario × rep) trial.
   * Implementations should return a `ScenarioSample`. The runner does not
   * persist; persistence is the harness's job.
   */
  runTrial(args: {
    hypothesis: Hypothesis | null
    scenarioId: string
    rep: number
  }): Promise<ScenarioSample>
}
