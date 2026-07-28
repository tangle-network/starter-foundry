import assert from 'node:assert/strict'
import test from 'node:test'

import {
  RunRecordValidationError as AgentEvalRunRecordValidationError,
  validateRunRecord as agentEvalValidateRunRecord,
} from '@tangle-network/agent-eval'

import { RunRecordValidationError, validateRunRecord } from '../dist/lib/index.js'

const CURRENT_HOLDOUT_RECORD = {
  runId: '00000000-0000-4000-8000-000000000001',
  experimentId: 'audit/current-contract',
  scenarioId: 'scenario-1',
  candidateId: 'candidate',
  seed: 0,
  model: 'claude-sonnet-4-6@2025-09-29',
  promptHash: 'a'.repeat(64),
  configHash: 'b'.repeat(64),
  commitSha: 'deadbeef',
  wallMs: 12,
  costUsd: null,
  costProvenance: { kind: 'uncaptured' as const, usd: null },
  tokenUsage: { input: 10, output: 20 },
  terminalOutcome: 'succeeded' as const,
  outcome: { holdoutScore: 0.8, raw: {} },
  splitTag: 'holdout' as const,
}

test('public validation is the current agent-eval validator', () => {
  assert.equal(validateRunRecord, agentEvalValidateRunRecord)
  assert.equal(RunRecordValidationError, AgentEvalRunRecordValidationError)
})

test('accepts a current holdout-only RunRecord without stale source or searchScore fields', () => {
  const record = validateRunRecord(CURRENT_HOLDOUT_RECORD)

  assert.equal(record.scenarioId, 'scenario-1')
  assert.equal(record.outcome.searchScore, undefined)
  assert.equal(record.outcome.holdoutScore, 0.8)
  assert.equal(record.costProvenance.kind, 'uncaptured')
})

test('rejects a record without the current scenario identity', () => {
  const { scenarioId: _scenarioId, ...invalid } = CURRENT_HOLDOUT_RECORD

  assert.throws(
    () => validateRunRecord(invalid),
    (error: unknown) =>
      error instanceof RunRecordValidationError && error.message.includes('scenarioId'),
  )
})
