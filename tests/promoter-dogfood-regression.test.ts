// Regression test for PR #55's bug: capability:agent-eval declared
// `@tangle-network/agent-eval` in packageDeps.dependencies but NO file
// in its `files/` imported anything from it. Compile-gate passed,
// fidelity passed, the dep shipped inert.
//
// This test REPLAYS that shape directly through the dogfood gate that's
// supposed to catch it (declared-dep-used) — asserting both:
//   1. The gate signature: `status === 'fail'` with the specific
//      unused dep name. This is the "the exact gate that would have
//      caught the bug when it shipped" contract.
//   2. The promoter scripts import the gate so the wiring is live
//      (guards against future drift where someone deletes the import).
//
// Why replay the gate directly rather than spawn the full promoter:
// the end-to-end pipeline runs `pnpm build`, subprocess compose, and
// agent-eval's SandboxHarness — all of which are already covered by
// other tests. The UNIQUE regression surface here is the gate fired at
// the right input shape, which is what this asserts.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkDeclaredDepUsed } from '../dist/lib/promoter-gates.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

describe('promoter dogfood regression (PR #55 shape)', () => {
  test('declared-dep-used fails on capability:agent-eval-style draft with no import of declared dep', () => {
    // Simulate a composed output dir that mirrors the PR #55 shape: the
    // scaffold's package.json declares @tangle-network/agent-eval
    // (because the capability's packageDeps merged in), but no source
    // file imports it. That's the exact shape the gate must catch.
    const composedDir = mkdtempSync(join(tmpdir(), 'pr55-regression-'))
    try {
      // package.json declares the dep (from capability packageDeps merge) —
      // this alone does NOT count as use (see gate's rel === 'package.json'
      // skip).
      writeFileSync(
        join(composedDir, 'package.json'),
        JSON.stringify(
          {
            name: 'pr55-regression-agent',
            version: '0.0.1',
            scripts: { start: 'node server.mjs' },
            dependencies: {
              '@tangle-network/agent-eval': '^0.19.0',
              // Another dep that IS imported — proves the gate isn't just
              // reporting every package.json entry as unused.
              express: '^4.18.0',
            },
          },
          null,
          2,
        ),
      )
      // Source file imports express but NOT @tangle-network/agent-eval.
      // This is the PR #55 bug: capability declared the dep, no file
      // anywhere under the composed output actually uses it.
      mkdirSync(join(composedDir, 'src'), { recursive: true })
      writeFileSync(
        join(composedDir, 'src/index.ts'),
        `
import express from 'express'
const app = express()
app.get('/health', (_req, res) => res.json({ ok: true }))
export default app
`,
      )

      // Capability manifest as it shipped in PR #55 — declares the dep,
      // provides files that DON'T import it.
      const manifest = {
        id: 'agent-eval',
        packageDeps: {
          dependencies: {
            '@tangle-network/agent-eval': '^0.19.0',
          },
        },
      }

      const res = checkDeclaredDepUsed({ manifest, composedDir })
      assert.equal(
        res.status,
        'fail',
        `PR #55 regression: declared-dep-used must fail when capability declares a dep no file imports. Got status=${res.status}`,
      )
      assert.deepEqual(
        res.unusedDeps,
        ['@tangle-network/agent-eval'],
        `unusedDeps must list exactly the undeclared-but-imported offender — got ${JSON.stringify(res.unusedDeps)}`,
      )
      assert.equal(
        res.gate,
        'declared-dep-used',
        'gate name must match the promoter script short-circuit key',
      )
    } finally {
      rmSync(composedDir, { recursive: true, force: true })
    }
  })

  test('both promoter scripts import checkDeclaredDepUsed from dist/lib/promoter-gates.js', () => {
    // Wiring invariant: if either promoter stops importing the gate, it
    // won't fire, and the PR #55 class of bug can re-ship silently. This
    // catches that drift — same shape as the HARNESS_CONFIGS invariant
    // in tests/muffled-gate-invariant.test.ts.
    const scripts = ['scripts/promote-family-proposal.ts', 'scripts/promote-capability-proposal.ts']
    for (const script of scripts) {
      const path = join(REPO_ROOT, script)
      assert.ok(existsSync(path), `expected ${script} to exist`)
      const text = readFileSync(path, 'utf8')
      assert.match(
        text,
        /checkDeclaredDepUsed.*from.*promoter-gates\.js/s,
        `${script} must import checkDeclaredDepUsed from dist/lib/promoter-gates.js`,
      )
      assert.match(text, /checkScaffoldRuns/, `${script} must reference checkScaffoldRuns (gate 2)`)
      assert.match(text, /checkEvalScores/, `${script} must reference checkEvalScores (gate 3)`)
    }
  })

  test('promoter scripts short-circuit with gateReached=declared-dep-used when gate 1 fails', () => {
    // The promoter's dogfood block writes validation-errors.json and
    // calls fail(id, 'declared-dep-used', ...) — assert the `fail`
    // site exists with that exact gateReached string.
    const scripts = ['scripts/promote-family-proposal.ts', 'scripts/promote-capability-proposal.ts']
    for (const script of scripts) {
      const text = readFileSync(join(REPO_ROOT, script), 'utf8')
      // Whitespace tolerant: prettier may split `fail(id, 'gate', ...)` across
      // lines when the third arg gets long enough to wrap. The contract is
      // "fail() called with this gate string", not the source layout.
      assert.match(
        text,
        /fail\(\s*id,\s*'declared-dep-used'/,
        `${script} must short-circuit to gateReached='declared-dep-used' — the PR #55 bug catcher`,
      )
      assert.match(
        text,
        /fail\(\s*id,\s*'scaffold-runs'/,
        `${script} must short-circuit to gateReached='scaffold-runs'`,
      )
      assert.match(
        text,
        /fail\(\s*id,\s*'eval-scores'/,
        `${script} must short-circuit to gateReached='eval-scores'`,
      )
    }
  })
})
