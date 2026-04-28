/**
 * Tests the bare-alias invariant script. Writes a fixture jsonl with a mix
 * of pinned + bare-alias records and asserts the script exits non-zero.
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
const SCRIPT = resolve(REPO, 'scripts', 'check-bare-alias.ts')

function fixtureRecord(model: string, splitTag: string, runId: string): string {
  return JSON.stringify({
    runId,
    experimentId: 'audit/test',
    candidateId: 'c',
    seed: 0,
    model,
    promptHash: 'a'.repeat(64),
    configHash: 'b'.repeat(64),
    commitSha: 'sha',
    wallMs: 1,
    costUsd: 0,
    tokenUsage: { input: 0, output: 0 },
    outcome: { searchScore: 0.5, raw: {} },
    splitTag,
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

test('check-bare-alias passes on all-pinned fixture', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-bare-'))
  try {
    const path = join(dir, 'runs.jsonl')
    writeFileSync(
      path,
      [
        fixtureRecord('claude-sonnet-4-6@claude-sonnet-4-5-20250929', 'search', '1'),
        fixtureRecord('claude-sonnet-4-6@unknown-historical', 'historical', '2'),
      ].join('\n') + '\n',
    )
    const r = runScript(path)
    assert.equal(r.exitCode, 0, `expected 0 got ${r.exitCode}: ${r.stderr}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('check-bare-alias fails when a record has a bare alias', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-bare-'))
  try {
    const path = join(dir, 'runs.jsonl')
    writeFileSync(
      path,
      [
        fixtureRecord('claude-sonnet-4-6@claude-sonnet-4-5-20250929', 'search', '1'),
        fixtureRecord('claude-sonnet-4-6', 'search', '2'),
      ].join('\n') + '\n',
    )
    const r = runScript(path)
    assert.notEqual(r.exitCode, 0)
    assert.match(r.stderr, /bare-alias violation/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('check-bare-alias fails when historical sentinel used outside historical splitTag', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-bare-'))
  try {
    const path = join(dir, 'runs.jsonl')
    writeFileSync(
      path,
      fixtureRecord('claude-sonnet-4-6@unknown-historical', 'search', '1') + '\n',
    )
    const r = runScript(path)
    assert.notEqual(r.exitCode, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
