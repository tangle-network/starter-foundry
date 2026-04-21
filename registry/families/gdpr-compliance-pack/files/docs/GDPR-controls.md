# GDPR + CPRA — Control Surface

This pack produces the artifacts an EU (GDPR) or California (CPRA) regulator
will look for. The process obligations (DPO designation, DPIA approvals,
Art. 33 breach notification) are operational — not shipped as code.

## GDPR articles covered

| Article | Control | Artifact |
|---|---|---|
| Art. 5 | Principles of processing | Legal-basis tagging in `data-inventory.ts` |
| Art. 6 | Lawful basis | `data-inventory.ts` category legalBasis |
| Art. 7 | Conditions for consent | `consent.ts` — withdrawable, affirmative, evidence |
| Art. 12 | Transparent info | Privacy policy + consent banner |
| Art. 13/14 | Information at collection | Privacy policy page (consumer ships) |
| Art. 15 | Right of access | `data-subject-rights.ts` — collectExport |
| Art. 16 | Right to rectification | Consumer's profile edit UI |
| Art. 17 | Right to erasure | `data-subject-rights.ts` — honorErasure + Art. 17(3) exceptions |
| Art. 20 | Right to data portability | collectExport produces JSON (machine-readable) |
| Art. 21 | Right to object | Consumer wires to erasure with basis='objection-art-21' |
| Art. 25 | Data protection by design | Minimum-necessary filtering + essential-only default consent |
| Art. 30 | Record of processing activities | `data-inventory.ts` — RoPA shape + validator |
| Art. 32 | Security of processing | TLS + encryption-at-rest (infra) |
| Art. 33/34 | Breach notification | Operational — 72-hour clock; template in docs/ |
| Art. 35 | DPIA | `docs/DPIA-template.md` |

## CPRA parallel obligations

- **Right to know** (§1798.100) — covered by Art. 15 export surface.
- **Right to delete** (§1798.105) — covered by Art. 17 erasure surface.
- **Right to opt-out of sale** (§1798.120) — CA-specific; wire a separate toggle in settings.
- **"Do not sell my personal information" link** — render at site footer.
- **Right to correct** (§1798.106) — consumer's profile edit UI.
- **Non-discrimination** (§1798.125) — don't charge different prices for users exercising rights.

## Consent — the six requirements of Art. 4(11)

1. **Freely given** — not tied to service access unless consent is strictly necessary.
2. **Specific** — per-category granularity (analytics ≠ marketing).
3. **Informed** — privacy policy referenced + readable.
4. **Unambiguous** — explicit opt-in, no pre-ticked boxes.
5. **Affirmative action** — click, not scroll or "continue by staying on the page."
6. **Withdrawable** — one-click via banner or settings; as easy as giving consent.

## 30-day SLA on DSR requests

Art. 12(3) — respond within 1 month. Extend by ≤2 months for complex requests if you notify the subject within the first month.

## Legitimate interest — document the LIA

If you use Art. 6(1)(f) as a legal basis, you MUST have a written Legitimate
Interest Assessment. The assessment has three parts:

1. **Purpose test** — what's the legitimate interest?
2. **Necessity test** — is processing necessary to achieve that interest?
3. **Balancing test** — does the interest override the subject's rights?

Reference the LIA from `data-inventory.ts` via `liaReference`.

## International transfers

- **EU → US**: use the EU-US Data Privacy Framework (DPF) — supersedes Privacy Shield.
- **EU → other**: use Standard Contractual Clauses (SCCs) + a Transfer Impact Assessment (TIA).
- **UK → elsewhere**: use the UK International Data Transfer Agreement (IDTA) or the EU SCCs with the UK addendum.
- Document the safeguard in `data-inventory.ts` via `internationalTransfer.safeguard`.
