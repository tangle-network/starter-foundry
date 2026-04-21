// SOC2 Type II audit log. Append-only. Every state-changing action (deploy,
// config change, user role grant, PII export) emits one row.
// Covers CC7.2 (monitoring), CC8.1 (change management).

export type SocAction =
  | 'deploy'
  | 'config.change'
  | 'role.grant'
  | 'role.revoke'
  | 'pii.export'
  | 'incident.open'
  | 'incident.close'
  | 'vendor.change'

export interface SocAuditEntry {
  id?: string
  at: string
  actor: string
  action: SocAction
  target: string
  before?: unknown
  after?: unknown
  reason?: string
  /** Required for CC8.1 change-management — who approved this change. */
  approvedBy?: string[]
}

export interface SocAuditStore {
  append(entry: SocAuditEntry): Promise<void>
  list(filter?: { actor?: string; action?: SocAction; since?: string }): Promise<SocAuditEntry[]>
}

export class InMemorySocAuditStore implements SocAuditStore {
  private entries: SocAuditEntry[] = []
  async append(entry: SocAuditEntry): Promise<void> {
    this.entries.push({ ...entry, id: entry.id ?? crypto.randomUUID() })
  }
  async list(filter?: Parameters<SocAuditStore['list']>[0]): Promise<SocAuditEntry[]> {
    return this.entries.filter((e) => {
      if (filter?.actor && e.actor !== filter.actor) return false
      if (filter?.action && e.action !== filter.action) return false
      if (filter?.since && e.at < filter.since) return false
      return true
    })
  }
}
