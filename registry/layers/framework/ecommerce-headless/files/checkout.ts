// Checkout: creates an Order from a Cart, decrements variant inventory IN
// THE SAME TRANSACTION (prevents oversell), then creates a Stripe
// PaymentIntent and returns the client_secret for the front-end to confirm.
import type { IncomingMessage, ServerResponse } from 'node:http'
import Stripe from 'stripe'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { carts, lineItems, orders, payments, variants } from '../db/schema.ts'

const stripeKey = process.env.STRIPE_SECRET_KEY
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2025-09-30.clover' as Stripe.LatestApiVersion }) : null

export async function checkout(
  request: IncomingMessage,
  response: ServerResponse,
  cartId: string,
) {
  if (!stripe) {
    response.writeHead(503, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'STRIPE_SECRET_KEY is not set' }))
    return
  }

  let orderId: string | null = null
  let totalCents = 0
  let currency = 'USD'
  let customerId: string | null = null

  try {
    const prepared = await db.transaction(async (tx) => {
      const [cart] = await tx.select().from(carts).where(eq(carts.id, cartId)).limit(1)
      if (!cart) throw new Error('CART_NOT_FOUND')
      if (cart.status !== 'active') throw new Error('CART_NOT_ACTIVE')
      const items = await tx.select().from(lineItems).where(eq(lineItems.cartId, cartId))
      if (items.length === 0) throw new Error('CART_EMPTY')

      let subtotal = 0
      for (const item of items) {
        subtotal += item.unitPriceCents * item.qty
        // Decrement inventory atomically. If updated rows === 0, we had no stock.
        const updated = await tx
          .update(variants)
          .set({ inventoryQty: sql`${variants.inventoryQty} - ${item.qty}` })
          .where(and(eq(variants.id, item.variantId), sql`${variants.inventoryQty} >= ${item.qty}`))
          .returning({ id: variants.id })
        if (updated.length === 0) throw new Error(`OUT_OF_STOCK:${item.variantId}`)
      }

      const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1e4).toString().padStart(4, '0')}`
      const [order] = await tx
        .insert(orders)
        .values({
          cartId,
          customerId: cart.customerId,
          orderNumber,
          subtotalCents: subtotal,
          taxCents: 0, // NOTE: integrate Stripe Tax / TaxJar / Avalara before production
          shippingCents: 0,
          totalCents: subtotal,
          currency: cart.currency,
          status: 'pending',
        })
        .returning()

      await tx.update(carts).set({ status: 'checked_out' }).where(eq(carts.id, cartId))

      return { order, subtotal, currency: cart.currency, customerId: cart.customerId }
    })
    orderId = prepared.order.id
    totalCents = prepared.subtotal
    currency = prepared.currency
    customerId = prepared.customerId
  } catch (err) {
    const msg = (err as Error).message
    const code = msg.startsWith('OUT_OF_STOCK:') ? 409 : msg === 'CART_NOT_FOUND' ? 404 : 422
    response.writeHead(code, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: msg }))
    return
  }

  // Outside the DB transaction: create the Stripe PaymentIntent and record it.
  const intent = await stripe.paymentIntents.create(
    {
      amount: totalCents,
      currency: currency.toLowerCase(),
      metadata: { orderId: orderId!, customerId: customerId ?? '' },
      automatic_payment_methods: { enabled: true },
    },
    {
      // Prevents duplicate PaymentIntent creation if the client retries.
      idempotencyKey: `order:${orderId}`,
    },
  )
  await db.insert(payments).values({
    orderId: orderId!,
    processor: 'stripe',
    processorId: intent.id,
    amountCents: totalCents,
    currency,
    status: 'requires_action',
  })

  response.writeHead(201, { 'content-type': 'application/json' })
  response.end(
    JSON.stringify({
      orderId,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amountCents: totalCents,
      currency,
    }),
  )
}
