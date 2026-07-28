// Evolve R2 (post-Gen-9) regression guard: the proposal_promotion_rate
// metric must count UNIQUE ids per-outcome, not events, AND must skip
// fixture-only ids that tests use to assert error paths.
//
// History: pre-R2, this metric read 0.034 (10× below target). Two bugs:
// (1) test-fixture promoter invocations (ids like 'definitely-nonexistent-*',
//     'bun-monolith', 'nonexistent-xyz') wrote real failure events to
//     .evolve/generation-impact.jsonl, polluting the denominator.
// (2) Event-level counting: a proposal that was promoted → reverted →
//     re-promoted contributed 2 promoted events and 1 revert. The
//     numerator counted 1 (post-revert), denominator counted 2 (both
//     events) — artificially halving the rate even for successful
//     retry-and-ship workflows.
// Fix: (1) tests set STARTER_FOUNDRY_SYNTHETIC_RUN=1 to no-op logImpact;
//       (2) scorecard dedupes by id, counting latest-state per id.
// Real rate post-fix: 0.75 (3 of 4 unique proposals landed in registry).

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, '..')

describe('proposal_promotion_rate measurement', () => {
  test('promoter scripts no-op logImpact when STARTER_FOUNDRY_SYNTHETIC_RUN=1', () => {
    for (const script of [
      'scripts/promote-family-proposal.ts',
      'scripts/promote-capability-proposal.ts',
    ]) {
      const text = readFileSync(join(REPO, script), 'utf8')
      assert.match(
        text,
        /STARTER_FOUNDRY_SYNTHETIC_RUN === '1'/,
        `${script} must gate logImpact on STARTER_FOUNDRY_SYNTHETIC_RUN — tests pollute production metrics otherwise`,
      )
    }
  })

  test('scorecard filters fixture-only ids from impact log', () => {
    const text = readFileSync(join(REPO, 'scripts/refresh-scorecard.ts'), 'utf8')
    // Known fixture patterns that must stay in the filter.
    for (const pattern of [
      /\^test-/, // test- prefix
      /\^synthetic-/, // synthetic- prefix
      /nonexistent/, // (definitely-)?nonexistent variants
      /bun-monolith/, // schema-reject fixture
      /ts-eval-harness/, // schema-reject fixture
      /already exists/, // idempotency retry
    ]) {
      assert.match(
        text,
        pattern,
        `refresh-scorecard.mjs must filter ${pattern} — otherwise test runs pollute proposal_promotion_rate`,
      )
    }
  })

  test('scorecard uses per-id-outcome counting, not per-event', () => {
    const text = readFileSync(join(REPO, 'scripts/refresh-scorecard.ts'), 'utf8')
    // The latest-state-per-id pattern must exist. A regression back to
    // raw event counting would inflate the denominator on
    // revert-and-retry workflows.
    assert.match(
      text,
      /latestByIdPromote|idOutcomes/,
      'scorecard must compute proposal_promotion_rate as unique-id outcomes, not raw event counts',
    )
  })
})
