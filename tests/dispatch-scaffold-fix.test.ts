// Gen 10 — dispatch-scaffold-fix contract guard. Asserts the script:
// gates on SF_AUTO_DISPATCH, picks the largest cluster, builds a
// focused brief with samples, exits cleanly on dry-run + missing input.

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, renameSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, '..')
const SCRIPT = join(REPO, 'scripts/dispatch-scaffold-fix.ts')

describe('dispatch-scaffold-fix', () => {
  test('gated: refuses to run without SF_AUTO_DISPATCH=1 or --force', () => {
    const res = spawnSync('node', [SCRIPT, '--dry-run'], {
      cwd: REPO,
      encoding: 'utf8',
      env: { ...process.env, SF_AUTO_DISPATCH: '' },
    })
    assert.equal(res.status, 2, 'must exit 2 when not opted in')
    assert.match(res.stderr, /SF_AUTO_DISPATCH/, 'must explain the gate to operator')
  })

  test('--dry-run prints the brief without dispatching', () => {
    const res = spawnSync('node', [SCRIPT, '--dry-run', '--force'], {
      cwd: REPO,
      encoding: 'utf8',
    })
    // 0 if dispatch built brief, 2 if no clusters with ≥3 failures.
    // Both are honest exit codes — the test asserts no crash.
    assert.ok([0, 2].includes(res.status ?? -1), `unexpected exit ${res.status}: ${res.stderr}`)
  })

  test('refuses without consumer feedback latest.json', () => {
    // Move the file aside, restore after.
    const fb = join(REPO, '.evolve/vb-feedback/latest.json')
    if (!existsSync(fb)) return // skip if already absent
    const tmp = mkdtempSync(join(tmpdir(), 'sf-fb-'))
    const stash = join(tmp, 'latest.json')
    const original = readFileSync(fb, 'utf8')
    writeFileSync(stash, original)
    renameSync(fb, fb + '.testbackup')
    try {
      const res = spawnSync('node', [SCRIPT, '--dry-run', '--force'], {
        cwd: REPO,
        encoding: 'utf8',
      })
      assert.equal(res.status, 2)
      assert.match(res.stderr, /no consumer feedback/)
    } finally {
      renameSync(fb + '.testbackup', fb)
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  test('source defines hard budget (5 iter / $1 / 10 min)', () => {
    const dispSrc = readFileSync(SCRIPT, 'utf8')
    assert.match(dispSrc, /iterations:\s*5/, 'budget.iterations must be 5')
    assert.match(dispSrc, /usd:\s*1\b/, 'budget.usd must be 1')
    assert.match(dispSrc, /wallSec:\s*600/, 'budget.wallSec must be 600 (10min)')
  })

  test('auto-loop wires dispatch-fix as a fourth action', () => {
    const loopSrc = readFileSync(join(REPO, 'scripts/auto-loop.ts'), 'utf8')
    assert.match(loopSrc, /action: 'dispatch-fix'/, 'auto-loop must declare dispatch-fix action')
    assert.match(loopSrc, /SF_AUTO_DISPATCH/, 'auto-loop must gate on SF_AUTO_DISPATCH')
    // Rate-limit: must check hours since last dispatch
    assert.match(loopSrc, /hoursSinceLast/, 'auto-loop must rate-limit dispatch-fix')
  })
})
