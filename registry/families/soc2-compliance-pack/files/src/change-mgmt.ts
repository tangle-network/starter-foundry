// Change-management surface for SOC2 CC8.1. Every production-affecting
// change MUST be recorded with ≥1 approver. Rejected = no approvers.

import type { SocAuditStore } from './audit.js'

export interface ChangeRequest {
  id: string
  title: string
  description: string
  requester: string
  approvers: string[]
  target: 'infrastructure' | 'application' | 'data' | 'access-policy' | 'vendor'
  requestedAt: string
  executedAt?: string
  rollbackPlan?: string
}

export async function recordChange(
  store: SocAuditStore,
  change: ChangeRequest,
): Promise<void> {
  if (change.approvers.length === 0) {
    throw new Error(`CC8.1 violation: change ${change.id} has no approvers`)
  }
  if (change.approvers.includes(change.requester)) {
    throw new Error(`CC8.1 violation: change ${change.id} self-approved by ${change.requester}`)
  }
  await store.append({
    at: change.executedAt ?? new Date().toISOString(),
    actor: change.requester,
    action: change.target === 'infrastructure' ? 'deploy' : 'config.change',
    target: `${change.target}:${change.title}`,
    approvedBy: change.approvers,
    reason: change.description,
  })
}
