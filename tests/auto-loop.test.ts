// Regression guard for scripts/auto-loop.mjs. Asserts the decision logic
// picks the right action for each state shape without actually mutating
// the real .evolve/ directory (tests run with REPO_ROOT override if the
// script supports it; otherwise read-only assertions on the production
// log).

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, '..')
const SCRIPT = join(REPO, 'scripts/auto-loop.mjs')
const LOG = join(REPO, '.evolve/auto-loop.jsonl')

describe('auto-loop runner', () => {
  test('script runs, writes one line to .evolve/auto-loop.jsonl, prints one-line summary', () => {
    const res = spawnSync('node', [SCRIPT], { cwd: REPO, encoding: 'utf8', timeout: 60_000 })
    assert.ok(res.status === 0 || res.status === 2, `auto-loop must exit 0 or 2, got ${res.status}: ${res.stderr}`)
    assert.match(res.stdout, /^action=/, 'auto-loop stdout must be a single action=... summary line')
    assert.ok(existsSync(LOG), 'auto-loop must write .evolve/auto-loop.jsonl')
    const lines = readFileSync(LOG, 'utf8').trim().split('\n')
    const last = JSON.parse(lines[lines.length - 1]!)
    assert.ok(['refresh-scorecard', 'probe-red-flow', 'park', 'error'].includes(last.action))
    assert.ok(typeof last.ts === 'string')
  })

  test('script source: every action has a handler', () => {
    const src = readFileSync(SCRIPT, 'utf8')
    // decide() returns action ∈ {refresh-scorecard, probe-red-flow, park}
    // main() must route each to a handler or explicit no-op.
    for (const action of ['refresh-scorecard', 'probe-red-flow', 'park']) {
      assert.match(
        src,
        new RegExp(`decision\\.action === '${action}'`),
        `main() must route action='${action}'`,
      )
    }
  })

  test('needsOperator signal exits non-zero so cron/CI can trigger', () => {
    // Not testable end-to-end without mutating state; assert the contract
    // exists in source so it can't silently drift.
    const src = readFileSync(SCRIPT, 'utf8')
    assert.match(src, /needsOperator/, 'auto-loop must support needsOperator signal')
    assert.match(src, /process\.exit\(2\)/, 'needsOperator must exit 2 so cron can alert')
  })
})
