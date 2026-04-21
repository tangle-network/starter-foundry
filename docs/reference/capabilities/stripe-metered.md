# Capability: `capability:stripe-metered`

Stripe usage-based billing via Billing Meters — report events as they happen, Stripe aggregates and bills on your cadence. For AI products (tokens consumed), API businesses (requests), storage/compute products (GB-hours).

**Applies to**: nextjs-ts, fullstack-ts, api-service, bun-http, deno-edge

## When to use

Attach for products that bill on consumption rather than flat tiers. Report events via stripe.billing.meterEvents.create — Stripe aggregates and bills on the cycle you configured in the meter definition.

## Shipped deps

- `stripe`: ^17.0.0
