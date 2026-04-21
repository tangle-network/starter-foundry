# PCI DSS Compliance Pack — Agent Guide

Scope-reducing primitives for a Stripe-backed commerce backend. The PAN never
reaches your server; all CHD is handled by Stripe Elements on the client side.

## Quick start

```bash
pnpm install
pnpm build     # runs tsc --noEmit; zero errors is the bar
node validate-pci-pack.mjs   # prints "pci-pack ok" when scaffold is intact
```

## Module map

| File | Exports | Purpose |
|------|---------|---------|
| `src/pan-redact.ts` | `redactPan`, `redactPanInObject` | Replace Luhn-valid PANs with `<pan-redacted:****NNNN>` |
| `src/tokenize.ts` | `assertNoChdInRef`, `summarizePaymentMethod`, `StripePaymentMethodRef` | Validate + log Stripe `pm_…` token refs |
| `src/index.ts` | re-exports all of the above | Single import surface |

## Critical rules

- **Never store CVV** post-authorization — PCI DSS 3.2.1 forbids it even encrypted.
- **Never log raw bodies** on payment endpoints without running `redactPanInObject()` first.
- **Never accept PANs via GET** — always POST; PANs in URLs land in access logs.
- Use Stripe `pm_…` tokens as the only card reference stored in your database.

## Wiring redaction

```typescript
import { redactPanInObject } from './pan-redact.js'

// Sentry (before SDK init)
Sentry.init({
  beforeSend(event) {
    return redactPanInObject(event)
  },
})

// Express request logger
app.use((req, _res, next) => {
  req.body = redactPanInObject(req.body)
  next()
})
```

## Extending

- Add BIN ranges specific to your processor in `src/pan-redact.ts` — extend `PAN_PATTERN`.
- CHD-scoped audit events: emit to a separate log sink (e.g. a dedicated table or stream) so general app logs never mix with PCI audit scope.
- Validate the scaffold stays intact with `node validate-pci-pack.mjs` in CI.
