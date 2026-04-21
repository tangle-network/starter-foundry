import { Decimal } from 'decimal.js'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '../db/client.js'
import { entries, transactions } from '../db/schema.js'

export interface LedgerBalance {
  accountId: string
  balance: string
  asOf: string
}

export interface LedgerEntry {
  id: string
  transactionId: string
  accountId: string
  direction: 'debit' | 'credit'
  amount: string
  currency: string
  postedAt: Date
}

export async function accountBalance(accountId: string, asOf: Date = new Date()): Promise<LedgerBalance> {
  const rows = await db
    .select({
      direction: entries.direction,
      amount: entries.amount,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .where(and(eq(entries.accountId, accountId), lte(transactions.postedAt, asOf)))

  const balance = rows.reduce<Decimal>((acc, r) => {
    const amt = new Decimal(r.amount)
    return r.direction === 'credit' ? acc.plus(amt) : acc.minus(amt)
  }, new Decimal(0))

  return { accountId, balance: balance.toFixed(2), asOf: asOf.toISOString() }
}

export async function accountEntries(
  accountId: string,
  options: { limit?: number; from?: Date; to?: Date } = {},
): Promise<LedgerEntry[]> {
  const limit = options.limit ?? 100
  const conditions = [eq(entries.accountId, accountId)]
  if (options.from) conditions.push(gte(transactions.postedAt, options.from))
  if (options.to) conditions.push(lte(transactions.postedAt, options.to))

  const rows = await db
    .select({
      id: entries.id,
      transactionId: entries.transactionId,
      accountId: entries.accountId,
      direction: entries.direction,
      amount: entries.amount,
      currency: entries.currency,
      postedAt: transactions.postedAt,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.postedAt))
    .limit(limit)

  return rows
}
