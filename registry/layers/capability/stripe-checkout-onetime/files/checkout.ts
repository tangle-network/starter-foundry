// Stripe Checkout helper — one-time purchases. For recurring subscriptions,
// use saas-billing's subscription helpers instead.

import Stripe from 'stripe'

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '', {
  apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
})

export interface OneTimeCheckoutParams {
  productName: string
  /** Amount in smallest currency unit (cents for USD). */
  amount: number
  currency: string
  successUrl: string
  cancelUrl: string
  customerEmail?: string
  /** Opaque metadata keyed to your internal order id. */
  metadata?: Record<string, string>
}

/** Create a hosted Checkout session. Returns the URL to redirect the buyer to. */
export async function createOneTimeCheckout(params: OneTimeCheckoutParams): Promise<{
  sessionId: string
  url: string
}> {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: params.currency,
          product_data: { name: params.productName },
          unit_amount: params.amount,
        },
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer_email: params.customerEmail,
    metadata: params.metadata ?? {},
  })

  if (!session.url) throw new Error('Stripe returned a session with no URL')
  return { sessionId: session.id, url: session.url }
}

/** Verify a checkout completed successfully. Call from your webhook handler. */
export async function verifyCheckoutCompleted(sessionId: string): Promise<{
  paid: boolean
  metadata: Record<string, string>
}> {
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  return {
    paid: session.payment_status === 'paid',
    metadata: (session.metadata ?? {}) as Record<string, string>,
  }
}
