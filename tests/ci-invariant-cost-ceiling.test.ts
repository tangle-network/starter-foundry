/**
 * Tests the cost-ceiling invariant script. Asserts an over-ceiling record
 * fails the build.
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const SCRIPT = resolve(REPO, 'scripts', 'check-run-cost-ceiling.ts')

function record(experimentId: string, costUsd: number): string {
  return JSON.stringify({
    runId: `${experimentId}-${costUsd}`,
    experimentId,
    candidateId: 'c',
    seed: 0,
    model: 'claude-sonnet-4-6@claude-sonnet-4-5-20250929',
    promptHash: 'a'.repeat(64),
    configHash: 'b'.repeat(64),
    commitSha: 'sha',
    wallMs: 1,
    costUsd,
    tokenUsage: { input: 0, output: 0 },
    outcome: { searchScore: 0.5, raw: {} },
    splitTag: 'search',
    source: 'foundry',
  })
}

function runScript(jsonlPath: string): { exitCode: number; stderr: string; stdout: string } {
  const r = spawnSync(resolve(REPO, 'node_modules/.bin/tsx'), [SCRIPT, jsonlPath], {
    cwd: REPO,
    encoding: 'utf8',
  })
  return { exitCode: r.status ?? -1, stderr: r.stderr, stdout: r.stdout }
}

test('cost-ceiling passes when all records below ceiling', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-cost-'))
  try {
    const path = join(dir, 'runs.jsonl')
    writeFileSync(path, record('audit/test', 0.1) + '\n')
    const r = runScript(path)
    assert.equal(r.exitCode, 0, `expected 0 got ${r.exitCode}: ${r.stderr}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('cost-ceiling fails on over-ceiling record', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-cost-'))
  try {
    const path = join(dir, 'runs.jsonl')
    // default profile ceiling = $0.50
    writeFileSync(path, record('audit/test', 5.0) + '\n')
    const r = runScript(path)
    assert.notEqual(r.exitCode, 0)
    assert.match(r.stderr, /cost-ceiling violation/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('cost-ceiling uses role-specific profile when experimentId hints', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-cost-'))
  try {
    const path = join(dir, 'runs.jsonl')
    // family-author profile ceiling = $1.00 — $0.75 should pass.
    writeFileSync(path, record('family-author/remix', 0.75) + '\n')
    const r = runScript(path)
    assert.equal(r.exitCode, 0, `expected 0 got ${r.exitCode}: ${r.stderr}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
