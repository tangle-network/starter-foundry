/**
 * RunRecord — typed substrate for every measured run in starter-foundry.
 *
 * One JSONL line per logical run. The schema mirrors the v0.16 agent-eval
 * RunRecord shape so the swap is rename-only:
 *
 *   import { RunRecord, validateRunRecord, makeRunRecord } from '@tangle-network/agent-eval'
 *
 * and `rm src/lib/run-record.ts`.
 *
 * @public
 *
 * Runs are appended to `.evolve/runs.jsonl` (gitignored). Bare model aliases
 * (`claude-sonnet-4-6` without `@<snapshot>` suffix) are rejected at write
 * time — every emission MUST carry a pinned snapshot from
 * `.evolve/snapshots.lock.json`. The only allowlisted exception is
 * `splitTag === 'historical'` which carries `model: '<alias>@unknown-historical'`
 * for runs migrated from pre-Gen-17 experiments.
 */

import { execSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'

const HISTORICAL_SNAPSHOT_SENTINEL = 'unknown-historical'

export interface RunRecordOutcome {
  searchScore: number
  holdoutScore?: number
  raw: Record<string, number | boolean>
}

export interface RunRecordTokenUsage {
  input: number
  output: number
}

export type RunRecordSplitTag = 'search' | 'holdout' | 'historical'
export type RunRecordSource = 'foundry' | 'vb'

export interface RunRecord {
  /** Unique run id — `crypto.randomUUID()` unless dedup'd from content hash. */
  runId: string
  /** Logical experiment grouping (e.g. generation slug). */
  experimentId: string
  /** Identifies the variant under test. */
  candidateId: string
  /** RNG seed for reproducibility. */
  seed: number
  /**
   * Model identifier. MUST be `<alias>@<snapshot>` form (e.g.
   * `claude-sonnet-4-6@claude-sonnet-4-5-20250929`). The validator rejects
   * bare aliases at write time. The CI bare-alias scan rejects them again
   * post-hoc as a defense-in-depth check.
   */
  model: string
  /** sha256 of the effective prompt. */
  promptHash: string
  /** sha256 of the role config. */
  configHash: string
  /** `git rev-parse HEAD` at run start. */
  commitSha: string
  wallMs: number
  /** USD cost computed from token usage × model rate. */
  costUsd: number
  tokenUsage: RunRecordTokenUsage
  outcome: RunRecordOutcome
  splitTag: RunRecordSplitTag
  /** Failure-mode taxonomy key (first failing stage); omit on success. */
  failureMode?: string
  /** Verticalbench coupling — distinguishes foundry-internal vs vb-feedback runs. */
  source: RunRecordSource
}

export interface MakeRunRecordInput {
  experimentId: string
  candidateId: string
  seed: number
  model: string
  promptHash: string
  configHash: string
  wallMs: number
  costUsd: number
  tokenUsage: RunRecordTokenUsage
  outcome: RunRecordOutcome
  splitTag: RunRecordSplitTag
  source: RunRecordSource
  failureMode?: string
  /** Override commitSha — mainly for tests. Defaults to live `git rev-parse HEAD`. */
  commitSha?: string
  /** Override runId — mainly for content-hash dedup. Defaults to `randomUUID()`. */
  runId?: string
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
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

/** Reset the cached HEAD sha. Test-only. */
export function _resetCommitShaCache(): void {
  cachedHeadSha = null
}

/**
 * Validate that `model` is in `<alias>@<snapshot>` form, except for
 * historical migrations which carry the sentinel snapshot.
 */
export function isPinnedModel(model: string, splitTag?: RunRecordSplitTag): boolean {
  if (typeof model !== 'string' || !model.includes('@')) return false
  const [alias, snapshot] = model.split('@')
  if (!alias || !snapshot) return false
  if (snapshot === HISTORICAL_SNAPSHOT_SENTINEL) return splitTag === 'historical'
  return true
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export class RunRecordValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`RunRecord validation failed: ${issues.join('; ')}`)
    this.name = 'RunRecordValidationError'
  }
}

/**
 * Validate an unknown payload as a RunRecord. Throws RunRecordValidationError
 * on failure with the full list of issues. Returns the typed record on success.
 */
export function validateRunRecord(input: unknown): RunRecord {
  const issues: string[] = []
  if (!isStringRecord(input)) {
    throw new RunRecordValidationError(['root must be an object'])
  }
  const record = input

  if (!isNonEmptyString(record.runId)) issues.push('runId must be non-empty string')
  if (!isNonEmptyString(record.experimentId)) issues.push('experimentId must be non-empty string')
  if (!isNonEmptyString(record.candidateId)) issues.push('candidateId must be non-empty string')
  if (!Number.isInteger(record.seed)) issues.push('seed must be integer')
  if (!isNonEmptyString(record.model)) issues.push('model must be non-empty string')
  if (!isNonEmptyString(record.promptHash)) issues.push('promptHash must be non-empty string')
  if (!isNonEmptyString(record.configHash)) issues.push('configHash must be non-empty string')
  if (!isNonEmptyString(record.commitSha)) issues.push('commitSha must be non-empty string')
  if (!isFiniteNumber(record.wallMs) || record.wallMs < 0) issues.push('wallMs must be non-negative number')
  if (!isFiniteNumber(record.costUsd) || record.costUsd < 0) issues.push('costUsd must be non-negative number')

  const tokenUsage = record.tokenUsage
  if (!isStringRecord(tokenUsage)) {
    issues.push('tokenUsage must be object with input + output')
  } else {
    if (!Number.isInteger(tokenUsage.input)) issues.push('tokenUsage.input must be integer')
    if (!Number.isInteger(tokenUsage.output)) issues.push('tokenUsage.output must be integer')
  }

  const outcome = record.outcome
  if (!isStringRecord(outcome)) {
    issues.push('outcome must be object')
  } else {
    if (!isFiniteNumber(outcome.searchScore)) issues.push('outcome.searchScore must be number')
    const holdoutScore = outcome.holdoutScore
    if (holdoutScore !== undefined && !isFiniteNumber(holdoutScore)) issues.push('outcome.holdoutScore must be number when present')
    const raw = outcome.raw
    if (!isStringRecord(raw)) {
      issues.push('outcome.raw must be object')
    } else {
      for (const [k, v] of Object.entries(raw)) {
        if (!isFiniteNumber(v) && !isBoolean(v)) issues.push(`outcome.raw.${k} must be number or boolean`)
      }
    }
  }

  const splitTag = record.splitTag
  const splitTagValid = splitTag === 'search' || splitTag === 'holdout' || splitTag === 'historical'
  if (!splitTagValid) {
    issues.push("splitTag must be 'search' | 'holdout' | 'historical'")
  }

  const source = record.source
  if (source !== 'foundry' && source !== 'vb') {
    issues.push("source must be 'foundry' | 'vb'")
  }

  if (record.failureMode !== undefined && !isNonEmptyString(record.failureMode)) {
    issues.push('failureMode must be non-empty string when present')
  }

  const splitTagForCheck: RunRecordSplitTag | undefined = splitTagValid ? splitTag : undefined
  if (isNonEmptyString(record.model) && !isPinnedModel(record.model, splitTagForCheck)) {
    issues.push(
      `model "${record.model}" is not pinned — must be <alias>@<snapshot> form ` +
      `(historical entries may use @${HISTORICAL_SNAPSHOT_SENTINEL})`,
    )
  }

  if (issues.length > 0) throw new RunRecordValidationError(issues)
  return record as unknown as RunRecord
}

/**
 * Build a RunRecord. Fills `runId` (random) + `commitSha` (live git HEAD)
 * unless overridden. Validates before returning, so a bad input here throws.
 */
export function makeRunRecord(input: MakeRunRecordInput): RunRecord {
  const record: RunRecord = {
    runId: input.runId ?? randomUUID(),
    experimentId: input.experimentId,
    candidateId: input.candidateId,
    seed: input.seed,
    model: input.model,
    promptHash: input.promptHash,
    configHash: input.configHash,
    commitSha: input.commitSha ?? readHeadSha(),
    wallMs: input.wallMs,
    costUsd: input.costUsd,
    tokenUsage: { input: input.tokenUsage.input, output: input.tokenUsage.output },
    outcome: {
      searchScore: input.outcome.searchScore,
      raw: { ...input.outcome.raw },
      ...(input.outcome.holdoutScore !== undefined ? { holdoutScore: input.outcome.holdoutScore } : {}),
    },
    splitTag: input.splitTag,
    source: input.source,
    ...(input.failureMode !== undefined ? { failureMode: input.failureMode } : {}),
  }
  return validateRunRecord(record)
}

export const HISTORICAL_SNAPSHOT = HISTORICAL_SNAPSHOT_SENTINEL
