// Stripe usage-based billing via Billing Meters. The meter aggregates events
// server-side; you just report consumption events as they happen. The meter
// definition (name, cadence, aggregation) lives in the Stripe Dashboard.

import Stripe from 'stripe'

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '', {
  apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
})

/** Report a consumption event. `value` accumulates into the meter for the customer. */
export async function reportUsage(params: {
  eventName: string
  customerId: string
  value: number
  timestamp?: number
  /** Idempotency — events with the same identifier de-dupe on Stripe's side. */
  identifier?: string
}) {
  return stripe.billing.meterEvents.create({
    event_name: params.eventName,
    timestamp: params.timestamp,
    identifier: params.identifier,
    payload: {
      stripe_customer_id: params.customerId,
      value: String(params.value),
    },
  })
}

/** Read the current aggregated usage for a customer. */
export async function readUsageSummary(params: {
  meterId: string
  customerId: string
  startTime: number
  endTime: number
}) {
  return stripe.billing.meters.listEventSummaries(params.meterId, {
    customer: params.customerId,
    start_time: params.startTime,
    end_time: params.endTime,
  })
}
