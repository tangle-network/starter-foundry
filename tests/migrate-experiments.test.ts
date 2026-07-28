/**
 * Migration script test — runs the historical-experiments migration twice
 * against a fixture, asserts the second run is a no-op (idempotent).
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { validateRunRecord } from '@tangle-network/agent-eval'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const SCRIPT = resolve(REPO, 'scripts', 'migrate-experiments-to-run-records.ts')

function runMigration(cwd: string): { exitCode: number; stdout: string; stderr: string } {
  const r = spawnSync(resolve(REPO, 'node_modules/.bin/tsx'), [SCRIPT], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NODE_PATH: join(REPO, 'node_modules') },
  })
  return { exitCode: r.status ?? -1, stdout: r.stdout, stderr: r.stderr }
}

test('migration is idempotent on a fixture experiments.jsonl', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-migrate-'))
  try {
    // The migration script reads paths relative to cwd; we set cwd = dir.
    // Stage a fake .evolve/experiments.jsonl + a symlink to node_modules so
    // tsx can resolve src imports.
    mkdirSync(join(dir, '.evolve'), { recursive: true })
    writeFileSync(
      join(dir, '.evolve', 'experiments.jsonl'),
      [
        JSON.stringify({ generation: 'gen10', slug: 'a', score: 0.7, costUsd: 0.01 }),
        JSON.stringify({ generation: 'gen11', slug: 'b', score: 0.85, costUsd: 0.02 }),
      ].join('\n') + '\n',
    )

    // The script stays at the repo location so its source imports resolve;
    // changing cwd only redirects its `.evolve` input and output paths.
    const r1 = runMigration(dir)
    assert.equal(r1.exitCode, 0, `first run failed: ${r1.stderr}`)
    const after1 = JSON.parse(r1.stdout) as { appended: number; skipped: number }
    assert.ok(after1.appended >= 2, `expected >=2 appended got ${after1.appended}`)

    const runsPath = join(dir, '.evolve', 'runs.jsonl')
    assert.ok(existsSync(runsPath))
    const records = readFileSync(runsPath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => validateRunRecord(JSON.parse(line)))
    const linesAfter1 = records.length
    assert.equal(records[0]?.splitTag, 'dev')
    assert.equal(records[0]?.terminalOutcome, 'unknown')
    assert.equal(records[0]?.costProvenance.kind, 'estimated')
    assert.match(records[0]?.scenarioId ?? '', /^legacy\/experiments\//)

    // Second run — must be a no-op.
    const r2 = runMigration(dir)
    assert.equal(r2.exitCode, 0, `second run failed: ${r2.stderr}`)
    const after2 = JSON.parse(r2.stdout) as { appended: number; skipped: number }
    assert.equal(after2.appended, 0, 'second run must be a no-op')
    assert.ok(after2.skipped >= 2)

    const linesAfter2 = readFileSync(runsPath, 'utf8').trim().split('\n').length
    assert.equal(linesAfter2, linesAfter1, 'runs.jsonl line count must be stable across runs')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
