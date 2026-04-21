# Headless Commerce Backend

Products → Variants → Carts → Line Items → Orders → Payments, with Stripe
PaymentIntent checkout and signature-verified idempotent webhooks.

## Setup

```bash
cp .env.example .env
# Fill in DATABASE_URL and STRIPE_SECRET_KEY in .env

pnpm install
pnpm db:generate   # generates drizzle migrations from src/db/schema.ts
pnpm db:migrate    # runs migrations against DATABASE_URL
pnpm dev           # starts server on PORT (default 8105)
```

## Key files

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | Drizzle schema — products, variants, carts, line_items, orders, payments, webhook_events |
| `src/api/cart.ts` | Cart CRUD + line-item upsert (price snapshot at add-to-cart time) |
| `src/api/checkout.ts` | Atomic inventory decrement + Order creation + Stripe PaymentIntent |
| `src/webhooks/stripe.ts` | Signature-verified, idempotent Stripe webhook handler |
| `src/server.ts` | Node.js HTTP router |
| `drizzle.config.ts` | Drizzle Kit config (reads DATABASE_URL) |

## API routes

```
GET  /health
GET  /api/products
GET  /api/products/:id
POST /api/carts
GET  /api/carts/:id
POST /api/carts/:id/items        { variantId, qty }
DELETE /api/carts/:id/items/:lineItemId
POST /api/carts/:id/checkout     → { orderId, paymentIntentId, clientSecret }
POST /webhooks/stripe
```

## Extension points

- **Add product fields**: edit `products` / `variants` tables in `src/db/schema.ts`, re-run `pnpm db:generate && pnpm db:migrate`.
- **Tax computation**: `checkout.ts` sets `taxCents: 0` — integrate Stripe Tax / TaxJar here before going live.
- **Shipping**: add a `shippingCents` calculation before the `orders.insert` in `checkout.ts`.
- **Webhook events**: add cases to the `switch` in `src/webhooks/stripe.ts`.
- **Auth**: wrap route handlers in an auth middleware that verifies the customer token and attaches `customerId`.

## Critical invariants — do not break these

- **Inventory is decremented on ORDER PLACEMENT** (not on payment success) inside the same DB transaction. Moving this to the webhook causes oversell.
- **Line-item `unitPriceCents` is snapshotted** at `addLineItem` time. Do not re-read `variants.priceCents` at checkout.
- **Stripe webhooks must verify the raw body** (before JSON parse) via `stripe.webhooks.constructEvent`. The handler reads the raw buffer first.
- **`webhook_events.event_id` is the idempotency key.** Duplicate Stripe deliveries insert nothing (ON CONFLICT DO NOTHING) and return 200 immediately.
- **Never store PAN/CVV**. Only `payment_intent_id` from Stripe. The `payments` table is PCI-SAQ-A compliant as long as card data never touches this server.
