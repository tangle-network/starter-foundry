# SOC2 Compliance Pack — Agent Guide

## What this pack provides
- **`src/audit.ts`** — `InMemorySocAuditStore` + types. Swap for a DB-backed store in production.
- **`src/change-mgmt.ts`** — `recordChange()`: enforces CC8.1 (≥1 approver, no self-approval).
- **`src/index.ts`** — re-exports everything; import from here.
- **`docs/SOC2-controls.md`** — Trust Services Criteria CC1–CC9 mapped to files.
- **`docs/vendor-attestations.md`** — Live sub-processor registry; update quarterly.
- **`docs/incident-response.md`** — CC7.3 playbook; run a tabletop exercise before audit.

## First steps

```bash
pnpm install
pnpm build          # tsc --noEmit — must pass with zero errors
node validate-soc2-pack.mjs   # smoke-checks required files + logic
```

## Integration pattern

```typescript
import { InMemorySocAuditStore, recordChange } from './src/index.js'

const store = new InMemorySocAuditStore()

await recordChange(store, {
  id: 'chg-001',
  title: 'Enable feature flag X',
  description: 'Roll out to 10% of users',
  requester: 'alice@example.com',
  approvers: ['bob@example.com'],          // CC8.1: must have ≥1, not self
  target: 'application',
  requestedAt: new Date().toISOString(),
})
```

## Key compliance rules
- Audit log retention: 12 months minimum (confirm with auditor; some require 7 years).
- Change management (CC8.1): no self-merges. Enforce via branch protection, not policy alone.
- Vendor attestations must be current within the audit window (not older than ~1 year).
- Incident response (CC7.3): run at least one tabletop exercise before audit.

## Extending
- Replace `InMemorySocAuditStore` with a Postgres/SQLite implementation for persistence.
- Add a `SocAuditMiddleware` to auto-log HTTP mutations (POST/PUT/DELETE).
- Hook `recordChange()` into your CI deploy pipeline to capture every production change.
