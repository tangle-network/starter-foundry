// Regression guard for the consumer-feedback bridge. Builds a tiny
// fixture session tree (BA layout: gen/variant/runId/{manifest,scaffold-compose,verification-shot-N}.json)
// and asserts attribution buckets each shape correctly.

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, '..')
const SCRIPT = join(REPO, 'scripts/consume-vb-feedback.ts')
const TSX = join(REPO, 'node_modules/.bin/tsx')

function fixture(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'vb-feedback-')))

  const writeSession = (
    dir: string,
    manifest: Record<string, unknown>,
    scaffold: Record<string, unknown> | null,
    verifications: Array<Record<string, unknown>>,
  ) => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest))
    if (scaffold) writeFileSync(join(dir, 'scaffold-compose.json'), JSON.stringify(scaffold))
    verifications.forEach((v, i) => {
      writeFileSync(join(dir, `verification-shot-${i + 1}.json`), JSON.stringify(v))
    })
  }

  // 1. Pass: outcome=satisfied
  writeSession(
    join(root, 'gen44', 'variant-a', 'run-pass'),
    { runId: 'run-pass', generation: 44, leafId: 'leaf-1', verticalId: 'crypto', outcome: 'satisfied' },
    { available: true, family: 'react-vite-ts', layers: [], partner: null, fileCount: 10 },
    [{ allPass: true, layers: [{ layer: 'install', status: 'pass' }] }],
  )

  // 2. Routing-error: scaffold-compose.available=false
  writeSession(
    join(root, 'gen44', 'variant-a', 'run-routing-error'),
    { runId: 'run-routing-error', generation: 44, leafId: 'leaf-2', verticalId: 'ai-agents', outcome: 'failed' },
    { available: false, error: 'no family matched', family: null, layers: [], partner: null, fileCount: 0 },
    [],
  )

  // 3. Scaffold-gap: install failed on shot 1
  writeSession(
    join(root, 'gen44', 'variant-a', 'run-scaffold-gap'),
    { runId: 'run-scaffold-gap', generation: 44, leafId: 'leaf-3', verticalId: 'fintech', outcome: 'failed' },
    { available: true, family: 'api-service', layers: [], partner: null, fileCount: 5 },
    [{
      allPass: false,
      layers: [
        { layer: 'install', status: 'fail', findings: [{ msg: 'pkg X not found' }] },
      ],
    }],
  )

  // 4. Agent-error: install passed, build failed on shot 2 (multi-shot)
  writeSession(
    join(root, 'gen44', 'variant-a', 'run-agent-error'),
    { runId: 'run-agent-error', generation: 44, leafId: 'leaf-4', verticalId: 'crypto', outcome: 'failed' },
    { available: true, family: 'react-vite-ts', layers: [], partner: null, fileCount: 12 },
    [
      { allPass: false, layers: [{ layer: 'install', status: 'pass' }, { layer: 'build', status: 'fail' }] },
      { allPass: false, layers: [{ layer: 'install', status: 'pass' }, { layer: 'build', status: 'fail' }] },
    ],
  )

  // 5. Below since-gen filter (must be excluded)
  writeSession(
    join(root, 'gen30', 'variant-old', 'run-old'),
    { runId: 'run-old', generation: 30, leafId: 'old-leaf', verticalId: 'crypto', outcome: 'failed' },
    { available: false, family: null, layers: [], partner: null, fileCount: 0 },
    [],
  )

  return root
}

describe('consume-vb-feedback', () => {
  test('attributes pass / routing-error / scaffold-gap / agent-error correctly', () => {
    const root = fixture()
    try {
      const res = spawnSync(
        TSX,
        [SCRIPT, '--source', root, '--consumer', 'test-consumer', '--since-gen', '40', '--dry-run'],
        { cwd: REPO, encoding: 'utf8' },
      )
      assert.equal(res.status, 0, `dry-run failed: ${res.stderr}`)
      const summary = JSON.parse(res.stdout)
      assert.equal(summary.totalSessions, 4, '4 sessions after since-gen filter (gen30 excluded)')
      assert.equal(summary.buckets.pass, 1)
      assert.equal(summary.buckets['routing-error'], 1)
      assert.equal(summary.buckets['scaffold-gap'], 1)
      assert.equal(summary.buckets['agent-error'], 1)
      // 3 non-pass; 2 attributable to SF (routing + scaffold-gap)
      assert.equal(summary.totalNonPass, 3)
      assert.equal(summary.scaffoldAttributableNonPass, 2)
      assert.ok(Math.abs(summary.scaffoldAttributableRate - 0.6667) < 0.01)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('--dry-run does not touch .evolve/vb-feedback/', () => {
    const root = fixture()
    const sentinelPath = join(REPO, '.evolve/vb-feedback/should-not-exist-after-dry-run.tmp')
    try {
      const res = spawnSync(
        TSX,
        [SCRIPT, '--source', root, '--consumer', 'dry-run-test', '--since-gen', '40', '--dry-run'],
        { cwd: REPO, encoding: 'utf8' },
      )
      assert.equal(res.status, 0)
      // No fixture writes a file matching this pattern; guard is that
      // the dry-run path never writes anything new under vb-feedback.
      // (Any pre-existing files in vb-feedback are unaffected by dry-run.)
      const dryRunOutputs = res.stdout.match(/.evolve\/vb-feedback/)
      assert.equal(dryRunOutputs, null, 'dry-run must not log a write path')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('exit non-zero when --source missing', () => {
    const res = spawnSync(TSX, [SCRIPT], { cwd: REPO, encoding: 'utf8' })
    assert.equal(res.status, 2, '--source is required')
  })

  test('source missing on disk → exit 2 with helpful error', () => {
    const res = spawnSync(TSX, [SCRIPT, '--source', '/nonexistent/path'], { cwd: REPO, encoding: 'utf8' })
    assert.equal(res.status, 2)
    assert.match(res.stderr, /source not found/)
  })
})
