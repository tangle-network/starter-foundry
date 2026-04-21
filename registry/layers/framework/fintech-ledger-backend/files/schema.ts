// Double-entry ledger schema. Every transaction is N entries; sum of debits
// MUST equal sum of credits per currency. Amounts are NUMERIC(20,4) — never
// float. See src/ledger/post.ts for the posting invariant.
import { pgTable, uuid, varchar, timestamp, numeric, text, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const accountTypeEnum = pgEnum('account_type', [
  'asset',
  'liability',
  'equity',
  'income',
  'expense',
])

export const entryDirectionEnum = pgEnum('entry_direction', ['debit', 'credit'])

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Human-readable code for the chart of accounts, e.g. "1000" (cash), "4000" (revenue).
    code: varchar('code', { length: 32 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    type: accountTypeEnum('type').notNull(),
    // ISO 4217 currency code. Multi-currency accounts use a separate account per currency.
    currency: varchar('currency', { length: 3 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeCurrencyUnique: uniqueIndex('accounts_code_currency_uniq').on(t.code, t.currency),
  }),
)

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    externalRef: varchar('external_ref', { length: 200 }),
    // Idempotency key — retried requests with the same key return the existing txn.
    idempotencyKey: varchar('idempotency_key', { length: 128 }),
    memo: text('memo'),
    postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idempotencyUniq: uniqueIndex('transactions_idempotency_uniq').on(t.idempotencyKey),
    externalRefIdx: index('transactions_external_ref_idx').on(t.externalRef),
    postedAtIdx: index('transactions_posted_at_idx').on(t.postedAt),
  }),
)

export const entries = pgTable(
  'entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'restrict' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    direction: entryDirectionEnum('direction').notNull(),
    // NUMERIC(20,4): 20 total digits, 4 after the decimal. Handles >99 trillion USD with 4-dp precision.
    amount: numeric('amount', { precision: 20, scale: 4 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    accountPostedIdx: index('entries_account_posted_idx').on(t.accountId, t.postedAt),
    transactionIdx: index('entries_transaction_idx').on(t.transactionId),
  }),
)

export const transactionsRelations = relations(transactions, ({ many }) => ({
  entries: many(entries),
}))

export const entriesRelations = relations(entries, ({ one }) => ({
  transaction: one(transactions, { fields: [entries.transactionId], references: [transactions.id] }),
  account: one(accounts, { fields: [entries.accountId], references: [accounts.id] }),
}))

export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
export type Transaction = typeof transactions.$inferSelect
export type Entry = typeof entries.$inferSelect
export type NewEntry = typeof entries.$inferInsert
