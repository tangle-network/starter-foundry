# PCI DSS 4.0 — Control Surface

This pack ships the technical primitives that reduce PCI scope for an
e-commerce backend. The scope-reduction strategy is Stripe-first: use
Stripe Elements / Checkout so the PAN never touches your servers, then
use the `pm_...` token for all downstream operations.

## Scope reduction via tokenization (PCI 3.4)

- Raw PAN / CVV / track data: **must not touch your servers**. Use Stripe Elements, Checkout, or Payment Request Button.
- `assertNoChdInRef()` (in `src/tokenize.ts`) enforces this at the code layer.
- Last-4 + brand are safe to store and display.

## Requirements mapped to code

| Req | Name | Artifact |
|---|---|---|
| PCI 1 | Network segmentation | Infra concern — gate CHD-adjacent services behind a separate VPC |
| PCI 2 | No default passwords | Secret management (AWS Secrets Manager / Vault) |
| PCI 3 | Protect stored CHD | **Do not store CHD** — use `pm_...` tokens instead |
| PCI 3.4 | Render PAN unreadable | `redactPan()` + tokenization above |
| PCI 4 | Encrypt CHD in transit | TLS 1.2+ — infra concern |
| PCI 6 | Secure software dev | SCA + SAST (the CVE sweep in `.github/workflows/cve-sweep.yml`) |
| PCI 8 | Auth + access control | App auth layer |
| **PCI 10** | Log + monitor access | CHD audit log (this pack's audit store) |
| PCI 11 | Regular security testing | Pen test (annual) + vuln scans (quarterly) |

## PCI 3.2.1 — Forbidden data

- CVV / CVC / CVV2: **never** store post-authorization.
- Full magnetic stripe: **never** store.
- PIN / PIN block: **never** store.
- PAN: only store if you MUST — and if you do, encrypt at rest, segment network, add to SAQ-D scope.

## Log hygiene

- Never log request/response bodies on payment endpoints without `redactPanInObject()`.
- Error tracers (Sentry, Datadog) default to capturing request bodies. Install the redaction as a hook BEFORE the SDK captures.
- Test with a Luhn-valid test card in dev — the redactor should replace it with `<pan-redacted:****NNNN>`.

## SAQ scope

Typical with Stripe Elements: **SAQ-A-EP** (JavaScript-embedded iframe). This is the lightest questionnaire. If you deviate (e.g. accept raw card data via your own form), scope jumps to SAQ-D.
