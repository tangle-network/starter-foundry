# PCI DSS Compliance Pack

PCI DSS 4.0 primitives for a Stripe-backed commerce backend. Stripe Elements handles the PAN client-side — this pack keeps your server out of CHD scope.

## Quick start

```bash
pnpm install
pnpm build               # tsc --noEmit — zero errors means scaffold is wired
node validate-pci-pack.mjs   # prints "pci-pack ok"
```

## What's included

| File | Purpose |
|------|---------|
| `src/pan-redact.ts` | Replace Luhn-valid PANs with `<pan-redacted:****NNNN>` in logs and error tracers |
| `src/tokenize.ts` | Server-side contract for Stripe `pm_…` token refs — validate, assert, summarize |
| `src/index.ts` | Barrel re-export of the full public surface |
| `docs/PCI-DSS-controls.md` | Control mapping and compliance notes |

## Usage

```typescript
import { redactPanInObject, assertNoChdInRef, summarizePaymentMethod } from './src/index.js'

// Wire redaction onto every log sink
app.use((req, _res, next) => {
  req.body = redactPanInObject(req.body)
  next()
})

// Validate a Stripe payment method ref before storing it
assertNoChdInRef(ref)          // throws if a raw PAN leaked in
console.log(summarizePaymentMethod(ref))  // "visa ****4242 (pm_...)"
```

## Critical rules

- **Never store CVV** post-authorization — PCI DSS 3.2.1 forbids it, even encrypted.
- **Never log request bodies** on payment endpoints without `redactPanInObject()`.
- **Never accept PANs via GET** — always POST; PANs in URLs land in access logs.
- Store only the Stripe `pm_…` token as the card reference in your database.

## Validation

```bash
node validate-pci-pack.mjs
```

Run this in CI to confirm the scaffold files and exports are intact. Exits non-zero and prints what's missing if the pack is broken.
