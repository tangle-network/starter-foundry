# HIPAA compliance surface for starter-foundry-healthcare

This file is the committed record of the compliance controls this scaffold
implements. It is NOT a legal document — work with counsel before storing real
PHI. Before shipping, every checkbox below must be a real Yes.

## Technical safeguards (45 CFR 164.312)

| Control | Scaffold implementation | Production gap |
| ------- | ---------------------- | -------------- |
| Access control — unique user ID (a)(2)(i) | X-Actor-Id header; real auth layer in `auth:` slot | Wire Clerk/better-auth/mTLS |
| Automatic logoff (a)(2)(iii) | Session TTL set in auth layer | Verify in prod config |
| Encryption at rest (a)(2)(iv) | AES-256-GCM via `src/encryption.ts`, one random IV per field | Move key to KMS (envelope encryption) |
| Audit controls (b) | Append-only `audit_logs` + trigger blocks UPDATE/DELETE | Ship logs to SIEM with 6-year retention |
| Integrity controls (c)(2) | GCM auth tag on every PHI field | N/A |
| Transmission security (e)(1) | Postgres `ssl: 'require'` in `src/db/client.ts` | Terminate TLS 1.2+ at ingress; disable HTTP |

## Administrative safeguards (45 CFR 164.308)

- **BAA with every subprocessor** before real PHI is stored. List: cloud provider, managed Postgres, email, error tracking, APM, log aggregator, CI provider.
- **Workforce training** on phishing, ePHI handling, breach reporting.
- **Incident response plan** with breach notification paths (HHS + affected individuals within 60 days per 164.404).
- **Risk analysis** documented annually; re-run after any architecture change.

## Physical safeguards (45 CFR 164.310)

- Production PHI only in HIPAA-eligible cloud regions with BAAs in place.
- No PHI on developer laptops. Staging + dev use synthetic data only.

## Minimum-necessary rule (164.502(b))

API responses are filtered by actor role:

- `clinician`, `admin` — full PHI
- `billing` — codes + demographics, NO notes / NO SSN
- `patient` — own records only (enforce via resource-ownership check in the handler — this starter does NOT implement that)

## Audit log invariants

- Every read of a patient or encounter writes one row BEFORE the response is sent.
- `audit_logs` has NO UPDATE / DELETE grants in production. The migration sets up a trigger that raises on attempts.
- Audit rows include `actorId`, `actorRole`, `action`, `resourceType`, `resourceId`, `reason`, `ipAddress`, `userAgent`, `occurredAt`.

## Break-glass & deletion

- HIPAA right of access (164.524): implement `GET /api/patients/:id/export` (not shipped in starter — add per your workflow).
- Right to amend (164.526) — use an `amendments` table referencing the original encounter; do NOT overwrite.
- Accounting of disclosures (164.528) — the audit log already satisfies this.

## Cryptographic key management

- `PHI_ENCRYPTION_KEY` is a 32-byte key (hex or base64 encoded).
- Rotate annually or after suspected compromise. Rotation strategy:
  1. Load old key + new key.
  2. Re-encrypt each PHI column in a background job.
  3. Remove old key from secret store.
- In production, use envelope encryption: a per-tenant data key encrypted by a KMS CMK. Replace `loadKey()` in `src/encryption.ts` with a KMS-backed resolver.

## What this scaffold does NOT do

- No row-level security. Add Postgres RLS policies per-tenant before multi-tenant prod.
- No API rate limiting. Enumeration attacks on `/api/patients/:id` are cheap without it.
- No patient-portal auth flow. Use the `auth:` slot + add a resource-ownership check.
- No BAA with any subprocessor. That's a business / legal step.
- No PHI export pipeline. Design per your workflow.
