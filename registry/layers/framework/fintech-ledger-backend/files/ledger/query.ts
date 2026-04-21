import { Decimal } from 'decimal.js';
import { db } from './db';
import { transactions } from './schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export interface Transaction {
  id: string;
  accountId: string;
  amount: string;
  currency: string;
  type: 'credit' | 'debit';
  description: string | null;
  createdAt: Date;
}

export interface LedgerBalance {
  accountId: string;
  balance: string;
  currency: string;
}

export async function getBalance(accountId: string, currency: string): Promise<LedgerBalance> {
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.accountId, accountId), eq(transactions.currency, currency)));

  const balance = rows.reduce((acc: Decimal, r: typeof rows[number]) => {
    const amount = new Decimal(r.amount);
    return r.type === 'credit' ? acc.plus(amount) : acc.minus(amount);
  }, new Decimal(0));

  return { accountId, balance: balance.toFixed(2), currency };
}

export async function getTransactions(
  accountId: string,
  from?: Date,
  to?: Date
): Promise<Transaction[]> {
  const conditions = [eq(transactions.accountId, accountId)];
  if (from) conditions.push(gte(transactions.createdAt, from));
  if (to) conditions.push(lte(transactions.createdAt, to));

  return db.select().from(transactions).where(and(...conditions));
}
