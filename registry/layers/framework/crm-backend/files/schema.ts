// CRM schema. Pipelines + stages are configurable rows, not enums, so users
// can reorder / rename without migrations. Deal stage transitions are logged
// in deal_stage_history so velocity reporting is possible.
import { pgTable, uuid, varchar, timestamp, integer, text, boolean, real, jsonb, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const activityTypeEnum = pgEnum('activity_type', ['call', 'email', 'meeting', 'note', 'task'])
export const dealStatusEnum = pgEnum('deal_status', ['open', 'won', 'lost'])

export const companies = pgTable(
  'companies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 300 }).notNull(),
    domain: varchar('domain', { length: 254 }),
    industry: varchar('industry', { length: 100 }),
    sizeRange: varchar('size_range', { length: 32 }), // "1-10", "11-50", etc.
    website: text('website'),
    ownerUserId: varchar('owner_user_id', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({ domainIdx: index('companies_domain_idx').on(t.domain) }),
)

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    email: varchar('email', { length: 254 }),
    phone: varchar('phone', { length: 32 }),
    title: varchar('title', { length: 200 }),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    ownerUserId: varchar('owner_user_id', { length: 128 }),
    customFields: jsonb('custom_fields').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    emailIdx: index('contacts_email_idx').on(t.email), // NOT unique — multiple contacts may share an email
    companyIdx: index('contacts_company_idx').on(t.companyId),
    ownerIdx: index('contacts_owner_idx').on(t.ownerUserId),
  }),
)

export const pipelines = pgTable('pipelines', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const stages = pgTable(
  'stages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pipelineId: uuid('pipeline_id').notNull().references(() => pipelines.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    order: integer('order').notNull(),
    probability: real('probability').notNull().default(0), // 0..1
    isClosedWon: boolean('is_closed_won').notNull().default(false),
    isClosedLost: boolean('is_closed_lost').notNull().default(false),
  },
  (t) => ({
    pipelineOrderUniq: uniqueIndex('stages_pipeline_order_uniq').on(t.pipelineId, t.order),
  }),
)

export const deals = pgTable(
  'deals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 300 }).notNull(),
    // Integer cents — never float. Multi-currency: currency is per-deal, not global.
    amountCents: integer('amount_cents').notNull().default(0),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    stageId: uuid('stage_id').notNull().references(() => stages.id, { onDelete: 'restrict' }),
    status: dealStatusEnum('status').notNull().default('open'),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    ownerUserId: varchar('owner_user_id', { length: 128 }),
    expectedCloseAt: timestamp('expected_close_at', { withTimezone: true }),
    wonAt: timestamp('won_at', { withTimezone: true }),
    lostAt: timestamp('lost_at', { withTimezone: true }),
    lostReason: varchar('lost_reason', { length: 200 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    stageIdx: index('deals_stage_idx').on(t.stageId),
    ownerIdx: index('deals_owner_idx').on(t.ownerUserId),
    companyIdx: index('deals_company_idx').on(t.companyId),
    wonAtIdx: index('deals_won_at_idx').on(t.wonAt),
  }),
)

export const dealStageHistory = pgTable('deal_stage_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  fromStageId: uuid('from_stage_id').references(() => stages.id),
  toStageId: uuid('to_stage_id').notNull().references(() => stages.id),
  movedAt: timestamp('moved_at', { withTimezone: true }).notNull().defaultNow(),
  movedByUserId: varchar('moved_by_user_id', { length: 128 }),
  notes: text('notes'),
})

export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: activityTypeEnum('type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    summary: varchar('summary', { length: 500 }).notNull(),
    body: text('body'),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
    ownerUserId: varchar('owner_user_id', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    contactOccurredIdx: index('activities_contact_occurred_idx').on(t.contactId, t.occurredAt),
    dealOccurredIdx: index('activities_deal_occurred_idx').on(t.dealId, t.occurredAt),
  }),
)

export const dealsRelations = relations(deals, ({ one, many }) => ({
  stage: one(stages, { fields: [deals.stageId], references: [stages.id] }),
  contact: one(contacts, { fields: [deals.contactId], references: [contacts.id] }),
  company: one(companies, { fields: [deals.companyId], references: [companies.id] }),
  activities: many(activities),
  stageHistory: many(dealStageHistory),
}))

export type Company = typeof companies.$inferSelect
export type Contact = typeof contacts.$inferSelect
export type Pipeline = typeof pipelines.$inferSelect
export type Stage = typeof stages.$inferSelect
export type Deal = typeof deals.$inferSelect
export type Activity = typeof activities.$inferSelect
