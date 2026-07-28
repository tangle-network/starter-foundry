/**
 * Emit a canonical agent-eval RunRecord at the close of a measured run.
 *
 * @public
 */

import { execSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'

import {
  validateRunRecord,
  type RunCostProvenance,
  type RunOutcome,
  type RunRecord,
  type RunSplitTag,
  type RunTerminalOutcome,
  type RunTokenUsage,
} from '@tangle-network/agent-eval'

import { loadProfile } from '../profile-loader.js'
import { appendRunRecord, RUNS_JSONL_PATH } from '../run-record-store.js'

export interface EmitRunRecordInput {
  experimentId: string
  scenarioId: string
  candidateId: string
  /** Profile name to source the pinned model from. */
  profile: string
  seed?: number
  promptText: string
  configObject: unknown
  wallMs: number
  costUsd: number | null
  costProvenance: RunCostProvenance
  tokenUsage: RunTokenUsage
  terminalOutcome: RunTerminalOutcome
  outcome: RunOutcome
  splitTag: RunSplitTag
  failureClass?: RunRecord['failureClass']
  terminalFailureReason?: string
  /** Override the destination jsonl path. Default `.evolve/runs.jsonl`. */
  outPath?: string
  /**
   * Bypass snapshot resolution for tests and pre-apply workflows.
   * The profile loader still emits an explicit `@unresolved` model.
   */
  skipSnapshotResolve?: boolean
}

let cachedHeadSha: string | null = null

function readHeadSha(): string {
  if (cachedHeadSha !== null) return cachedHeadSha
  try {
    cachedHeadSha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    cachedHeadSha = 'unknown'
  }
  return cachedHeadSha
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export function emitRunRecord(input: EmitRunRecordInput): RunRecord {
  const profile = loadProfile(input.profile, { skipSnapshotResolve: input.skipSnapshotResolve })
  const record: RunRecord = {
    runId: randomUUID(),
    experimentId: input.experimentId,
    scenarioId: input.scenarioId,
    candidateId: input.candidateId,
    seed: input.seed ?? 0,
    model: profile.model,
    promptHash: sha256(input.promptText),
    configHash: sha256(JSON.stringify(input.configObject)),
    commitSha: readHeadSha(),
    wallMs: input.wallMs,
    costUsd: input.costUsd,
    costProvenance: input.costProvenance,
    tokenUsage: { ...input.tokenUsage },
    terminalOutcome: input.terminalOutcome,
    outcome: {
      ...input.outcome,
      raw: { ...input.outcome.raw },
    },
    splitTag: input.splitTag,
    ...(input.failureClass !== undefined ? { failureClass: input.failureClass } : {}),
    ...(input.terminalFailureReason !== undefined
      ? { terminalFailureReason: input.terminalFailureReason }
      : {}),
  }
  const validated = validateRunRecord(record)
  appendRunRecord(validated, input.outPath ?? RUNS_JSONL_PATH)
  return validated
}
