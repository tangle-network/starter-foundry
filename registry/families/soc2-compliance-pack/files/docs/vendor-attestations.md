# Vendor Attestations — Sub-processor Registry

SOC2 CC9.1/CC9.2 expect a live list of sub-processors with current
attestations. Update this file BEFORE onboarding any vendor that handles
customer data.

| Vendor | Purpose | Attestation | Report Date | Next Review |
|---|---|---|---|---|
| AWS | Compute + storage | SOC2 Type II | _fill in_ | _annually_ |
| Cloudflare | CDN + WAF | SOC2 Type II | _fill in_ | _annually_ |
| Stripe | Payments | PCI DSS + SOC1 Type II | _fill in_ | _annually_ |
| Vercel | Hosting | SOC2 Type II | _fill in_ | _annually_ |
| GitHub | Source + CI | SOC2 Type II | _fill in_ | _annually_ |
| Datadog | Observability | SOC2 Type II | _fill in_ | _annually_ |
| Sentry | Error monitoring | SOC2 Type II | _fill in_ | _annually_ |
| Linear | Issue tracking | SOC2 Type II | _fill in_ | _annually_ |

## Onboarding checklist

Before integrating a new vendor:

1. Confirm they have a current SOC2 Type II (≤ 12 months old) or equivalent.
2. Confirm they sign a DPA if they process EU data.
3. Add them to this table with the attestation report date.
4. Record the onboarding in `src/audit.ts` via `action: 'vendor.change'`.

## Data classification

For each vendor, note the data classes they receive:
- **A** — PII (names, emails, addresses)
- **B** — Sensitive PII (SSN, DOB, government IDs)
- **C** — PHI (health records)
- **D** — PCI (cardholder data)
- **E** — Secrets (API keys, tokens)

Minimize A-E exposure per vendor. Keep the minimum-necessary principle.
