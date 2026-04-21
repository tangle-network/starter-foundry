// Legal practice-management schema. Matter-centric: every document, party,
// time entry, and invoice belongs to a Matter. Documents are content-addressed
// (immutable); time entries are immutable once invoiced.
import { pgTable, uuid, varchar, timestamp, integer, jsonb, text, boolean, numeric, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

export const matterStatusEnum = pgEnum('matter_status', ['open', 'closed', 'archived'])
export const partyRoleEnum = pgEnum('party_role', ['client', 'opposing', 'witness', 'counsel', 'other'])
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'paid', 'void'])

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: varchar('display_name', { length: 200 }).notNull(),
  email: varchar('email', { length: 254 }),
  billingAddress: jsonb('billing_address').$type<Record<string, string>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const attorneys = pgTable('attorneys', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: varchar('display_name', { length: 200 }).notNull(),
  email: varchar('email', { length: 254 }).notNull().unique(),
  barNumber: varchar('bar_number', { length: 64 }),
  jurisdiction: varchar('jurisdiction', { length: 8 }), // e.g. "CA", "NY"
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const matters = pgTable(
  'matters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'restrict' }),
    matterNumber: varchar('matter_number', { length: 64 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    practiceArea: varchar('practice_area', { length: 64 }),
    status: matterStatusEnum('status').notNull().default('open'),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => ({
    matterNumberUniq: uniqueIndex('matters_matter_number_uniq').on(t.matterNumber),
    clientIdx: index('matters_client_idx').on(t.clientId),
  }),
)

export const parties = pgTable('parties', {
  id: uuid('id').primaryKey().defaultRandom(),
  matterId: uuid('matter_id').notNull().references(() => matters.id, { onDelete: 'cascade' }),
  role: partyRoleEnum('role').notNull(),
  name: varchar('name', { length: 300 }).notNull(),
  contact: jsonb('contact').$type<Record<string, string>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matterId: uuid('matter_id').notNull().references(() => matters.id, { onDelete: 'restrict' }),
    // Content address: sha256 of the file bytes, hex-encoded. Collision = identity.
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    uri: text('uri').notNull(), // s3://... or file://... — WHERE the bytes live
    filename: varchar('filename', { length: 500 }).notNull(),
    mimeType: varchar('mime_type', { length: 128 }),
    sizeBytes: integer('size_bytes'),
    uploadedByAttorneyId: uuid('uploaded_by').references(() => attorneys.id),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    matterHashUniq: uniqueIndex('documents_matter_hash_uniq').on(t.matterId, t.contentHash),
    matterIdx: index('documents_matter_idx').on(t.matterId),
  }),
)

export const billingRates = pgTable(
  'billing_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attorneyId: uuid('attorney_id').notNull().references(() => attorneys.id, { onDelete: 'restrict' }),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
    // Integer cents to avoid floats entirely at the storage layer.
    hourlyRateCents: integer('hourly_rate_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  },
  (t) => ({
    attorneyEffective: index('billing_rates_attorney_eff_idx').on(t.attorneyId, t.effectiveAt),
  }),
)

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matterId: uuid('matter_id').notNull().references(() => matters.id, { onDelete: 'restrict' }),
    clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'restrict' }),
    invoiceNumber: varchar('invoice_number', { length: 64 }).notNull(),
    status: invoiceStatusEnum('status').notNull().default('draft'),
    // Totals as NUMERIC for accurate display; integer cents is computed from entries.
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ invoiceNumberUniq: uniqueIndex('invoices_number_uniq').on(t.invoiceNumber) }),
)

export const timeEntries = pgTable(
  'time_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matterId: uuid('matter_id').notNull().references(() => matters.id, { onDelete: 'restrict' }),
    attorneyId: uuid('attorney_id').notNull().references(() => attorneys.id, { onDelete: 'restrict' }),
    workedAt: timestamp('worked_at', { withTimezone: true }).notNull(),
    // Integer minutes. Firms that bill in 6-minute increments round at invoice time, not here.
    minutes: integer('minutes').notNull(),
    narrative: text('narrative').notNull(),
    billable: boolean('billable').notNull().default(true),
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    matterWorkedIdx: index('time_entries_matter_worked_idx').on(t.matterId, t.workedAt),
    attorneyWorkedIdx: index('time_entries_attorney_worked_idx').on(t.attorneyId, t.workedAt),
    unbilledIdx: index('time_entries_unbilled_idx').on(t.matterId).where(sql`invoice_id IS NULL`),
  }),
)

export const mattersRelations = relations(matters, ({ many, one }) => ({
  client: one(clients, { fields: [matters.clientId], references: [clients.id] }),
  parties: many(parties),
  documents: many(documents),
  timeEntries: many(timeEntries),
  invoices: many(invoices),
}))

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  matter: one(matters, { fields: [timeEntries.matterId], references: [matters.id] }),
  attorney: one(attorneys, { fields: [timeEntries.attorneyId], references: [attorneys.id] }),
  invoice: one(invoices, { fields: [timeEntries.invoiceId], references: [invoices.id] }),
}))

export type Matter = typeof matters.$inferSelect
export type TimeEntry = typeof timeEntries.$inferSelect
export type Invoice = typeof invoices.$inferSelect
export type BillingRate = typeof billingRates.$inferSelect
export type Document = typeof documents.$inferSelect
