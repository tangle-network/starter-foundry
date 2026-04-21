// Stripe-backed CHD tokenization. The client-side Stripe Elements SDK
// collects the PAN in Stripe's iframe; the server only ever sees the
// resulting PaymentMethod id (`pm_...`). This module is the server-side
// contract for storing + charging the token.

export interface StripePaymentMethodRef {
  /** `pm_...` — the tokenized reference. Never contains CHD. */
  paymentMethodId: string
  /** Last 4 digits of the card (safe to store + display). */
  last4: string
  /** Card brand (visa, mastercard, etc.). */
  brand: string
  /** Stripe customer id the payment method is attached to. */
  customerId?: string
}

/** Asserts the ref has no CHD-shaped fields. Throws if a raw PAN leaks in. */
export function assertNoChdInRef(ref: unknown): asserts ref is StripePaymentMethodRef {
  if (ref === null || typeof ref !== 'object') {
    throw new Error('payment-method ref must be an object')
  }
  const r = ref as Record<string, unknown>
  if (typeof r['paymentMethodId'] !== 'string' || !r['paymentMethodId'].startsWith('pm_')) {
    throw new Error('paymentMethodId must be a Stripe pm_ token')
  }
  for (const forbidden of ['pan', 'cardNumber', 'fullCardNumber', 'cvv', 'cvc', 'pin']) {
    if (forbidden in r) {
      throw new Error(`PCI scope violation: ref contains forbidden field '${forbidden}'`)
    }
  }
  if (typeof r['last4'] !== 'string' || r['last4'].length !== 4) {
    throw new Error('last4 must be a 4-char string')
  }
}

/** Build a safe-to-log summary of a payment method reference. */
export function summarizePaymentMethod(ref: StripePaymentMethodRef): string {
  return `${ref.brand} ****${ref.last4} (${ref.paymentMethodId})`
}
