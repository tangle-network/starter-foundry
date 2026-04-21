// Invoice draft generator. Aggregates unbilled time entries for a matter,
// resolves the effective billing rate at each entry's workedAt, computes
// totals in integer cents (via Decimal for rounding safety), and emits a
// draft invoice + links the time entries to it in one DB transaction.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Decimal } from 'decimal.js'
import { and, desc, eq, isNull, lte } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { billingRates, invoices, matters, timeEntries } from '../db/schema.ts'

Decimal.set({ precision: 40, rounding: 2 })

async function resolveRate(attorneyId: string, at: Date): Promise<{ rateCents: number; currency: string }> {
  const rows = await db
    .select()
    .from(billingRates)
    .where(and(eq(billingRates.attorneyId, attorneyId), lte(billingRates.effectiveAt, at)))
    .orderBy(desc(billingRates.effectiveAt))
    .limit(1)
  const r = rows[0]
  if (!r) throw new Error(`no billing rate for attorney ${attorneyId} effective at ${at.toISOString()}`)
  return { rateCents: r.hourlyRateCents, currency: r.currency }
}

export interface DraftInvoiceLine {
  timeEntryId: string
  minutes: number
  rateCents: number
  amountCents: number
}

export interface DraftInvoiceResult {
  invoiceId: string
  invoiceNumber: string
  matterId: string
  currency: string
  subtotalCents: number
  totalCents: number
  lines: DraftInvoiceLine[]
}

/** Generate a draft invoice from every unbilled billable time entry on a matter. */
export async function draftInvoice(matterId: string): Promise<DraftInvoiceResult> {
  return db.transaction(async (tx) => {
    const [matter] = await tx.select().from(matters).where(eq(matters.id, matterId)).limit(1)
    if (!matter) throw new Error(`matter not found: ${matterId}`)

    const unbilled = await tx
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.matterId, matterId),
          eq(timeEntries.billable, true),
          isNull(timeEntries.invoiceId),
        ),
      )
    if (unbilled.length === 0) throw new Error('no unbilled time entries')

    let subtotal = new Decimal(0)
    let currency: string | null = null
    const lines: DraftInvoiceLine[] = []
    for (const entry of unbilled) {
      const rate = await resolveRate(entry.attorneyId, entry.workedAt)
      if (currency && currency !== rate.currency) {
        throw new Error('multi-currency invoice not supported — split into per-currency invoices')
      }
      currency = rate.currency
      // amount = rateCents * minutes / 60. Use Decimal so fractional cents round once at the end.
      const amount = new Decimal(rate.rateCents).mul(entry.minutes).div(60)
      const amountCents = Number(amount.toFixed(0, 2))
      subtotal = subtotal.plus(amountCents)
      lines.push({
        timeEntryId: entry.id,
        minutes: entry.minutes,
        rateCents: rate.rateCents,
        amountCents,
      })
    }

    const invoiceNumber = `INV-${matter.matterNumber}-${Date.now()}`
    const subtotalCents = Number(subtotal.toFixed(0))
    const [invoice] = await tx
      .insert(invoices)
      .values({
        matterId,
        clientId: matter.clientId,
        invoiceNumber,
        status: 'draft',
        subtotalCents,
        totalCents: subtotalCents,
        currency: currency!,
      })
      .returning()
    if (!invoice) throw new Error('Invoice not found')

    // Lock the time entries to this invoice so they can't be drafted twice.
    for (const line of lines) {
      await tx
        .update(timeEntries)
        .set({ invoiceId: invoice.id })
        .where(eq(timeEntries.id, line.timeEntryId))
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber,
      matterId,
      currency: currency!,
      subtotalCents,
      totalCents: subtotalCents,
      lines,
    }
  })
}

export async function draftInvoiceRoute(
  _request: IncomingMessage,
  response: ServerResponse,
  matterId: string,
) {
  try {
    const result = await draftInvoice(matterId)
    response.writeHead(201, { 'content-type': 'application/json' })
    response.end(JSON.stringify(result))
  } catch (err) {
    response.writeHead(422, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: (err as Error).message }))
  }
}
