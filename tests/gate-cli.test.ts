import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { validateRunRecord } from '@tangle-network/agent-eval'

import { runGate } from '../dist/lib/cli/gate.js'

function currentHoldoutRecord(candidateId: string, holdoutScore: number) {
  return validateRunRecord({
    runId:
      candidateId === 'baseline'
        ? '00000000-0000-4000-8000-000000000001'
        : '00000000-0000-4000-8000-000000000002',
    experimentId: 'cli/current-contract',
    scenarioId: 'scenario-1',
    candidateId,
    seed: 0,
    model: 'claude-sonnet-4-6@2025-09-29',
    promptHash: 'a'.repeat(64),
    configHash: 'b'.repeat(64),
    commitSha: 'deadbeef',
    wallMs: 1,
    costUsd: null,
    costProvenance: { kind: 'uncaptured', usd: null },
    tokenUsage: { input: 0, output: 0 },
    terminalOutcome: 'succeeded',
    outcome: { holdoutScore, raw: {} },
    splitTag: 'holdout',
  })
}

test('CLI accepts current holdout-only RunRecords', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-gate-cli-'))
  const baselinePath = join(dir, 'baseline.jsonl')
  const candidatePath = join(dir, 'candidate.jsonl')
  const stdoutWrite = process.stdout.write
  const stderrWrite = process.stderr.write
  const output: string[] = []

  try {
    writeFileSync(baselinePath, `${JSON.stringify(currentHoldoutRecord('baseline', 0.5))}\n`)
    writeFileSync(candidatePath, `${JSON.stringify(currentHoldoutRecord('candidate', 0.7))}\n`)
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output.push(String(chunk))
      return true
    }) as typeof process.stdout.write
    process.stderr.write = (() => true) as typeof process.stderr.write

    const exitCode = runGate({
      baselinePath,
      candidatePath,
      baselineKey: 'baseline',
      json: true,
    })

    assert.equal(exitCode, 2)
    assert.match(output.join(''), /missing_split_scores/)
  } finally {
    process.stdout.write = stdoutWrite
    process.stderr.write = stderrWrite
    rmSync(dir, { recursive: true, force: true })
  }
})
