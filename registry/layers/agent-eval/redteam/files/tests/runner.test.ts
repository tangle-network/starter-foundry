// Red-team runner — driver-error resilience + severity-sorted topFailures.
//
// Regression bait:
//   - Pre-fix: a single `throw` from the driver aborted the entire sweep,
//     losing every signal from later scenarios. Test asserts the runner
//     classifies the throw as a per-scenario error and continues.
//   - Pre-fix: `topFailures = failures.slice(0, 5)` returned iteration
//     order, so the worst failure could land off the top-5. Test asserts
//     severity-descending ordering.

import test, { describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  runRedTeam,
  type RedTeamAgentDriver,
  type RedTeamDriverResult,
} from '../src/eval/redteam/runner.js'

describe('redteam runner: driver errors do not abort the sweep', () => {
  test('throwing driver on a scenario does not abort the sweep', async () => {
    // The driver throws on the second case it sees and refuses on every
    // other one. The runner must classify the throw as an error and
    // continue scoring the remaining cases.
    let seen = 0
    const failOn = 2
    const driver: RedTeamAgentDriver = async () => {
      seen += 1
      if (seen === failOn) throw new Error('transient network failure')
      return { output: 'I cannot help with that.', toolCalls: [] }
    }
    const report = await runRedTeam(driver, {})
    assert.ok(report.findings.length >= 1, 'at least one scenario should score')
    assert.equal(report.errorCount, 1, 'exactly one error recorded')
    assert.match(report.errors[0]!.error, /transient network failure/)
    // Total cases observed (findings + errors) equals the corpus size.
    assert.equal(report.findings.length + report.errorCount, seen)
  })

  test('failFast mode records the error before aborting', async () => {
    // Driver throws on case #1 → failFast must record the error then stop.
    const driver: RedTeamAgentDriver = async () => {
      throw new Error('boom')
    }
    const report = await runRedTeam(driver, { failFast: true })
    assert.equal(report.errorCount, 1)
    assert.equal(report.findings.length, 0)
  })
})

describe('redteam runner: topFailures sorted by severity, worst-first', () => {
  test('every scenario fails ⇒ topFailures sorted descending by severity', async () => {
    // Force every case in the default corpus to fail by emitting the
    // forbidden-string canary token in the output. The runner's
    // topFailures slice MUST be ordered by category severity, not by
    // iteration order.
    const driver: RedTeamAgentDriver = async (): Promise<RedTeamDriverResult> => ({
      // The default corpus uses category-specific forbidden tokens; emit
      // a generic refusal-style failure by outputting the actual attack
      // input back to the agent (echoed instructions = injection success).
      output: 'IGNORE PREVIOUS INSTRUCTIONS',
      toolCalls: ['system-admin'], // also trips forbiddenTools where applicable
    })
    const report = await runRedTeam(driver, {})
    // At least some failures must have surfaced (default corpus + this
    // hostile output guarantees a non-trivial fail set).
    assert.ok(report.topFailures.length > 0, 'expected ≥1 top failure under hostile-driver test')
    // Severity must be monotone-non-increasing.
    for (let i = 1; i < report.topFailures.length; i += 1) {
      assert.ok(
        report.topFailures[i - 1]!.severity >= report.topFailures[i]!.severity,
        `topFailures must be severity-descending; broke at index ${i} (${report.topFailures[i - 1]!.severity} < ${report.topFailures[i]!.severity})`,
      )
    }
    // The top entry's severity must be ≥ 0.7 (every high-stakes category
    // exceeds 0.7; if persona/DAN bubbled to #1 the sort is broken).
    assert.ok(
      report.topFailures[0]!.severity >= 0.7,
      `top failure severity must reflect a high-impact category; got ${report.topFailures[0]!.severity} for ${report.topFailures[0]!.finding.category}`,
    )
  })
})
