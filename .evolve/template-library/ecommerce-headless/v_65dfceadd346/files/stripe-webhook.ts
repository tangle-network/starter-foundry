// Stripe webhook: signature-verified and idempotent.
//
// Signature verification MUST operate on the RAW request body BEFORE JSON
// parse. Parsing first, then re-serializing, breaks verification because
// whitespace / field-order differ.
//
// Idempotency: webhook_events.event_id UNIQUE. Duplicate deliveries return
// 200 without re-running handlers so Stripe stops retrying.
import type { IncomingMessage, ServerResponse } from 'node:http'
import Stripe from 'stripe'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { orders, payments, webhookEvents } from '../db/schema.ts'

const stripeKey = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2025-09-30.clover' as Stripe.LatestApiVersion }) : null

async function readRawBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

export async function stripeWebhook(request: IncomingMessage, response: ServerResponse) {
  if (!stripe || !webhookSecret) {
    response.writeHead(503, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'Stripe not configured' }))
    return
  }
  const signature = request.headers['stripe-signature']
  if (typeof signature !== 'string') {
    response.writeHead(400, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'missing stripe-signature header' }))
    return
  }

  const raw = await readRawBody(request)

  let event: Stripe.Event
  try {
    // constructEvent takes the raw body (Buffer/string) and verifies HMAC.
    event = stripe.webhooks.constructEvent(raw, signature, webhookSecret!)
  } catch (err) {
    response.writeHead(400, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: `signature verification failed: ${(err as Error).message}` }))
    return
  }

  // Idempotency: ON CONFLICT DO NOTHING on (processor, event_id). If the row
  // already exists we skip handling and 200 back.
  const inserted = await db
    .insert(webhookEvents)
    .values({
      processor: 'stripe',
      eventId: event.id,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing({ target: [webhookEvents.processor, webhookEvents.eventId] })
    .returning({ id: webhookEvents.id })

  if (inserted.length === 0) {
    // Duplicate delivery — already processed. 200 so Stripe stops retrying.
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ idempotent: true }))
    return
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
        break
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
        break
      case 'charge.refunded':
        await handleRefund(event.data.object as Stripe.Charge)
        break
      default:
        // Unhandled type — stored in webhook_events for later inspection.
        break
    }
    await db
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvents.id, inserted[0]!.id))
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ ok: true }))
  } catch (err) {
    // Keep the row so Stripe retries; record the error for debugging.
    await db
      .update(webhookEvents)
      .set({ error: (err as Error).message })
      .where(eq(webhookEvents.id, inserted[0]!.id))
    response.writeHead(500, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: (err as Error).message }))
  }
}

async function handlePaymentSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
  const orderId = pi.metadata?.orderId
  if (!orderId) return
  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ status: 'succeeded', capturedAt: new Date() })
      .where(and(eq(payments.processor, 'stripe'), eq(payments.processorId, pi.id)))
    await tx
      .update(orders)
      .set({ status: 'paid', paidAt: new Date() })
      .where(eq(orders.id, orderId))
  })
}

async function handlePaymentFailed(pi: Stripe.PaymentIntent): Promise<void> {
  const orderId = pi.metadata?.orderId
  if (!orderId) return
  await db
    .update(payments)
    .set({ status: 'failed' })
    .where(and(eq(payments.processor, 'stripe'), eq(payments.processorId, pi.id)))
  // NOTE: restoring inventory on failure is a separate decision. If the
  // PI can be retried, don't restore. If the order is cancelled, restore.
}

async function handleRefund(charge: Stripe.Charge): Promise<void> {
  const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  if (!piId) return
  await db.transaction(async (tx) => {
    const [pay] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.processor, 'stripe'), eq(payments.processorId, piId)))
      .limit(1)
    if (!pay) return
    await tx
      .update(payments)
      .set({ status: 'refunded', refundedAt: new Date() })
      .where(eq(payments.id, pay.id))
    await tx
      .update(orders)
      .set({ status: 'refunded' })
      .where(eq(orders.id, pay.orderId))
  })
}
