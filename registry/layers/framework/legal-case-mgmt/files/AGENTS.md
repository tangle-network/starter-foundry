# Legal Case Management Scaffold

Node.js HTTP API for legal practice management. Drizzle ORM + Postgres + decimal.js.

## Setup

```bash
cp .env.example .env          # set DATABASE_URL
pnpm install
pnpm db:generate               # generate Drizzle migrations
pnpm db:migrate                # apply migrations to Postgres
pnpm dev                       # starts on port 8102
curl http://localhost:8102/health
```

## REST API

| Method | Path | Body / Notes |
|--------|------|-------------|
| GET | /health | Returns `{ status: "ok" }` |
| POST | /api/matters | `{ clientId, matterNumber, title, practiceArea?, opposingParties? }` |
| GET | /api/matters/:id | Returns matter + parties |
| POST | /api/matters/:id/time-entries | `{ attorneyId, workedAt (ISO), minutes (integer), narrative, billable? }` |
| GET | /api/matters/:id/time-entries | Lists unbilled billable entries |
| POST | /api/matters/:id/invoice/draft | Drafts invoice from unbilled entries; requires billing_rates row for each attorney |

## Key files

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | Drizzle table definitions — edit here to extend the data model |
| `src/api/matter.ts` | Matter CRUD + time-entry endpoints |
| `src/api/billing.ts` | Invoice draft generator (resolves historical rates, uses Decimal for cents) |
| `src/db/client.ts` | Drizzle client — reads DATABASE_URL from env |
| `drizzle.config.ts` | Drizzle Kit migration config |

## Data model

- **clients** — billing entity for a matter
- **attorneys** — firm staff; each has time-bounded billing_rates rows
- **matters** — unit of work (and privilege); status: open | closed | archived
- **parties** — roles on a matter: client | opposing | witness | counsel | other
- **documents** — content-addressed (sha256 hash), immutable rows
- **billing_rates** — hourly_rate_cents + effectiveAt; resolved at time-of-work
- **time_entries** — integer minutes, locked to an invoice once drafted
- **invoices** — status: draft | sent | paid | void; totals in integer cents

## Critical rules

- Store time in **integer minutes** — never fractional hours
- Store money in **integer cents** — billing.ts uses decimal.js for all arithmetic
- **Never** add UPDATE/DELETE endpoints for the documents table (immutability is a retention requirement)
- Access control must be at the **matter level** to protect attorney-client privilege
- Conflicts check is **not implemented** — add before any production use
- Trust / IOLTA funds must be in a **separate ledger** — do not commingle with operating funds

## Extension points

- Add new practice-area fields or matter subtypes in `src/db/schema.ts`
- Add new API routes in `src/api/` and register them in `src/server.ts`
- Add a `/api/clients` and `/api/attorneys` CRUD layer for onboarding
- Add a conflicts-check middleware that queries parties before inserting a new matter
