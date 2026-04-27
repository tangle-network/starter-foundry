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

export type Verdict =
  | 'promote'
  | 'reject'
  | 'candidate'
  | 'inconclusive'
  /**
   * Screener (1-rep) outputs only a point estimate; CI / Cohen's d are
   * statistically undefined at n=1. The validator MUST refuse to consume
   * `estimate-only` results without re-running at the validator's rep
   * count. Adding this verdict was the fix for a muffled-gate where the
   * screener wrote `ci95={delta,delta}` and `cohensD: 0` as if they were
   * real estimates.
   */
  | 'estimate-only'

export interface HypothesisResult {
  hypothesisId: string
  /** Number of reps the result is computed from. 1 ⇒ no CI / Cohen's d. */
  reps: number
  meanScore: number
  meanBaseline: number
  delta: number
  /**
   * 95% CI on the delta. `null` when reps < 2 — DO NOT fabricate
   * `{lower:delta, upper:delta}` to satisfy a non-null contract; the
   * validator interprets null as "no statistical estimate available".
   */
  ci95: { lower: number; upper: number } | null
  /** Cohen's d. `null` when reps < 2. */
  cohensD: number | null
  meanCostUsd: number
  meanWallSeconds: number
  /**
   * Raw two-sided Welch p-value from the validator. `null` for screener
   * (1-rep) results. Kept alongside `qValue` so consumers see both the
   * uncorrected and FDR-corrected significance.
   */
  pValue?: number | null
  /**
   * Benjamini–Hochberg FDR-adjusted q-value across the hypothesis family
   * in this run. Verdicts in the validator key off `qValue`, not `pValue`,
   * so false-promote rate is bounded at the configured FDR even when
   * many hypotheses are evaluated jointly.
   */
  qValue?: number | null
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
