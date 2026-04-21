# Capability: `capability:stripe-connect`

Stripe Connect — multi-party / marketplace payments. Onboard connected accounts (Express or Custom), route charges to sellers, handle platform fees and payouts. For marketplaces, gig platforms, creator economies, and multi-vendor stores.

**Applies to**: nextjs-ts, fullstack-ts, api-service, bun-http, deno-edge

## When to use

Attach for marketplace / platform products that take a cut of transactions. Use Express onboarding unless you specifically need Custom (you don't — Custom adds PCI/KYC obligation to you, not Stripe).

## Shipped deps

- `stripe`: ^17.0.0
