// Atomic post_transaction: validates the debit=credit invariant per currency
// and inserts the transaction + entries in a single DB transaction. Any
// error rolls the whole thing back so the ledger can never land unbalanced.
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { entries, transactions, type Entry, type Transaction } from '../db/schema.js'
import { m, toDbString } from './money.js'
import Decimal from 'decimal.js'

export interface PostEntryInput {
  accountId: string
  direction: 'debit' | 'credit'
  amount: string | number
  currency: string
}

export interface PostTransactionInput {
  idempotencyKey?: string
  externalRef?: string
  memo?: string
  postedAt?: Date
  entries: PostEntryInput[]
}

export interface PostResult {
  transaction: Transaction
  entries: Entry[]
  idempotent: boolean
}

export class LedgerError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
  }
}

export async function postTransaction(input: PostTransactionInput): Promise<PostResult> {
  if (input.entries.length < 2) {
    throw new LedgerError('a transaction needs at least two entries', 'NOT_ENOUGH_ENTRIES')
  }

  // Group by currency; each currency group must balance debits == credits.
  const byCurrency = new Map<string, { debit: Decimal; credit: Decimal }>()
  for (const e of input.entries) {
    if (!/^[A-Z]{3}$/.test(e.currency)) {
      throw new LedgerError(`bad currency code: ${e.currency}`, 'BAD_CURRENCY')
    }
    const amount = m(e.amount)
    if (amount.isNegative() || amount.isZero()) {
      throw new LedgerError('entry amount must be positive', 'BAD_AMOUNT')
    }
    const bucket = byCurrency.get(e.currency) ?? { debit: new Decimal(0), credit: new Decimal(0) }
    if (e.direction === 'debit') bucket.debit = bucket.debit.plus(amount)
    else bucket.credit = bucket.credit.plus(amount)
    byCurrency.set(e.currency, bucket)
  }

  for (const [ccy, { debit, credit }] of byCurrency) {
    if (!debit.equals(credit)) {
      throw new LedgerError(
        `unbalanced ${ccy}: debits=${debit.toFixed(4)} credits=${credit.toFixed(4)}`,
        'UNBALANCED',
      )
    }
  }

  return db.transaction(async (tx) => {
    // Idempotency: if the key already exists, return the existing transaction.
    if (input.idempotencyKey) {
      const existing = await tx
        .select()
        .from(transactions)
        .where(eq(transactions.idempotencyKey, input.idempotencyKey))
        .limit(1)
      const txn = existing[0]
      if (txn) {
        const rows = await tx.select().from(entries).where(eq(entries.transactionId, txn.id))
        return { transaction: txn, entries: rows, idempotent: true }
      }
    }

    const [txnRow] = await tx
      .insert(transactions)
      .values({
        idempotencyKey: input.idempotencyKey ?? null,
        externalRef: input.externalRef ?? null,
        memo: input.memo ?? null,
        postedAt: input.postedAt ?? new Date(),
      })
      .returning()
    if (!txnRow) throw new LedgerError('insert returned no rows', 'INSERT_FAILED')

    const entryRows = await tx
      .insert(entries)
      .values(
        input.entries.map((e) => ({
          transactionId: txnRow.id,
          accountId: e.accountId,
          direction: e.direction,
          amount: toDbString(m(e.amount)),
          currency: e.currency,
          postedAt: input.postedAt ?? new Date(),
        })),
      )
      .returning()

    // Defense-in-depth: re-check balance after insert in case a trigger
    // altered anything. Cheap and protects against silent corruption.
    const postedByCcy = new Map<string, Decimal>()
    for (const row of entryRows) {
      const signed = row.direction === 'debit' ? m(row.amount) : m(row.amount).negated()
      postedByCcy.set(row.currency, (postedByCcy.get(row.currency) ?? new Decimal(0)).plus(signed))
    }
    for (const [ccy, net] of postedByCcy) {
      if (!net.isZero()) {
        throw new LedgerError(`post-insert invariant violated: ${ccy} net=${net.toFixed(4)}`, 'INVARIANT')
      }
    }

    return { transaction: txnRow, entries: entryRows, idempotent: false }
  })
}

/** Convenience: a two-entry transfer. Not a replacement for postTransaction — use it for tests & trivial cases only. */
export async function postTransfer(params: {
  fromAccountId: string
  toAccountId: string
  amount: string | number
  currency: string
  memo?: string
  idempotencyKey?: string
}): Promise<PostResult> {
  return postTransaction({
    idempotencyKey: params.idempotencyKey,
    memo: params.memo,
    entries: [
      { accountId: params.fromAccountId, direction: 'credit', amount: params.amount, currency: params.currency },
      { accountId: params.toAccountId, direction: 'debit', amount: params.amount, currency: params.currency },
    ],
  })
}
