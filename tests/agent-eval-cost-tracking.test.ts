// R4 regression guard: the agent-eval-scaffold runner must actually
// populate cost-summary.json via CostTracker.
//
// Pre-R4 bug (governor-requested fix): `scripts/agent-eval-scaffold.ts`
// instantiated `new CostTracker()` at line 105 but never called `.record()`.
// At end-of-run it wrote `costTracker.getSummary?.()` — the method is
// actually named `.summary()`, and optional chaining silent-failed to `{}`.
// Result: cost-summary.json was `{}` on every run; cost_usd_per_buildout
// stayed null on the scorecard.
//
// Fix:
// 1. invokeMetaJudge returns a `.usage` field with estimated tokens + model.
// 2. agent-eval-scaffold.mjs calls costTracker.record() + markOutcome()
//    after each invokeMetaJudge call.
// 3. End-of-run writes costTracker.summary() (correct name, no optional chain).
//
// This test asserts (1) the method wiring is correct by source inspection,
// (2) the round trip of CostTracker yields a non-empty summary when records
// exist, and (3) invokeMetaJudge's usage field shape matches CostTracker's
// record() input.

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CostTracker } from '@tangle-network/agent-eval'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, '..')

describe('agent-eval-scaffold cost tracking', () => {
  test('agent-eval-scaffold.mjs records into costTracker and writes real summary', () => {
    const src = readFileSync(join(REPO, 'scripts/agent-eval-scaffold.ts'), 'utf8')

    // Must call recordVerdict (0.7.2 helper — one call replaces record + markOutcome).
    assert.match(
      src,
      /costTracker\.recordVerdict\(/,
      'agent-eval-scaffold must call costTracker.recordVerdict(verdict, seedId, tags) — otherwise cost-summary.json stays empty',
    )
    // End-of-run must call .summary(), not .getSummary?.() which silent-fails.
    assert.match(
      src,
      /costTracker\.summary\(\)/,
      'agent-eval-scaffold must call costTracker.summary() — the optional-chained .getSummary?.() was pre-R4 silent-fail bug',
    )
    assert.doesNotMatch(
      src,
      /costTracker\.getSummary/,
      'agent-eval-scaffold must NOT call costTracker.getSummary — method name is .summary() in agent-eval',
    )
  })

  test('invokeMetaJudge return type includes usage field', () => {
    const src = readFileSync(join(REPO, 'src/eval/scaffold-bridge.ts'), 'utf8')
    assert.match(
      src,
      /usage\?:\s*\{[\s\S]{0,200}inputTokens:\s*number[\s\S]{0,200}outputTokens:\s*number[\s\S]{0,200}model:\s*string/,
      'ScaffoldMetaVerdict must declare a usage field with inputTokens + outputTokens + model',
    )
  })

  test('CostTracker round-trip — record() + markOutcome() + summary() produces non-empty report', () => {
    const tracker = new CostTracker()
    tracker.record({
      scenarioId: 'probe-1',
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1200,
      outputTokens: 400,
      tags: { phase: 'meta-judge' },
    })
    tracker.markOutcome('probe-1', true)
    tracker.record({
      scenarioId: 'probe-2',
      model: 'claude-sonnet-4-20250514',
      inputTokens: 900,
      outputTokens: 300,
    })
    tracker.markOutcome('probe-2', false)

    const summary = tracker.summary()
    assert.equal(summary.scenarioCount, 2, 'scenarioCount reflects record() calls')
    assert.equal(summary.completedCount, 1, 'completedCount reflects markOutcome(true)')
    assert.equal(summary.totalInputTokens, 2100, 'input tokens sum')
    assert.equal(summary.totalOutputTokens, 700, 'output tokens sum')
    assert.ok(
      summary.totalCostUsd > 0,
      'totalCostUsd > 0 when non-zero tokens recorded with priced model',
    )
    assert.ok(
      summary.costPerCompletedTaskUsd != null && summary.costPerCompletedTaskUsd > 0,
      'costPerCompletedTaskUsd populated when ≥1 markOutcome(true)',
    )
  })
})
