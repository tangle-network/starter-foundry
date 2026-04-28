#!/usr/bin/env node
/**
 * One-shot migration: read `.evolve/experiments.jsonl` (and `governor.jsonl`
 * as a fallback when experiments.jsonl is absent), emit synthetic RunRecords
 * with `splitTag: 'historical'` to `.evolve/runs.jsonl`. Idempotent: re-runs
 * dedup on a content-derived `runId`.
 *
 * Historical entries carry `model: '<alias>@unknown-historical'` which is
 * allowlisted by the bare-alias check ONLY for splitTag === 'historical'.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'

import { makeRunRecord, sha256, type RunRecord } from '../src/lib/run-record.js'
import { appendRunRecord, readRunRecords } from '../src/lib/run-record-store.js'

const CWD = process.cwd()
const EXPERIMENTS_PATH = resolvePath(CWD, '.evolve', 'experiments.jsonl')
const GOVERNOR_PATH = resolvePath(CWD, '.evolve', 'governor.jsonl')
// Migration always writes RELATIVE TO CWD so a test can sandbox it.
const RUNS_PATH = resolvePath(CWD, '.evolve', 'runs.jsonl')

function deriveRunId(payload: Record<string, unknown>, source: string, line: number): string {
  // Stable content hash so re-runs dedup. Include source+line to disambiguate
  // identical payloads at different positions.
  return sha256(`${source}:${line}:${JSON.stringify(payload)}`)
}

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return 0
}

function migrateExperimentLine(payload: Record<string, unknown>, line: number): RunRecord | null {
  // experiments.jsonl shape varies by generation; we extract the common
  // fields conservatively and stash the rest into outcome.raw.
  const generation = String(payload.generation ?? payload.gen ?? 'unknown')
  const slug = String(payload.slug ?? payload.experiment ?? payload.id ?? 'historical')
  const promptHash = sha256(String(payload.promptHash ?? payload.prompt ?? slug))
  const configHash = sha256(JSON.stringify(payload.config ?? {}))
  const wallMs = toFiniteNumber(payload.wallMs ?? payload.durationMs)
  const costUsd = toFiniteNumber(payload.costUsd ?? payload.cost)
  const inputTokens = toFiniteNumber(payload.inputTokens ?? 0)
  const outputTokens = toFiniteNumber(payload.outputTokens ?? 0)
  const score = toFiniteNumber(payload.score ?? payload.searchScore ?? payload.passRate ?? 0)

  const raw: Record<string, number | boolean> = {}
  for (const [k, v] of Object.entries(payload)) {
    if (typeof v === 'number') raw[`legacy_${k}`] = v
    else if (typeof v === 'boolean') raw[`legacy_${k}`] = v
  }

  return makeRunRecord({
    runId: deriveRunId(payload, 'experiments', line),
    experimentId: generation,
    candidateId: slug,
    seed: 0,
    model: 'claude-sonnet-4-6@unknown-historical',
    promptHash,
    configHash,
    wallMs,
    costUsd,
    tokenUsage: { input: Math.round(inputTokens), output: Math.round(outputTokens) },
    outcome: { searchScore: score, raw },
    splitTag: 'historical',
    source: 'foundry',
  })
}

function migrateGovernorLine(payload: Record<string, unknown>, line: number): RunRecord | null {
  // governor.jsonl: each line records a decision (skill dispatch). Map to a
  // synthetic run with score = decision-confidence if present, else 0.5.
  const decision = String(payload.decision ?? payload.skill ?? payload.action ?? 'unknown')
  const ts = String(payload.ts ?? payload.timestamp ?? 'unknown')
  const score = toFiniteNumber(payload.confidence ?? payload.score ?? 0.5)
  const raw: Record<string, number | boolean> = {}
  for (const [k, v] of Object.entries(payload)) {
    if (typeof v === 'number') raw[`legacy_${k}`] = v
    else if (typeof v === 'boolean') raw[`legacy_${k}`] = v
  }
  return makeRunRecord({
    runId: deriveRunId(payload, 'governor', line),
    experimentId: `governor/${decision}`,
    candidateId: ts,
    seed: 0,
    model: 'claude-sonnet-4-6@unknown-historical',
    promptHash: sha256(ts),
    configHash: sha256(decision),
    wallMs: toFiniteNumber(payload.wallMs),
    costUsd: 0,
    tokenUsage: { input: 0, output: 0 },
    outcome: { searchScore: score, raw },
    splitTag: 'historical',
    source: 'foundry',
  })
}

function main(): void {
  const existingIds = new Set(readRunRecords(RUNS_PATH).map((r) => r.runId))
  let appended = 0
  let skipped = 0
  let scanned = 0

  if (existsSync(EXPERIMENTS_PATH)) {
    const lines = readFileSync(EXPERIMENTS_PATH, 'utf8').split('\n').filter((l) => l.trim().length > 0)
    for (let i = 0; i < lines.length; i += 1) {
      scanned += 1
      let payload: Record<string, unknown>
      try {
        payload = JSON.parse(lines[i]) as Record<string, unknown>
      } catch {
        continue
      }
      const record = migrateExperimentLine(payload, i)
      if (record === null) continue
      if (existingIds.has(record.runId)) {
        skipped += 1
        continue
      }
      appendRunRecord(record, RUNS_PATH)
      existingIds.add(record.runId)
      appended += 1
    }
  }

  if (existsSync(GOVERNOR_PATH)) {
    const lines = readFileSync(GOVERNOR_PATH, 'utf8').split('\n').filter((l) => l.trim().length > 0)
    for (let i = 0; i < lines.length; i += 1) {
      scanned += 1
      let payload: Record<string, unknown>
      try {
        payload = JSON.parse(lines[i]) as Record<string, unknown>
      } catch {
        continue
      }
      const record = migrateGovernorLine(payload, i)
      if (record === null) continue
      if (existingIds.has(record.runId)) {
        skipped += 1
        continue
      }
      appendRunRecord(record, RUNS_PATH)
      existingIds.add(record.runId)
      appended += 1
    }
  }

  console.log(JSON.stringify({ scanned, appended, skipped, runsPath: RUNS_PATH }, null, 2))
}

main()
