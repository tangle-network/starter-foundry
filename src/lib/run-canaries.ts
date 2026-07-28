/**
 * Liveness canaries for `.evolve/runs.jsonl`.
 *
 * Starter Foundry-specific liveness checks over agent-eval RunRecords.
 *
 * Silent-fallback detection is re-keyed onto stage-flag streaks:
 * consecutive runs whose
 *     `outcome.raw[stage]` flips false (e.g. a proposer that suddenly
 *     stops producing typechecking output) is the foundry-specific
 *     equivalent of a silent judge fallback.
 *   - Distribution shift is keyed on `failureClass`.
 *   - Calibration drift is keyed on `outcome.searchScore` (or any other
 *     numeric raw key the caller picks) and falls back to no-op when
 *     numeric scores are absent.
 *
 * Three canary types:
 *   1. `silent_stage_failure` — a string of consecutive runs where one
 *      audit stage flag (install/typecheck/build/lint) is false.
 *      Signature of a regression that landed silently between commits.
 *   2. `score_calibration_drift` — recent vs historical `searchScore`
 *      distributions diverge (two-sample KS).
 *   3. `failure_mode_distribution_shift` — chi-square on the
 *      `failureClass` bucket counts.
 *
 * Outputs are alerts, not test failures. A canary firing means
 * investigate, not abort. The CLI script (`scripts/canary-check.ts`)
 * exits 2 on any alert so a scheduler can detect.
 *
 * The filename intentionally avoids `canary.ts` because that name is
 * already taken by `src/lib/canary.ts` (canary-release routing).
 *
 * @public
 */

import type { RunRecord } from '@tangle-network/agent-eval'

export type CanaryKind =
  | 'silent_stage_failure'
  | 'score_calibration_drift'
  | 'failure_mode_distribution_shift'

export type CanarySeverity = 'info' | 'warn' | 'error'

export interface CanaryAlert {
  kind: CanaryKind
  severity: CanarySeverity
  message: string
  /** Numbers that informed the decision — drop straight into a dashboard. */
  evidence: Record<string, unknown>
}

export interface CanaryReport {
  alerts: CanaryAlert[]
  /** Per-kind summary count. */
  counts: Record<CanaryKind, number>
}

export interface CanaryOptions {
  /**
   * Silent stage-failure detection.
   * - `stage`: which `outcome.raw[stage]` boolean to track.
   *   Default `'typecheck'` — the most sensitive of the four
   *   audit stages because it catches type-system breakage that
   *   `install` would otherwise mask.
   * - `consecutiveThreshold`: number of consecutive failures
   *   required to fire. Default 3.
   */
  silentStageFailure?: {
    stage?: string
    consecutiveThreshold?: number
  }

  /**
   * Score-calibration drift (two-sample KS on a numeric raw key).
   * - `key`: which value to track. `'searchScore'` reads
   *   `outcome.searchScore`; any other string reads `outcome.raw[key]`.
   *   Default `'searchScore'`.
   */
  scoreDrift?: {
    key?: string
    historyWindow?: number
    recentWindow?: number
    ksAlpha?: number
    minRecent?: number
  }

  /**
   * Failure-mode distribution shift (chi-square).
   * Skipped entirely if `category` is omitted AND the default extractor
   * yields too-few buckets. The default extractor uses `failureClass`
   * (or `'pass'` when the run succeeded).
   */
  failureModeShift?: {
    category?: (run: RunRecord) => string | null
    chiSquareAlpha?: number
    historyWindow?: number
    recentWindow?: number
    minRecent?: number
  }
}

/**
 * Run all configured canaries against a chronological run list.
 * Runs MUST be sorted oldest-to-newest by the caller — the order of
 * the input is used to define "recent" vs "historical" windows.
 */
export function runCanaries(runs: RunRecord[], opts: CanaryOptions = {}): CanaryReport {
  const alerts: CanaryAlert[] = [
    ...detectSilentStageFailure(runs, opts.silentStageFailure ?? {}),
    ...detectScoreDrift(runs, opts.scoreDrift ?? {}),
    ...detectFailureModeShift(runs, opts.failureModeShift ?? {}),
  ]
  const counts: Record<CanaryKind, number> = {
    silent_stage_failure: 0,
    score_calibration_drift: 0,
    failure_mode_distribution_shift: 0,
  }
  for (const a of alerts) counts[a.kind] += 1
  return { alerts, counts }
}

// ── 1. Silent stage failure ─────────────────────────────────────────

function detectSilentStageFailure(
  runs: RunRecord[],
  opts: NonNullable<CanaryOptions['silentStageFailure']>,
): CanaryAlert[] {
  const stage = opts.stage ?? 'typecheck'
  const threshold = opts.consecutiveThreshold ?? 3

  const alerts: CanaryAlert[] = []
  let streak = 0
  let streakStartRunId: string | null = null
  let alreadyFiredForStreak = false

  for (const run of runs) {
    const raw = run.outcome.raw
    if (!(stage in raw)) {
      streak = 0
      streakStartRunId = null
      alreadyFiredForStreak = false
      continue
    }
    const value = raw[stage]
    const failed = value === 0
    if (failed) {
      streak += 1
      if (streak === 1) streakStartRunId = run.runId
      if (streak >= threshold && !alreadyFiredForStreak) {
        alerts.push({
          kind: 'silent_stage_failure',
          severity: 'error',
          message:
            `silent stage failure: ${streak} consecutive run(s) with ` +
            `outcome.raw.${stage} === 0`,
          evidence: {
            stage,
            streakLength: streak,
            firstRunId: streakStartRunId,
            lastRunId: run.runId,
            threshold,
          },
        })
        // Coalesce: a continuing streak fires once, on the run that
        // crossed the threshold. Reset on the next non-failing run.
        alreadyFiredForStreak = true
      }
    } else {
      streak = 0
      streakStartRunId = null
      alreadyFiredForStreak = false
    }
  }

  return alerts
}

// ── 2. Score-calibration drift (two-sample KS) ───────────────────────

function detectScoreDrift(
  runs: RunRecord[],
  opts: NonNullable<CanaryOptions['scoreDrift']>,
): CanaryAlert[] {
  const key = opts.key ?? 'searchScore'
  const historyWindow = opts.historyWindow ?? 50
  const recentWindow = opts.recentWindow ?? 20
  const alpha = opts.ksAlpha ?? 0.05
  const minRecent = opts.minRecent ?? 10

  const series: number[] = []
  for (const r of runs) {
    let v: unknown
    if (key === 'searchScore') {
      v = r.outcome.searchScore
    } else {
      v = r.outcome.raw[key]
    }
    if (typeof v === 'number' && Number.isFinite(v)) series.push(v)
  }
  if (series.length < minRecent + 1) return []

  const recent = series.slice(-Math.min(recentWindow, series.length))
  const historical = series.slice(0, -recent.length).slice(-historyWindow)
  if (recent.length < minRecent || historical.length < minRecent) return []

  const ks = ksTwoSample(recent, historical)
  // c(α) * sqrt((n1+n2)/(n1*n2)); c(0.05) ≈ 1.36, c(0.01) ≈ 1.63.
  const c = alpha <= 0.01 ? 1.63 : alpha <= 0.05 ? 1.36 : alpha <= 0.1 ? 1.22 : 1.0
  const critical =
    c * Math.sqrt((recent.length + historical.length) / (recent.length * historical.length))

  if (ks.d > critical) {
    return [
      {
        kind: 'score_calibration_drift',
        severity: 'warn',
        message:
          `score calibration drift on "${key}": KS D=${ks.d.toFixed(4)} ` +
          `exceeds critical=${critical.toFixed(4)} at alpha=${alpha} ` +
          `(recent n=${recent.length}, history n=${historical.length})`,
        evidence: {
          key,
          ksD: ks.d,
          critical,
          alpha,
          recentN: recent.length,
          historyN: historical.length,
          recentMean: mean(recent),
          historyMean: mean(historical),
        },
      },
    ]
  }
  return []
}

function ksTwoSample(a: number[], b: number[]): { d: number } {
  const sortedA = [...a].sort((x, y) => x - y)
  const sortedB = [...b].sort((x, y) => x - y)
  const n1 = sortedA.length
  const n2 = sortedB.length
  let i = 0
  let j = 0
  let d = 0
  while (i < n1 && j < n2) {
    const ax = sortedA[i]
    const bx = sortedB[j]
    if (ax <= bx) i += 1
    if (bx <= ax) j += 1
    const diff = Math.abs(i / n1 - j / n2)
    if (diff > d) d = diff
  }
  return { d }
}

// ── 3. Failure-mode distribution shift (chi-square) ──────────────────

function detectFailureModeShift(
  runs: RunRecord[],
  opts: NonNullable<CanaryOptions['failureModeShift']>,
): CanaryAlert[] {
  const historyWindow = opts.historyWindow ?? 50
  const recentWindow = opts.recentWindow ?? 20
  const alpha = opts.chiSquareAlpha ?? 0.05
  const minRecent = opts.minRecent ?? 10
  const cat = opts.category ?? defaultFailureModeCategory

  const cats: { run: RunRecord; bucket: string }[] = []
  for (const r of runs) {
    const b = cat(r)
    if (typeof b === 'string' && b.length > 0) cats.push({ run: r, bucket: b })
  }
  if (cats.length < minRecent + 1) return []

  const recent = cats.slice(-Math.min(recentWindow, cats.length))
  const historical = cats.slice(0, -recent.length).slice(-historyWindow)
  if (recent.length < minRecent || historical.length < minRecent) return []

  const buckets = new Set<string>()
  for (const r of recent) buckets.add(r.bucket)
  for (const h of historical) buckets.add(h.bucket)
  const bucketList = [...buckets].sort()

  const recentCounts: Record<string, number> = {}
  const histCounts: Record<string, number> = {}
  for (const b of bucketList) {
    recentCounts[b] = 0
    histCounts[b] = 0
  }
  for (const r of recent) recentCounts[r.bucket] += 1
  for (const h of historical) histCounts[h.bucket] += 1

  let chi = 0
  let df = 0
  for (const b of bucketList) {
    const expected = (histCounts[b] / historical.length) * recent.length
    if (expected < 1) continue
    const obs = recentCounts[b]
    chi += (obs - expected) ** 2 / expected
    df += 1
  }
  df = Math.max(1, df - 1)
  const critical = chiSquareCritical(df, alpha)

  if (chi > critical) {
    return [
      {
        kind: 'failure_mode_distribution_shift',
        severity: 'warn',
        message:
          `failure-mode distribution shift: χ²=${chi.toFixed(2)} df=${df} ` +
          `exceeds critical=${critical.toFixed(2)} at alpha=${alpha}`,
        evidence: {
          chi,
          df,
          critical,
          alpha,
          recentCounts,
          historicalCounts: histCounts,
          recentN: recent.length,
          historyN: historical.length,
        },
      },
    ]
  }
  return []
}

function defaultFailureModeCategory(run: RunRecord): string | null {
  if (typeof run.failureClass === 'string' && run.failureClass.length > 0) {
    return run.failureClass
  }
  return 'pass'
}

function chiSquareCritical(df: number, alpha: number): number {
  // Critical values at α = 0.1, 0.05, 0.025, 0.01.
  const fallback = [15.99, 18.31, 20.48, 23.21] as const
  const TABLE: Partial<Record<number, readonly [number, number, number, number]>> = {
    1: [2.71, 3.84, 5.02, 6.63],
    2: [4.61, 5.99, 7.38, 9.21],
    3: [6.25, 7.81, 9.35, 11.34],
    4: [7.78, 9.49, 11.14, 13.28],
    5: [9.24, 11.07, 12.83, 15.09],
    6: [10.64, 12.59, 14.45, 16.81],
    7: [12.02, 14.07, 16.01, 18.48],
    8: [13.36, 15.51, 17.53, 20.09],
    9: [14.68, 16.92, 19.02, 21.67],
    10: fallback,
    15: [22.31, 25.0, 27.49, 30.58],
    20: [28.41, 31.41, 34.17, 37.57],
    25: [34.38, 37.65, 40.65, 44.31],
    30: [40.26, 43.77, 46.98, 50.89],
  }
  const idx = alpha >= 0.1 ? 0 : alpha >= 0.05 ? 1 : alpha >= 0.025 ? 2 : 3
  const exact = TABLE[df]
  if (exact) return exact[idx]
  if (df > 30) {
    // Wilson-Hilferty normal approximation.
    const z = [1.282, 1.645, 1.96, 2.326][idx] ?? 1.96
    const term = 1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df))
    return df * term ** 3
  }
  const keys = Object.keys(TABLE)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
  for (let i = 1; i < keys.length; i += 1) {
    const lo = keys[i - 1]
    const hi = keys[i]
    if (df >= lo && df <= hi) {
      const loValues = TABLE[lo]
      const hiValues = TABLE[hi]
      if (!loValues || !hiValues) continue
      const t = (df - lo) / (hi - lo)
      return loValues[idx] * (1 - t) + hiValues[idx] * t
    }
  }
  return fallback[idx]
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((s, x) => s + x, 0) / xs.length
}
