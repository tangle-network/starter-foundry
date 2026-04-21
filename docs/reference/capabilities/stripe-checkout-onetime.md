# Capability: `capability:stripe-checkout-onetime`

Stripe Checkout for one-time purchases — hosted or embedded checkout session for single-purchase products (courses, digital downloads, event tickets, unlock fees). Not for subscriptions — use saas-billing for that.

**Applies to**: nextjs-ts, fullstack-ts, api-service, bun-http, deno-edge

## When to use

Attach for products selling a single item or one-time unlock. Use hosted Checkout URL unless the UI needs to stay on-brand — then use embedded mode.

## Shipped deps

- `stripe`: ^17.0.0
