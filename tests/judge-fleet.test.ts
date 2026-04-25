// Gen 10 — invokeJudgeFleet contract guard. Asserts the function exists,
// returns the documented FleetVerdict shape, and short-circuits cleanly
// when no language-specific commands are available.

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, '..')

describe('invokeJudgeFleet', () => {
  test('exported from scaffold-bridge with documented signature', async () => {
    const mod = await import('../dist/eval/scaffold-bridge.js')
    assert.equal(typeof mod.invokeJudgeFleet, 'function')
  })

  test('FleetVerdict type contract: unanimousPass + byJudge + overall + wallMs', () => {
    const src = readFileSync(join(REPO, 'src/eval/scaffold-bridge.ts'), 'utf8')
    assert.match(src, /export interface FleetVerdict/)
    for (const field of ['unanimousPass', 'byJudge', 'overall', 'wallMs']) {
      assert.match(
        src,
        new RegExp(`${field}:`),
        `FleetVerdict must declare ${field}`,
      )
    }
  })

  test('unknown language → empty fleet, unanimousPass=false (honest, no fabrication)', async () => {
    const mod = await import('../dist/eval/scaffold-bridge.js')
    const components = {
      family: { id: 'fake', taxonomy: { language: 'cobol-1959', surface: 'mainframe' } },
      layers: [],
      partner: null,
      slotSelections: {},
    }
    const verdict = await mod.invokeJudgeFleet({
      components: components as never,
      harness: { setupCommand: 'true', testCommand: 'true', timeoutMs: 1000 },
    })
    assert.equal(verdict.unanimousPass, false, 'no judges = no unanimous pass (honest-null shape, never fabricated true)')
    assert.equal(verdict.byJudge.length, 0)
    assert.equal(verdict.overall, 0)
  })

  test('typescript family invokes compiler + test + lint + security judges', () => {
    const src = readFileSync(join(REPO, 'src/eval/scaffold-bridge.ts'), 'utf8')
    // Source-grep contract: the typescript dispatch arm must reference
    // all four judge kinds. Catches a regression where someone deletes
    // a judge from the fleet.
    const tsBlock = src.match(/case 'typescript':[\s\S]+?case 'rust':/m)
    assert.ok(tsBlock, 'typescript fleet config must exist')
    for (const judge of ['compiler:', 'test:', 'linter:', 'security:']) {
      assert.match(tsBlock![0], new RegExp(judge), `typescript fleet must declare ${judge}`)
    }
  })
})
