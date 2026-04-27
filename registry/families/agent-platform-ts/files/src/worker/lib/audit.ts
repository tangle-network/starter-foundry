// audit — append-only request log keyed in Cloudflare KV.
//
// KV is the DEFAULT, not the production target. KV's eventual-consistency
// + 1MB-per-key + 30-write-per-second limits make it unsuitable for
// compliance-grade retention. Operators MUST forward off-cluster
// (D1, R2, external SIEM) before going to prod — see docs/SECURITY.md.
//
// The local KV write is a synchronous best-effort; a write failure logs
// to console and does not block the request. Auth/rate-limit decisions
// are made BEFORE audit, so a flaky audit sink can never be exploited
// to bypass policy.

import type { Env } from '../types'
import { AuditEntry } from '../types'

interface AuditInput {
  event: string
  tenantId: string | null
  agentId: string | null
  payload?: Record<string, unknown>
}

let seq = 0

export async function audit(env: Env, input: AuditInput): Promise<void> {
  const ts = new Date().toISOString()
  const entry: AuditEntry = {
    ts,
    event: input.event,
    tenantId: input.tenantId,
    agentId: input.agentId,
    payload: input.payload,
    seq: seq++,
  }

  // Validate the envelope shape — refuse to write malformed entries.
  // A schema-invalid audit log is worse than no audit log: it pretends
  // to record events but silently drops fields the SIEM relies on.
  const parsed = AuditEntry.safeParse(entry)
  if (!parsed.success) {
    console.error('audit: invalid envelope, dropping entry', parsed.error.flatten())
    return
  }

  // Per-day partition key — `audit:YYYY-MM-DD:<seq>`. Lets the operator
  // export-by-day without a list-prefix scan over forever-growing keys.
  const day = ts.slice(0, 10)
  const key = `audit:${day}:${entry.seq.toString().padStart(8, '0')}:${ts}`
  try {
    await env.AUDIT.put(key, JSON.stringify(parsed.data), {
      // 90-day default retention — operator can lower or remove.
      expirationTtl: 90 * 24 * 60 * 60,
      metadata: { event: input.event, tenantId: input.tenantId },
    })
  } catch (err) {
    console.error('audit: KV write failed', err)
  }
}

/** List today's audit entries — used by the admin UI to render a recent
 * activity feed. Caps at the cursor pagesize KV allows; callers should
 * paginate by `cursor` returned in the response. */
export async function listAudit(
  env: Env,
  opts: { day?: string; cursor?: string; limit?: number } = {},
): Promise<{ entries: AuditEntry[]; cursor: string | null }> {
  const day = opts.day ?? new Date().toISOString().slice(0, 10)
  const list = await env.AUDIT.list({
    prefix: `audit:${day}:`,
    cursor: opts.cursor,
    limit: opts.limit ?? 50,
  })
  const entries: AuditEntry[] = []
  for (const k of list.keys) {
    const raw = await env.AUDIT.get(k.name)
    if (!raw) continue
    const parsed = AuditEntry.safeParse(JSON.parse(raw))
    if (parsed.success) entries.push(parsed.data)
  }
  return { entries, cursor: list.list_complete ? null : list.cursor ?? null }
}
