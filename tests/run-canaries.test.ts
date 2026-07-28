/**
 * Canary detector tests — fixture data exercises every alert path:
 *   1. silent stage failure (consecutive typecheck=false)
 *   2. score-calibration drift (KS over searchScore)
 *   3. failure-mode distribution shift (chi-square over failureClass)
 *
 * Each named regression: the test asserts both the firing case and the
 * just-below-threshold case so a calibration-bump on either side breaks
 * exactly one test.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import type { RunRecord } from '@tangle-network/agent-eval'

import { runCanaries } from '../dist/lib/run-canaries.js'

const BASE: Omit<RunRecord, 'runId' | 'outcome'> = {
  experimentId: 'canary-fixture',
  candidateId: 'fixture-candidate',
  seed: 0,
  model: 'claude-sonnet-4-6@claude-sonnet-4-5-20250929',
  promptHash: 'a'.repeat(64),
  configHash: 'b'.repeat(64),
  commitSha: 'fixture',
  wallMs: 100,
  costUsd: 0.001,
  costProvenance: { kind: 'observed', usd: 0.001 },
  tokenUsage: { input: 10, output: 10 },
  terminalOutcome: 'succeeded',
  splitTag: 'search',
  scenarioId: 'canary-scenario',
}

function mkRun(
  i: number,
  outcome: RunRecord['outcome'],
  failureClass?: RunRecord['failureClass'],
): RunRecord {
  return {
    ...BASE,
    runId: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
    scenarioId: `canary-scenario-${i}`,
    outcome,
    terminalOutcome: failureClass ? 'failed' : 'succeeded',
    ...(failureClass ? { failureClass } : {}),
  }
}

test('silent_stage_failure fires after threshold consecutive typecheck=false', () => {
  // 3 passes, then 4 typecheck failures. Default threshold is 3.
  const runs: RunRecord[] = [
    mkRun(1, { searchScore: 1, raw: { typecheck: 1 } }),
    mkRun(2, { searchScore: 1, raw: { typecheck: 1 } }),
    mkRun(3, { searchScore: 1, raw: { typecheck: 1 } }),
    mkRun(4, { searchScore: 0, raw: { typecheck: 0 } }),
    mkRun(5, { searchScore: 0, raw: { typecheck: 0 } }),
    mkRun(6, { searchScore: 0, raw: { typecheck: 0 } }),
    mkRun(7, { searchScore: 0, raw: { typecheck: 0 } }),
  ]
  const report = runCanaries(runs)
  const fires = report.alerts.filter((a) => a.kind === 'silent_stage_failure')
  assert.equal(fires.length, 1, 'should fire exactly once (coalesced)')
  assert.equal(fires[0]!.severity, 'error')
  assert.equal(fires[0]!.evidence.streakLength, 3, 'fires at threshold, not at end of streak')
  assert.equal(fires[0]!.evidence.stage, 'typecheck')
})

test('silent_stage_failure does NOT fire when streak < threshold', () => {
  // Only 2 consecutive failures — below default threshold of 3.
  const runs: RunRecord[] = [
    mkRun(1, { searchScore: 1, raw: { typecheck: 1 } }),
    mkRun(2, { searchScore: 0, raw: { typecheck: 0 } }),
    mkRun(3, { searchScore: 0, raw: { typecheck: 0 } }),
    mkRun(4, { searchScore: 1, raw: { typecheck: 1 } }),
  ]
  const report = runCanaries(runs)
  const fires = report.alerts.filter((a) => a.kind === 'silent_stage_failure')
  assert.equal(fires.length, 0)
})

test('silent_stage_failure resets on a passing run', () => {
  // Streak of 2, pass, streak of 2 → no fire (threshold = 3).
  const runs: RunRecord[] = [
    mkRun(1, { searchScore: 0, raw: { typecheck: 0 } }),
    mkRun(2, { searchScore: 0, raw: { typecheck: 0 } }),
    mkRun(3, { searchScore: 1, raw: { typecheck: 1 } }),
    mkRun(4, { searchScore: 0, raw: { typecheck: 0 } }),
    mkRun(5, { searchScore: 0, raw: { typecheck: 0 } }),
  ]
  const report = runCanaries(runs)
  const fires = report.alerts.filter((a) => a.kind === 'silent_stage_failure')
  assert.equal(fires.length, 0)
})

test('silent_stage_failure honors a custom stage selector', () => {
  const runs: RunRecord[] = [
    mkRun(1, { searchScore: 1, raw: { build: 0 } }),
    mkRun(2, { searchScore: 1, raw: { build: 0 } }),
    mkRun(3, { searchScore: 1, raw: { build: 0 } }),
  ]
  const report = runCanaries(runs, {
    silentStageFailure: { stage: 'build', consecutiveThreshold: 3 },
  })
  const fires = report.alerts.filter((a) => a.kind === 'silent_stage_failure')
  assert.equal(fires.length, 1)
  assert.equal(fires[0]!.evidence.stage, 'build')
})

test('score_calibration_drift fires when recent distribution shifts hard', () => {
  // 50 historical near 0.85, 20 recent near 0.30. KS D should be ≈ 1.0.
  const runs: RunRecord[] = []
  for (let i = 0; i < 50; i += 1) {
    runs.push(mkRun(100 + i, { searchScore: 0.85 + (i % 5) * 0.001, raw: {} }))
  }
  for (let i = 0; i < 20; i += 1) {
    runs.push(mkRun(200 + i, { searchScore: 0.3 + (i % 5) * 0.001, raw: {} }))
  }
  const report = runCanaries(runs, {
    scoreDrift: { key: 'searchScore', historyWindow: 50, recentWindow: 20, minRecent: 10 },
    silentStageFailure: { consecutiveThreshold: 9999 }, // disable
  })
  const fires = report.alerts.filter((a) => a.kind === 'score_calibration_drift')
  assert.equal(fires.length, 1)
  const ev = fires[0]!.evidence as Record<string, number>
  assert.ok(ev.ksD > ev.critical, `KS D=${ev.ksD} should exceed critical=${ev.critical}`)
  assert.ok(Math.abs(ev.recentMean - 0.3) < 0.01)
  assert.ok(Math.abs(ev.historyMean - 0.85) < 0.01)
})

test('score_calibration_drift does NOT fire when distributions match', () => {
  const runs: RunRecord[] = []
  for (let i = 0; i < 70; i += 1) {
    // Identical distribution — KS D should be ~0.
    runs.push(mkRun(i, { searchScore: 0.7 + (i % 7) * 0.01, raw: {} }))
  }
  const report = runCanaries(runs, {
    scoreDrift: { key: 'searchScore', historyWindow: 50, recentWindow: 20, minRecent: 10 },
    silentStageFailure: { consecutiveThreshold: 9999 },
  })
  const fires = report.alerts.filter((a) => a.kind === 'score_calibration_drift')
  assert.equal(fires.length, 0)
})

test('score_calibration_drift skips when too few runs', () => {
  const runs: RunRecord[] = []
  for (let i = 0; i < 5; i += 1) {
    runs.push(mkRun(i, { searchScore: 0.5, raw: {} }))
  }
  const report = runCanaries(runs, {
    scoreDrift: { minRecent: 10 },
  })
  assert.equal(report.alerts.filter((a) => a.kind === 'score_calibration_drift').length, 0)
})

test('failure_mode_distribution_shift fires when recent failure mix shifts', () => {
  const runs: RunRecord[] = []
  // 50 historical: balanced typecheck/build/lint failures.
  const histModes: NonNullable<RunRecord['failureClass']>[] = [
    'reasoning_error',
    'format_drift',
    'timeout',
  ]
  for (let i = 0; i < 50; i += 1) {
    runs.push(mkRun(i, { searchScore: 0, raw: {} }, histModes[i % 3]!))
  }
  // 20 recent: dominated by 'install' (a new failure mode entirely).
  for (let i = 0; i < 20; i += 1) {
    runs.push(mkRun(100 + i, { searchScore: 0, raw: {} }, 'sandbox_failure'))
  }
  const report = runCanaries(runs, {
    failureModeShift: { historyWindow: 50, recentWindow: 20, minRecent: 10, chiSquareAlpha: 0.05 },
    silentStageFailure: { consecutiveThreshold: 9999 },
  })
  const fires = report.alerts.filter((a) => a.kind === 'failure_mode_distribution_shift')
  assert.equal(fires.length, 1)
  const ev = fires[0]!.evidence as Record<string, unknown>
  assert.ok((ev.chi as number) > (ev.critical as number))
})

test('failure_mode_distribution_shift skips when too few runs', () => {
  const runs: RunRecord[] = []
  for (let i = 0; i < 5; i += 1) {
    runs.push(mkRun(i, { searchScore: 0, raw: {} }, 'reasoning_error'))
  }
  const report = runCanaries(runs, {
    failureModeShift: { minRecent: 10 },
  })
  assert.equal(report.alerts.filter((a) => a.kind === 'failure_mode_distribution_shift').length, 0)
})

test('runCanaries returns per-kind counts', () => {
  const runs: RunRecord[] = [
    mkRun(1, { searchScore: 0, raw: { typecheck: 0 } }),
    mkRun(2, { searchScore: 0, raw: { typecheck: 0 } }),
    mkRun(3, { searchScore: 0, raw: { typecheck: 0 } }),
  ]
  const report = runCanaries(runs)
  assert.equal(report.counts.silent_stage_failure, 1)
  assert.equal(report.counts.score_calibration_drift, 0)
  assert.equal(report.counts.failure_mode_distribution_shift, 0)
})
