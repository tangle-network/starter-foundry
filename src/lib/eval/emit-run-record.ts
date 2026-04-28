/**
 * Emit a RunRecord at the close of any measured run. Pulls model + cost
 * ceiling from the role profile; computes prompt+config hashes; writes
 * atomically to `.evolve/runs.jsonl`.
 *
 * Used by:
 *   - `pnpm audit` (CLI subcommand)
 *   - `scripts/auto-loop.ts` (per-promote attempt)
 *   - `scripts/propose-*.ts` (per-proposal attempt)
 *   - `scripts/agent-eval-scaffold.ts` (per scenario × variant)
 *
 * @public
 */

import { loadProfile } from '../profile-loader.js'
import {
  makeRunRecord,
  sha256,
  type RunRecord,
  type RunRecordOutcome,
  type RunRecordSource,
  type RunRecordSplitTag,
  type RunRecordTokenUsage,
} from '../run-record.js'
import { appendRunRecord, RUNS_JSONL_PATH } from '../run-record-store.js'

export interface EmitRunRecordInput {
  experimentId: string
  candidateId: string
  /** Profile name to source model + cost ceiling from. */
  profile: string
  seed?: number
  promptText: string
  configObject: unknown
  wallMs: number
  costUsd: number
  tokenUsage: RunRecordTokenUsage
  outcome: RunRecordOutcome
  splitTag?: RunRecordSplitTag
  source?: RunRecordSource
  failureMode?: string
  /** Override the destination jsonl path. Default `.evolve/runs.jsonl`. */
  outPath?: string
  /**
   * Bypass snapshot resolution — used in tests and pre-`--apply` workflows.
   * In production, leave unset so the lock is enforced.
   */
  skipSnapshotResolve?: boolean
}

export function emitRunRecord(input: EmitRunRecordInput): RunRecord {
  const profile = loadProfile(input.profile, { skipSnapshotResolve: input.skipSnapshotResolve })
  const record = makeRunRecord({
    experimentId: input.experimentId,
    candidateId: input.candidateId,
    seed: input.seed ?? 0,
    model: profile.model,
    promptHash: sha256(input.promptText),
    configHash: sha256(JSON.stringify(input.configObject)),
    wallMs: input.wallMs,
    costUsd: input.costUsd,
    tokenUsage: input.tokenUsage,
    outcome: input.outcome,
    splitTag: input.splitTag ?? 'search',
    source: input.source ?? 'foundry',
    ...(input.failureMode ? { failureMode: input.failureMode } : {}),
  })
  appendRunRecord(record, input.outPath ?? RUNS_JSONL_PATH)
  return record
}
