---
capability: deadline-tracking
status: active
source: IRS Tax Calendar (Pub. 509, 2025)
retrieved: 2026-04-25
---

# Tax Deadline Tracking

Surface upcoming deadlines as `:::deadline` blocks. Each block names
the form, the date, the jurisdiction, and the consequence of missing
it. Track per-user via the bundle's persistence layer (D1 table
`user_filings` keyed by tenant + form-type).

## When to use

Trigger this template when the user asks:

- "When is my tax return due?"
- "Did I miss a deadline?"
- "What's coming up this quarter?"

Or when the bundle's daily cron (`scheduled()` handler in `src/index.ts`)
fires a deadline-check and finds something within 14 days.

## Federal deadlines (2025 tax year)

Each row: form / date / who-it-applies-to / consequence-if-missed.

| Form | Date | Applies to | Penalty if late |
|---|---|---|---|
| 1040 | 2026-04-15 | individuals | Failure-to-file: 5%/mo (max 25%); failure-to-pay: 0.5%/mo |
| 1040-ES Q1 | 2025-04-15 | self-employed / 1099 income | Underpayment penalty (Form 2210) |
| 1040-ES Q2 | 2025-06-16 | same | same |
| 1040-ES Q3 | 2025-09-15 | same | same |
| 1040-ES Q4 | 2026-01-15 | same | same |
| 4868 (extension) | 2026-04-15 | anyone needing more time | Extension to Oct 15; no extension on payment |
| 1120 | 2026-04-15 | C-corps with calendar year | 5%/mo failure-to-file |
| 1120-S | 2026-03-17 | S-corps | $220/mo per shareholder |
| 1065 | 2026-03-17 | partnerships / multi-member LLCs | $220/mo per partner |
| W-2 furnish to employee | 2026-01-31 | employers | $60/form (small biz) escalating |
| 1099-NEC furnish | 2026-01-31 | payers of $600+ | $60/form escalating |
| FBAR (FinCEN 114) | 2026-04-15 | $10k+ foreign accounts | Civil + criminal — escalate to CPA |

## State deadlines

DO NOT enumerate state deadlines from this template — they're per-
jurisdiction and change frequently. When the user asks about state
deadlines:

1. Ask their state
2. Surface the federal-equivalent date as a starting point
3. Recommend they verify the current state-specific date
4. If the user pushes for a specific date, escalate to a CPA

## Quarterly check-in cron

The bundle's `scheduled()` handler runs at 09:00 ET on the 1st and
15th of each month. It:

1. Queries `user_filings` for any form due within 14 days
2. For each found: emits a `:::deadline` block to the user's notification
   channel (email/SMS/web push — whatever the bundle's notification
   layer wires up)
3. Logs the notification to `state/deadline_notifications/`

## Output shape

```
:::deadline
form: 1040-ES Q2
date: 2025-06-16
jurisdiction: federal
applies-to: self-employed-with-est-tax-due
days-until: 14
penalty-if-missed: "Underpayment penalty (Form 2210). Compounds with later quarters."
recommended-action: "Pay via IRS Direct Pay or schedule via your CPA."
:::
```

## Refusal mode

Refuse to:

- Confirm a state deadline you can't cite from the current state-tax
  authority's guidance
- Tell a user the deadline "doesn't apply to them" without explicit
  exemption confirmation
- Recommend filing an extension as a tax-position move (4868 extends
  the FILING deadline only, not the PAYMENT deadline — common
  misconception worth correcting every time)
