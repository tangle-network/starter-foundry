// withPhiAccess — wraps a PHI-returning handler so an audit row is emitted
// BEFORE the response goes out. Covers §164.312(b) "record and examine
// activity in information systems that contain or use electronic protected
// health information."
//
// Shape is framework-agnostic. Adapters live in the consuming service
// (Express, Fastify, Hono, Next.js route handler, etc.).

import { randomUUID } from 'node:crypto'
import type { AuditAction, AuditStore } from './audit-log.js'

export interface PhiAccessContext {
  actorUserId: string
  actorRole: string
  action: AuditAction
  subjectTable: string
  subjectId: string
  subjectFieldsAccessed: string[]
  requestId?: string
  clientIp?: string
}

/**
 * Wrap a handler so the audit row is written BEFORE the PHI payload leaves
 * the process. If the audit-store write fails, the handler MUST reject the
 * request — a silently-dropped audit row is a §164.312(b) violation.
 */
export function withPhiAccess<T>(
  store: AuditStore,
  context: PhiAccessContext,
  handler: () => Promise<T>,
): Promise<T> {
  return (async () => {
    await store.append({
      actorUserId: context.actorUserId,
      actorRole: context.actorRole,
      action: context.action,
      subjectTable: context.subjectTable,
      subjectId: context.subjectId,
      subjectFieldsAccessed: context.subjectFieldsAccessed,
      requestId: context.requestId ?? randomUUID(),
      clientIp: context.clientIp,
      at: new Date().toISOString(),
    })
    return handler()
  })()
}

/**
 * Minimum-necessary role filter. Given a table of records, returns only the
 * fields the actor's role is permitted to see. Required by §164.502(b).
 */
export type MinimumNecessaryPolicy = Record<string, Record<string, string[]>>

export function filterByMinimumNecessary<T extends Record<string, unknown>>(
  row: T,
  actorRole: string,
  subjectTable: string,
  policy: MinimumNecessaryPolicy,
): Partial<T> {
  const allowed = policy[subjectTable]?.[actorRole] ?? []
  const out: Partial<T> = {}
  for (const field of allowed) {
    if (field in row) (out as Record<string, unknown>)[field] = row[field as keyof T]
  }
  return out
}

/** Example baseline policy — extend per-product. */
export const DEFAULT_PHI_POLICY: MinimumNecessaryPolicy = {
  patients: {
    attending_physician: ['id', 'name', 'dob', 'mrn', 'insurance_plan', 'allergies', 'current_medications'],
    nurse: ['id', 'name', 'dob', 'mrn', 'allergies', 'current_medications'],
    billing: ['id', 'name', 'dob', 'mrn', 'insurance_plan'],
    scheduler: ['id', 'name', 'dob', 'mrn'],
  },
  encounters: {
    attending_physician: ['id', 'patient_id', 'date', 'chief_complaint', 'diagnosis_codes', 'notes'],
    nurse: ['id', 'patient_id', 'date', 'chief_complaint', 'vitals'],
    billing: ['id', 'patient_id', 'date', 'cpt_codes', 'icd10_codes'],
    scheduler: ['id', 'patient_id', 'date'],
  },
}
