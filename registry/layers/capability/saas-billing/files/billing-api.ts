import Stripe from 'stripe'
import type { Request, Response, NextFunction } from 'express'
import billingConfig from './billing-config.json'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })

interface BillingUser {
  id: string
  email: string
  stripeCustomerId?: string
  plan?: string
}

export function createBillingRouter() {
  async function checkout(req: Request, res: Response) {
    const { planId, successUrl, cancelUrl } = req.body
    const user = (req as any).user as BillingUser
    const plan = billingConfig.plans.find((p) => p.id === planId)
    if (!plan || plan.priceMonthly === 0) {
      return res.status(400).json({ error: 'invalid plan' })
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: user.stripeCustomerId ? undefined : user.email,
      customer: user.stripeCustomerId || undefined,
      mode: 'subscription',
      line_items: [{ price_data: {
        currency: 'usd',
        product_data: { name: plan.name },
        unit_amount: plan.priceMonthly * 100,
        recurring: { interval: 'month' },
      }, quantity: 1 }],
      metadata: { userId: user.id, planId },
      success_url: successUrl ?? `${process.env.APP_URL}/settings/billing?success=1`,
      cancel_url: cancelUrl ?? `${process.env.APP_URL}/pricing`,
    })

    res.json({ url: session.url })
  }

  async function portal(req: Request, res: Response) {
    const user = (req as any).user as BillingUser
    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: 'no billing account' })
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.APP_URL}/settings/billing`,
    })
    res.json({ url: session.url })
  }

  async function webhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'] as string
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(
        (req as any).rawBody ?? req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch {
      return res.status(400).json({ error: 'invalid signature' })
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await onCheckoutCompleted(session)
        break
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await onSubscriptionUpdated(sub)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await onSubscriptionDeleted(sub)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await onPaymentFailed(invoice)
        break
      }
    }

    res.json({ received: true })
  }

  async function subscription(req: Request, res: Response) {
    const user = (req as any).user as BillingUser
    if (!user.stripeCustomerId) {
      return res.json({ plan: 'free', status: 'active' })
    }
    const subs = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'active',
      limit: 1,
    })
    const sub = subs.data[0]
    if (!sub) return res.json({ plan: 'free', status: 'active' })
    const planId = sub.metadata.planId ?? 'pro'
    return res.json({ plan: planId, status: sub.status, currentPeriodEnd: sub.current_period_end })
  }

  return { checkout, portal, webhook, subscription }
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  const planId = session.metadata?.planId
  if (!userId || !planId) return
  // Persist stripeCustomerId + planId to your user store
}

async function onSubscriptionUpdated(sub: Stripe.Subscription) {
  const customerId = sub.customer as string
  // Update plan limits based on new subscription state
  void customerId
}

async function onSubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId = sub.customer as string
  // Downgrade user to free plan
  void customerId
}

async function onPaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  // Notify user of failed payment, grace period logic
  void customerId
}
