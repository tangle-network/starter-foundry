# HIPAA Security Rule — Control Surface

This pack implements the technical safeguards of the HIPAA Security Rule
(45 CFR §164.312). Each control below maps to a file in this scaffold.
Admin + physical safeguards (§164.308, §164.310) are process + infrastructure
concerns outside the scope of this pack.

## Technical safeguards covered

| Citation | Control | Implementation |
|---|---|---|
| §164.312(a)(1) | Access control — unique user identification | `src/phi-access.ts` — audit row carries `actorUserId` + `actorRole` |
| §164.312(a)(2)(i) | Emergency access procedure | Operational — document your break-glass process |
| §164.312(a)(2)(iii) | Automatic logoff | Application-layer session timeout (middleware in your framework) |
| §164.312(a)(2)(iv) | Encryption and decryption | `src/encryption.ts` — AES-256-GCM at column level |
| §164.312(b) | Audit controls | `src/audit-log.ts` — append-only; `withPhiAccess` emits before response |
| §164.312(c)(1) | Integrity controls | Audit tag (AES-GCM auth tag) + DB-level append-only constraint on `audit_logs` |
| §164.312(d) | Person or entity authentication | Use your existing auth layer; pack requires `actorUserId` in every call |
| §164.312(e)(1) | Transmission security | TLS 1.2+ on the network layer; not enforced at application level |
| §164.312(e)(2)(i) | Integrity controls (transmission) | TLS + request signing where applicable |
| §164.312(e)(2)(ii) | Encryption (transmission) | TLS required in production |

## Administrative + physical pointers

These live outside this pack but are required for compliance:

- **§164.316(b)(2)(i)** — Retention: documentation ≥ 6 years. Applies to audit logs + policies. Plan storage accordingly.
- **§164.316(a)** — Policies and procedures: you need a written Security Management Process. This is PROSE, not code.
- **§164.308(a)(1)(ii)(A)** — Risk analysis: document + date + sign. Repeat at least annually.
- **§164.404** — Breach notification: 60-day clock from discovery. Incident-response playbook needed.

## Minimum-necessary policy (§164.502(b))

`src/phi-access.ts` exports `DEFAULT_PHI_POLICY` — a map of `table → role →
allowed_fields`. Extend per product. The `filterByMinimumNecessary()`
helper enforces it at the row-shape level so the API never leaks a field
the caller's role shouldn't see.

## De-identification (§164.514)

Two methods are allowed:

1. **Safe Harbor** — remove all 18 specified identifiers. Pack provides a
   stub (`safeHarborRedact()`) — extend for free-text fields.
2. **Expert Determination** — a qualified statistician attests there's
   "very small" risk of re-identification. Requires a signed letter.

Most products use Safe Harbor. If yours does, the redactor must run on
every export + analytics path.

## What this pack does NOT do

- **Authentication**: bring your own (better-auth, clerk, custom JWT).
- **DB-level append-only enforcement**: you must add a trigger or DENY the
  UPDATE/DELETE privileges on the audit table at the DB user.
- **TLS termination**: infra concern; use Cloudflare, AWS ALB, or your own.
- **BAA signature storage**: `docs/BAA-template.md` is the template; store
  signed copies wherever your legal team mandates.
