# HIPAA Compliance Pack — Agent Guide

## What this pack provides

Three TypeScript modules implementing the HIPAA Security Rule technical safeguards (45 CFR §164.312):

| File | Purpose |
|------|---------|
| `src/encryption.ts` | AES-256-GCM field-level encryption — `encryptPhi`, `decryptPhi`, `generatePhiKey` |
| `src/phi-access.ts` | `withPhiAccess` audit wrapper + `filterByMinimumNecessary` role filter (§164.502(b)) |
| `src/audit-log.ts` | Append-only audit log — `AuditStore` interface, `InMemoryAuditStore`, `AuditEntry` type |
| `docs/HIPAA-controls.md` | §164.312 control-to-file mapping |
| `docs/BAA-template.md` | Business Associate Agreement template (legal review required before use) |
| `validate-hipaa-pack.mjs` | Structural validation — run `pnpm validate` → `"hipaa-pack ok"` |

## First steps after `pnpm install`

1. **Run `pnpm validate`** — confirms required files and key exports are present.
2. **Run `pnpm build`** — `tsc --noEmit` typechecks the full pack; zero errors expected.
3. **Wire `withPhiAccess`** from `src/phi-access.ts` onto every route that reads or writes PHI — the audit row MUST be emitted BEFORE the response returns.
4. **Wire `encryptPhi` / `decryptPhi`** from `src/encryption.ts` on every column storing SSN, DOB, MRN, or free-text clinical notes. Supply a 32-byte key from KMS/Vault — never from env vars in production.
5. **Replace `InMemoryAuditStore`** with a DB-backed append-only store before going to production. The `audit_logs` table must deny UPDATE/DELETE at the DB level (§164.312(c)(2)).
6. **Extend `DEFAULT_PHI_POLICY`** in `src/phi-access.ts` with the product's actual routes and roles.
7. **Emit `docs/BAA-template.md`** as a signed document before production PHI lands — gate the production API behind a signed-BAA state flag.

## Key invariants (do not break)

- `withPhiAccess` calls `store.append(...)` BEFORE invoking the handler — a silently dropped audit row is a §164.312(b) violation.
- Never log PHI values to stdout, JSON logs, or error traces. Pass every logger through a PHI-redaction filter.
- `filterByMinimumNecessary` must run server-side — returning the full row and letting the client discard fields is a §164.502(b) violation.
- Audit retention ≥ 6 years per §164.316(b)(2)(i) — do not TTL audit rows.
- The AES-GCM auth tag detects tampering. If `decryptPhi` throws `PhiEncryptionError`, treat it as a security event, not a normal error.

## Validation

```bash
pnpm validate   # node validate-hipaa-pack.mjs → "hipaa-pack ok"
pnpm build      # tsc --noEmit → exit 0
```
