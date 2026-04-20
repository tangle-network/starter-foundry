// Stripe Connect helpers — marketplace/platform payments. Each helper is
// intentionally small so the agent can read + extend. Read Stripe's docs
// (https://docs.stripe.com/connect) for the full API surface.

import Stripe from 'stripe'
import config from '../connect-config.json'

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '', {
  apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
})

/** Onboard a new connected account. Returns the URL the seller visits to finish KYC. */
export async function createConnectedAccount(sellerEmail: string) {
  const account = await stripe.accounts.create({
    type: config.mode === 'express' ? 'express' : 'custom',
    email: sellerEmail,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  })

  const link = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env['PUBLIC_URL'] ?? ''}${config.onboardingRefreshUrl}`,
    return_url: `${process.env['PUBLIC_URL'] ?? ''}${config.onboardingReturnUrl}`,
    type: 'account_onboarding',
  })

  return { accountId: account.id, onboardingUrl: link.url }
}

/** Charge a buyer, route most to the seller, take a platform fee. */
export async function createDestinationCharge(params: {
  amountCents: number
  currency: string
  buyerPaymentMethodId: string
  sellerAccountId: string
}) {
  const feeCents = Math.floor((params.amountCents * config.platformFeeBps) / 10000)
  return stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: params.currency,
    payment_method: params.buyerPaymentMethodId,
    confirm: true,
    application_fee_amount: feeCents,
    transfer_data: {
      destination: params.sellerAccountId,
    },
  })
}

/** Check whether a connected account has finished KYC and can receive transfers. */
export async function isAccountReady(accountId: string): Promise<boolean> {
  const account = await stripe.accounts.retrieve(accountId)
  return account.charges_enabled === true && account.payouts_enabled === true
}
