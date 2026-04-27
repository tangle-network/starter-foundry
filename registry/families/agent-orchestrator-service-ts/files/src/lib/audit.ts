// Audit log — append-only structured event stream. Default sink is the
// filesystem (newline-delimited JSON). Replace `sink` with an S3/Postgres
// writer for production multi-instance deploys; the rest of the code only
// depends on `audit.log()`.

import { appendFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export interface AuditEvent {
  /** Dotted event name. Examples: chat.accept, chat.reject, route.decide,
   *  webhook.in.reject, rate-limit.exceeded. */
  event: string
  /** Stable target identifier — agent id, route id, webhook path. */
  target?: string
  /** Tenant API-key fingerprint (NOT the raw key). */
  tenantFingerprint?: string
  /** Free-form structured payload. Truncated to 4 KB on serialize. */
  payload?: Record<string, unknown>
}

const DEFAULT_AUDIT_PATH = resolve(process.cwd(), '.audit/orchestrator.ndjson')
const auditPath = process.env['ORCHESTRATOR_AUDIT_PATH'] ?? DEFAULT_AUDIT_PATH

let dirEnsured = false

async function ensureDir(): Promise<void> {
  if (dirEnsured) return
  await mkdir(dirname(auditPath), { recursive: true })
  dirEnsured = true
}

function safeStringify(value: unknown): string {
  try {
    const s = JSON.stringify(value)
    return s.length > 4096 ? `${s.slice(0, 4093)}...` : s
  } catch {
    return '"[unserializable]"'
  }
}

export const audit = {
  async log(ev: AuditEvent): Promise<void> {
    const line =
      JSON.stringify({
        ts: new Date().toISOString(),
        event: ev.event,
        target: ev.target,
        tenantFingerprint: ev.tenantFingerprint,
        payload: ev.payload ? JSON.parse(safeStringify(ev.payload)) : undefined,
      }) + '\n'
    try {
      await ensureDir()
      await appendFile(auditPath, line, 'utf8')
    } catch (err) {
      // Audit write must NEVER throw into the request path. Log and move on.
      // If the operator cares about durability, swap the sink — see header.
      // eslint-disable-next-line no-console
      console.error(`[audit] write failed: ${(err as Error).message}`)
    }
  },
}

/** Stable fingerprint for an API key — first 8 chars of SHA-256 hex.
 *  Audit logs MUST NOT contain the raw key; this gives the operator
 *  enough to correlate events to a key without leaking it. */
export async function fingerprintKey(rawKey: string): Promise<string> {
  const enc = new TextEncoder().encode(rawKey)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hex.slice(0, 8)
}
