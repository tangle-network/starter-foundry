// audit — append-only signed audit log per agent. Each entry carries a
// monotonic sequence + content-hash chained to the previous entry, so
// tampering is detectable on export.
//
// Threat: an agent author writes code that "forgets" to log a secret
// read. The audit module's API is the only documented way to log;
// secrets/workspace/webhooks/identity all call audit.log() internally.
// Bundles that bypass it are flagged by the secrets-declared validator
// and operator review.

import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface AuditEntry {
  /** Event type, dot-namespaced — secret.read, workspace.write, webhook.in, etc. */
  event: string
  /** What the event acted on — secret name, file path, webhook target. */
  target?: string
  /** Optional event-specific payload. Should NOT include raw secrets. */
  payload?: Record<string, unknown>
  /** Set automatically. */
  ts?: string
  /** Set automatically. */
  seq?: number
  /** Set automatically — sha256 of (prev.hash + this entry sans hash). */
  hash?: string
  /** Set automatically — actor agent id. */
  actor?: string
}

// Read env at call time, not import time. Tests set AGENT_WORKSPACE_ROOT
// per-test; production runtimes set it once at process start. Either way
// the read happens when we actually need the path.
function workspaceRoot(): string {
  return process.env.AGENT_WORKSPACE_ROOT ?? '/workspace'
}

const AUDIT_DIR = '.audit'

interface RotationState {
  date: string
  /** Workspace dir whose state this represents. Cache must invalidate when
   * the dir changes — a different agent / different test fixture has its
   * own chain. */
  dir: string
  seq: number
  prevHash: string
}

let state: RotationState | null = null

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadState(_actor: string, dir: string, today: string): RotationState {
  if (state && state.date === today && state.dir === dir) return state
  const file = join(dir, `${today}.jsonl`)
  if (existsSync(file)) {
    const lines = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean)
    if (lines.length > 0) {
      try {
        const last = JSON.parse(lines[lines.length - 1]!) as AuditEntry
        state = { date: today, dir, seq: (last.seq ?? 0) + 1, prevHash: last.hash ?? '' }
        return state
      } catch {
        /* corrupt last line — start fresh but preserve file */
      }
    }
  }
  state = { date: today, dir, seq: 1, prevHash: '' }
  return state
}

// Canonical-JSON serializer: sorts keys deterministically so the chain
// hash is stable across V8 versions, structuredClone passes, and
// runtime upgrades. Required for verifyDay() to be reliable across hosts.
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']'
  const keys = Object.keys(value as Record<string, unknown>).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize((value as Record<string, unknown>)[k])).join(',') + '}'
}

function hashEntry(entry: Omit<AuditEntry, 'hash'>, prevHash: string): string {
  const canonical = canonicalize({ ...entry, prevHash })
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32)
}

function loadActorAndDir(): { actor: string; dir: string } {
  // Lazy-load identity to avoid import cycle (identity.ts imports audit).
  // Fail-closed: missing identity is a hard error unless SF_DEV_IDENTITY_OPTIN=1.
  // This closes M2 — silently attributing audit entries to 'dev-agent' in
  // misconfigured prod was breaking attribution without anyone noticing.
  const idEnv = process.env.TANGLE_AGENT_IDENTITY_JSON
  let actor: string | undefined
  if (idEnv) {
    try {
      actor = (JSON.parse(idEnv) as { agentId?: string }).agentId
    } catch {
      // Fall through; we'll throw below.
    }
  }
  if (!actor) {
    if (process.env.SF_DEV_IDENTITY_OPTIN === '1') {
      actor = process.env.AGENT_NAME ?? 'dev-agent'
    } else {
      throw new Error(
        'audit: cannot resolve actor — TANGLE_AGENT_IDENTITY_JSON missing or malformed and ' +
          'SF_DEV_IDENTITY_OPTIN!=1. Audit attribution is non-negotiable; refuse to write a log line ' +
          'we cannot attribute correctly.',
      )
    }
  }
  const dir = join(workspaceRoot(), actor, AUDIT_DIR)
  mkdirSync(dir, { recursive: true })
  return { actor, dir }
}

export const audit = {
  log(input: Omit<AuditEntry, 'ts' | 'seq' | 'hash' | 'actor'>): void {
    const { actor, dir } = loadActorAndDir()
    const today = dateStamp()
    const s = loadState(actor, dir, today)
    const entry: AuditEntry = {
      ts: new Date().toISOString(),
      seq: s.seq,
      actor,
      ...input,
    }
    const hash = hashEntry(entry, s.prevHash)
    entry.hash = hash
    appendFileSync(join(dir, `${today}.jsonl`), JSON.stringify(entry) + '\n')
    s.seq++
    s.prevHash = hash
  },

  /** TEST-ONLY — reset internal rotation state so a new test fixture
   * sees a fresh starting state. Production code MUST NOT call this; it
   * would silently break chain continuity. */
  _resetStateForTest(): void {
    state = null
  },

  /** Verify chain integrity over a given day's log. Returns the first
   * tampered entry's seq (or null if the chain is intact). */
  verifyDay(date: string): { ok: boolean; tamperedAtSeq?: number } {
    const { dir } = loadActorAndDir()
    const file = join(dir, `${date}.jsonl`)
    if (!existsSync(file)) return { ok: true }
    const lines = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean)
    let prevHash = ''
    for (const l of lines) {
      const entry = JSON.parse(l) as AuditEntry
      // Reconstruct exactly the shape log() hashed: take the entry, drop
      // hash, hash the rest with prevHash. This matches the log path's
      // spread semantics (undefined payload omitted, not explicit-undefined).
      const { hash: storedHash, ...rest } = entry
      const expected = hashEntry(rest, prevHash)
      if (expected !== storedHash) return { ok: false, tamperedAtSeq: entry.seq }
      prevHash = storedHash ?? ''
    }
    return { ok: true }
  },
}
