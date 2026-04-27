// Family runner imports the layer's `loadScenarios` (extend, don't duplicate).
//
// Regression bait:
//   - Pre-fix: the family's `runner.ts` re-implemented a weaker scenario
//     loader inline. Bad scenarios (missing required fields) silently
//     loaded; the layer's strict validator was bypassed. Test asserts the
//     family's runner now wires the layer's loader and rejects malformed
//     scenarios with the layer's error message.

import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

// Compose-time, the layer's loader lands at ../src/eval/scenario-loader.js
// next to the family runner. At test-time we import from the layer's
// source directly so the test exercises what the family will actually
// ship with after composition.
import { loadScenarios } from '../../../../layers/agent-eval/scenarios/files/src/eval/scenario-loader.js'

const HERE = dirname(fileURLToPath(import.meta.url))
// loadScenarios reads .scenario.ts/.scenario.js — at test-time the fixtures
// have been compiled to .scenario.js next to this file in dist-layer-tests.
const GOOD = resolve(HERE, 'fixtures', 'scenarios-good')
const BAD = resolve(HERE, 'fixtures', 'scenarios-bad')

describe('agent-eval-harness-ts: family runner uses layer loader', () => {
  test('runner.ts imports loadScenarios from scenario-loader (the layer)', () => {
    // HERE = .../dist-layer-tests/registry/families/agent-eval-harness-ts/files/tests
    // Walk up to the repo root, then back down to the family's source tree.
    const repoRoot = resolve(HERE, '..', '..', '..', '..', '..', '..')
    const runnerPath = resolve(
      repoRoot,
      'registry/families/agent-eval-harness-ts/files/src/eval/runner.ts',
    )
    const text = readFileSync(runnerPath, 'utf8')
    assert.match(
      text,
      /from\s+'\.\/scenario-loader\.js'/,
      'runner.ts must import from the composed layer (scenario-loader.js), not re-implement',
    )
    assert.doesNotMatch(
      text,
      /async function loadScenariosFrom\b/,
      'family runner must not declare a local loadScenariosFrom — that was the duplicate',
    )
  })

  test('layer loader accepts a fully-shaped scenario', async () => {
    const loaded = await loadScenarios(GOOD)
    assert.equal(loaded.length, 1)
    assert.equal(loaded[0]!.scenario.id, 'fixture-good')
  })

  test('layer loader rejects a scenario missing required fields', async () => {
    await assert.rejects(
      () => loadScenarios(BAD),
      /missing required field "thesis"/,
      'layer loader must surface the layer\'s strict error message, not silently include the bad scenario',
    )
  })
})
