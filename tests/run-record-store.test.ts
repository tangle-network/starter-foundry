/**
 * RunRecord store tests — append/read/iterate against a tmp jsonl. Uses the
 * real validator on every line; corrupt files surface as errors with a
 * line number, not silent skips.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { appendRunRecord, readRunRecords, iterRunRecords } from '../dist/lib/run-record-store.js'

const VALID = {
  runId: '00000000-0000-0000-0000-000000000001',
  experimentId: 'audit/gen17',
  candidateId: 'remix-static-ts',
  seed: 0,
  model: 'claude-sonnet-4-6@claude-sonnet-4-5-20250929',
  promptHash: 'a'.repeat(64),
  configHash: 'b'.repeat(64),
  commitSha: 'deadbeef',
  wallMs: 1234,
  costUsd: 0.012,
  tokenUsage: { input: 100, output: 200 },
  outcome: { searchScore: 0.85, raw: { install: true, typecheck: true } },
  splitTag: 'search' as const,
  source: 'foundry' as const,
}

function freshPath(): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), 'sf-runs-'))
  return { dir, path: join(dir, 'runs.jsonl') }
}

test('appendRunRecord writes one line per record', () => {
  const { dir, path } = freshPath()
  try {
    appendRunRecord(VALID, path)
    appendRunRecord({ ...VALID, runId: '00000000-0000-0000-0000-000000000002' }, path)
    const lines = readFileSync(path, 'utf8').split('\n').filter((l) => l.length > 0)
    assert.equal(lines.length, 2)
    assert.equal(JSON.parse(lines[0]).runId, VALID.runId)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('appendRunRecord rejects bare-alias models before writing', () => {
  const { dir, path } = freshPath()
  try {
    const bad = { ...VALID, model: 'claude-sonnet-4-6' }
    assert.throws(() => appendRunRecord(bad, path))
    // File must not exist — validator rejection happens before any write.
    assert.deepEqual(readRunRecords(path), [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('appendRunRecord creates the parent directory when missing', () => {
  const { dir, path: _ } = freshPath()
  try {
    const nested = join(dir, 'a', 'b', 'runs.jsonl')
    appendRunRecord(VALID, nested)
    const records = readRunRecords(nested)
    assert.equal(records.length, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('readRunRecords returns [] when file missing (not throw)', () => {
  const { dir, path } = freshPath()
  try {
    assert.deepEqual(readRunRecords(path), [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('readRunRecords surfaces corrupt lines with line number', () => {
  const { dir, path } = freshPath()
  try {
    appendRunRecord(VALID, path)
    writeFileSync(
      path,
      readFileSync(path, 'utf8') + 'not-json{{\n' + JSON.stringify(VALID) + '\n',
    )
    assert.throws(
      () => readRunRecords(path),
      (e: Error) => /runs\.jsonl line 2/.test(e.message),
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('readRunRecords rejects validator-failing lines (e.g. bare alias) post-write', () => {
  const { dir, path } = freshPath()
  try {
    appendRunRecord(VALID, path)
    // Hand-write a record that bypasses appendRunRecord's validator.
    writeFileSync(
      path,
      readFileSync(path, 'utf8') + JSON.stringify({ ...VALID, model: 'claude-sonnet-4-6' }) + '\n',
    )
    assert.throws(
      () => readRunRecords(path),
      (e: Error) => /runs\.jsonl line 2/.test(e.message),
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('iterRunRecords yields each record', () => {
  const { dir, path } = freshPath()
  try {
    appendRunRecord(VALID, path)
    appendRunRecord({ ...VALID, runId: '00000000-0000-0000-0000-000000000002' }, path)
    const collected = [...iterRunRecords(path)]
    assert.equal(collected.length, 2)
    assert.equal(collected[1].runId, '00000000-0000-0000-0000-000000000002')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('iterRunRecords skips blank lines and surfaces line errors', () => {
  const { dir, path } = freshPath()
  try {
    writeFileSync(path, JSON.stringify(VALID) + '\n\n' + 'broken\n', 'utf8')
    assert.throws(
      () => [...iterRunRecords(path)],
      (e: Error) => /runs\.jsonl line 3/.test(e.message),
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
