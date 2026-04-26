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

const WORKSPACE_ROOT = process.env.AGENT_WORKSPACE_ROOT ?? '/workspace'
const AUDIT_DIR = '.audit'

interface RotationState {
  date: string
  seq: number
  prevHash: string
}

let state: RotationState | null = null

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadState(actor: string, dir: string, today: string): RotationState {
  if (state && state.date === today) return state
  const file = join(dir, `${today}.jsonl`)
  if (existsSync(file)) {
    const lines = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean)
    if (lines.length > 0) {
      try {
        const last = JSON.parse(lines[lines.length - 1]!) as AuditEntry
        state = { date: today, seq: (last.seq ?? 0) + 1, prevHash: last.hash ?? '' }
        return state
      } catch {
        /* corrupt last line — start fresh but preserve file */
      }
    }
  }
  state = { date: today, seq: 1, prevHash: '' }
  return state
}

function hashEntry(entry: Omit<AuditEntry, 'hash'>, prevHash: string): string {
  const canonical = JSON.stringify({ ...entry, prevHash })
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32)
}

function loadActorAndDir(): { actor: string; dir: string } {
  // Lazy-load identity to avoid import cycle (identity.ts imports audit).
  const idEnv = process.env.TANGLE_AGENT_IDENTITY_JSON
  let actor = 'dev-agent'
  if (idEnv) {
    try {
      actor = (JSON.parse(idEnv) as { agentId?: string }).agentId ?? actor
    } catch {
      /* keep default */
    }
  } else if (process.env.AGENT_NAME) {
    actor = process.env.AGENT_NAME
  }
  const dir = join(WORKSPACE_ROOT, actor, AUDIT_DIR)
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
      const expected = hashEntry({ ts: entry.ts, seq: entry.seq, actor: entry.actor, event: entry.event, target: entry.target, payload: entry.payload }, prevHash)
      if (expected !== entry.hash) return { ok: false, tamperedAtSeq: entry.seq }
      prevHash = entry.hash ?? ''
    }
    return { ok: true }
  },
}
