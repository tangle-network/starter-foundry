# GDPR Compliance Pack — Agent Guide

## What this pack provides

Four TypeScript modules + one React component implementing the core GDPR / CPRA obligations:

| File | Purpose |
|------|---------|
| `src/consent.ts` | Art. 4(11) consent primitives — `ConsentRecord`, `InMemoryConsentStore`, `validateConsentRequest` |
| `src/data-subject-rights.ts` | Art. 15 export (`collectExport`) + Art. 17 erasure (`honorErasure`) with documented exceptions |
| `src/data-inventory.ts` | Art. 30 Record of Processing Activities (RoPA) — `EXAMPLE_ROPA`, `validateRoPA` |
| `src/components/CookieBanner.tsx` | GDPR-compliant cookie banner — consent BEFORE non-essential cookies, opt-in only |
| `docs/GDPR-controls.md` | Article-by-article control mapping |
| `docs/DPIA-template.md` | Art. 35 Data Protection Impact Assessment template |

## First steps after `pnpm install`

1. **Run `pnpm validate`** — confirms all required files and key exports are present.
2. **Run `pnpm build`** — `tsc --noEmit` typechecks the full pack; zero errors expected.
3. **Wire consent store** — replace `InMemoryConsentStore` with a DB-backed implementation before production.
4. **Mount API routes** in your framework:
   - `POST /api/consent` → `validateConsentRequest` + `store.record(...)`
   - `GET  /api/export-my-data` → `collectExport(userId, collectors)` — must respond within 30 days (Art. 12(3))
   - `POST /api/delete-my-data` → `honorErasure(request, erasers, retentionChecks)`
5. **Drop `<CookieBanner>`** at root layout — pass `policyVersion` matching your privacy notice version so the banner re-surfaces on policy changes.
6. **Extend `EXAMPLE_ROPA`** in `src/data-inventory.ts` with your actual data categories, legal bases, and retention periods.

## Key invariants (do not break)

- Consent must be **affirmative** — pre-ticked boxes are invalid (Art. 4(11)). `validateConsentRequest` enforces this.
- `honorErasure` checks `retentionChecks` before erasing — pass all Art. 17(3) exception checkers here.
- `collectExport` fans out to per-category collectors and wraps errors in `{ __error }` rather than failing the whole export.
- `CookieBanner` reads `localStorage` for prior consent; it re-shows if `policyVersion` changes.

## Validation

```bash
pnpm validate   # node validate-gdpr-pack.mjs → "gdpr-pack ok"
pnpm build      # tsc --noEmit → exit 0
```
