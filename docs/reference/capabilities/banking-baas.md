# Capability: `capability:banking-baas`

Banking-as-a-Service integration — account opening, ACH transfers, card issuance, ledger management. Ships provider-neutral wrappers for Unit, Column, and Mercury with runtime provider selection. For neobanks, expense-management apps, savings apps, business banking dashboards, compliance-heavy fintech.

**Applies to**: nextjs-ts, fullstack-ts, api-service, bun-http, deno-edge

## When to use

Attach for products that move real money via US banking rails — neobanks, expense-management, savings, business banking, any US consumer/business fintech. For crypto-only payments use saas-billing + a crypto wallet capability instead.

## Shipped deps

- `zod`: ^3.23.0

## First moves

- Pick a provider in banking-config.json (unit | column | mercury)
- Set the provider's API key in env (UNIT_API_KEY | COLUMN_API_KEY | MERCURY_API_TOKEN)
- Use the bankingClient from lib/banking.ts — provider-neutral method surface (openAccount, transfer, issueCard)

## Gotchas

- KYC/KYB obligations differ per provider. Unit: you handle KYC docs. Column: bank-direct partnership. Mercury: API is for existing Mercury customers to automate their own accounts, NOT for issuing accounts to YOUR users.
- ACH same-day vs standard — same-day has cutoff times (~2pm ET); plan UX around it
- FBO (For Benefit Of) vs direct-issue: Unit + Column support FBO accounts; Mercury does not
