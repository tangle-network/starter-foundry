# SOC2 Compliance Pack

Node/TypeScript primitives for SOC2 Type II audit evidence: append-only audit log (CC7.2), change-management approvals (CC8.1), vendor attestation registry (CC9.1), and incident-response playbook (CC7.3).

## Quick start

```bash
pnpm install
pnpm build                    # tsc --noEmit — must pass with zero errors
node validate-soc2-pack.mjs   # smoke-checks required files and logic
```

## What's included

| File | Purpose |
|---|---|
| `src/audit.ts` | `SocAuditStore` interface + `InMemorySocAuditStore` drop-in |
| `src/change-mgmt.ts` | `recordChange()` — enforces CC8.1 (≥1 approver, no self-approval) |
| `src/index.ts` | Re-exports everything; import from here |
| `docs/SOC2-controls.md` | Trust Services Criteria CC1–CC9 mapped to files |
| `docs/vendor-attestations.md` | Sub-processor registry — update quarterly |
| `docs/incident-response.md` | CC7.3 playbook — run a tabletop before audit |

## Integration

```typescript
import { InMemorySocAuditStore, recordChange } from './src/index.js'

const store = new InMemorySocAuditStore()

await recordChange(store, {
  id: 'chg-001',
  title: 'Enable feature flag X',
  description: 'Roll out to 10% of users',
  requester: 'alice@example.com',
  approvers: ['bob@example.com'],   // CC8.1: ≥1 approver, not self
  target: 'application',
  requestedAt: new Date().toISOString(),
})

await store.append({
  at: new Date().toISOString(),
  actor: 'deploy-bot',
  action: 'deploy',
  target: 'production:v1.2.3',
  approvedBy: ['bob@example.com'],
})
```

## Before your audit

1. Replace `InMemorySocAuditStore` with a DB-backed implementation — audit logs must survive restarts and be append-only at the DB level (revoke `UPDATE`/`DELETE` on the table from the app user).
2. Fill in `docs/vendor-attestations.md` with every sub-processor and their current SOC2 report date.
3. Enable GitHub branch protection + `CODEOWNERS` to enforce the ≥1-approver requirement at the SCM level (CC8.1).
4. Run at least one tabletop incident-response exercise and record it in `docs/tabletop-log.md` (CC7.3 evidence).

## Key constraints

- Audit log retention: 12 months minimum; confirm with your auditor (some require 7 years).
- Change approvals: self-approval is rejected by `recordChange()` — also enforce at the PR level.
- Vendor attestations must be current within the audit window (not older than ~12 months).
