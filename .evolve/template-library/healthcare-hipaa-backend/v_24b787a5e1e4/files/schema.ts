// Healthcare HIPAA-aligned schema. Every column that can contain PHI is
// declared `encrypted` (bytea) and must be written via src/encryption.ts —
// there is intentionally no plaintext PHI column.
//
// Append-only invariant on audit_logs is enforced by the migration in
// drizzle/0001_auditlog_append_only.sql (trigger that raises on UPDATE/DELETE).
import { pgTable, uuid, varchar, timestamp, jsonb, text, integer, customType } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Custom type for AES-256-GCM payload: { iv, tag, ciphertext } encoded as a
// single bytea. src/encryption.ts owns the wire format.
const encrypted = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
})

export const providers = pgTable('providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  npi: varchar('npi', { length: 10 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  specialty: varchar('specialty', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Medical Record Number — internal identifier, not PHI by itself but treat as sensitive.
  mrn: varchar('mrn', { length: 50 }).notNull().unique(),
  // Below are PHI. Encrypted at rest via AES-256-GCM.
  encryptedName: encrypted('encrypted_name').notNull(),
  encryptedDob: encrypted('encrypted_dob').notNull(),
  encryptedSsn: encrypted('encrypted_ssn'),
  sex: varchar('sex', { length: 1 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const encounters = pgTable('encounters', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'restrict' }),
  providerId: uuid('provider_id').notNull().references(() => providers.id, { onDelete: 'restrict' }),
  encounteredAt: timestamp('encountered_at', { withTimezone: true }).notNull(),
  // Free-text clinical notes — PHI, encrypted.
  encryptedNotes: encrypted('encrypted_notes'),
  cptCode: varchar('cpt_code', { length: 5 }),
  icd10Codes: jsonb('icd10_codes').$type<string[]>().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Append-only audit log. Every read of PHI writes a row here BEFORE the
 * response is sent. UPDATE and DELETE are blocked by a database trigger
 * (see drizzle/0001_auditlog_append_only.sql — generate with db:generate).
 */
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: varchar('actor_id', { length: 128 }).notNull(),
  actorRole: varchar('actor_role', { length: 64 }).notNull(),
  action: varchar('action', { length: 32 }).notNull(), // 'read' | 'create' | 'update'
  resourceType: varchar('resource_type', { length: 32 }).notNull(),
  resourceId: uuid('resource_id'),
  // Free-text justification — required under HIPAA minimum-necessary rule.
  reason: text('reason'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
})

export const patientsRelations = relations(patients, ({ many }) => ({
  encounters: many(encounters),
}))

export const encountersRelations = relations(encounters, ({ one }) => ({
  patient: one(patients, { fields: [encounters.patientId], references: [patients.id] }),
  provider: one(providers, { fields: [encounters.providerId], references: [providers.id] }),
}))

export type Patient = typeof patients.$inferSelect
export type NewPatient = typeof patients.$inferInsert
export type Provider = typeof providers.$inferSelect
export type Encounter = typeof encounters.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
