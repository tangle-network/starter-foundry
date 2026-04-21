// Append-only audit log with PHI-redacted field enumeration. Every PHI
// read/write emits one row. The row references PHI by (subject_table,
// subject_id) — the audit entry itself contains NO PHI content.

export type AuditAction = 'read' | 'create' | 'update' | 'delete' | 'export' | 'login' | 'logout'

export interface AuditEntry {
  id?: string
  actorUserId: string
  actorRole: string
  action: AuditAction
  subjectTable: string
  subjectId: string
  /** List of PHI field names accessed — NEVER the values. */
  subjectFieldsAccessed: string[]
  requestId?: string
  clientIp?: string
  at: string
}

export interface AuditStore {
  append(entry: AuditEntry): Promise<void>
  /** Required by §164.316(b)(2)(i) — retention ≥6 years. Stores must be append-only at the DB level. */
  list(filter?: {
    actorUserId?: string
    subjectId?: string
    action?: AuditAction
    since?: string
    until?: string
  }): Promise<AuditEntry[]>
}

/** In-memory audit store for testing. Production stores must be append-only + retained ≥6 years. */
export class InMemoryAuditStore implements AuditStore {
  private entries: AuditEntry[] = []

  async append(entry: AuditEntry): Promise<void> {
    this.entries.push({ ...entry, id: entry.id ?? crypto.randomUUID() })
  }

  async list(filter?: Parameters<AuditStore['list']>[0]): Promise<AuditEntry[]> {
    let out = [...this.entries]
    if (filter?.actorUserId) out = out.filter((e) => e.actorUserId === filter.actorUserId)
    if (filter?.subjectId) out = out.filter((e) => e.subjectId === filter.subjectId)
    if (filter?.action) out = out.filter((e) => e.action === filter.action)
    if (filter?.since) out = out.filter((e) => e.at >= filter.since!)
    if (filter?.until) out = out.filter((e) => e.at <= filter.until!)
    return out
  }

  size(): number {
    return this.entries.length
  }
}
