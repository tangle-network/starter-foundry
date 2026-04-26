---
capability: filing-drafting
status: active
source: IRS Form 1040 Instructions (2025 tax year)
retrieved: 2026-04-25
---

# Drafting an Individual 1040 Return

A draft return ships as a `:::filing` block with: identifying header,
income summary, adjustments, deductions, tax computation, payments,
refund/owed, and a "must review" list of items the human filer or
their CPA must verify before signing. **Drafts are never final.**

## When to use

Trigger this template when the user asks for:

- "Help me with my 1040" / "draft my federal return"
- "What does my tax look like for <year>?"
- "Walk me through filing as <single|married|HoH>"

If the user is asking for a state return, defer — state forms vary
and the federal-only template doesn't cover them. Surface the gap and
ask whether the user wants a federal-only draft + a CPA referral for
state.

## Required user inputs (open `:::question` block first)

Before drafting any computed line, get from the user:

1. Filing status (single / MFJ / MFS / HoH / QW)
2. Number of dependents + their relationship + SSN-on-file (don't ask
   for the SSN; ask "do you have it?")
3. W-2 income (employer + box 1 + box 2)
4. 1099-NEC / 1099-MISC / 1099-K income (each: payer + amount)
5. 1099-INT / 1099-DIV (interest + dividend income)
6. Retirement contributions (traditional IRA / 401k pre-tax)
7. Standard or itemized? If itemized: ask for the categories below
8. Estimated tax payments made for the year (quarterly amounts)

If the user can't answer one of these, mark it as `OPEN-QUESTION` in
the draft and refuse to compute lines that depend on it.

## Method (in order)

1. **Income section.** Sum W-2 box 1 → Line 1a. 1099 income → Schedule
   C if NEC for self-employment, Schedule 1 line 8 otherwise.
   Interest → Line 2b, Dividends → Line 3b.
2. **Adjustments.** IRA deduction (only if eligible — phase-outs by
   income); HSA contributions; self-employment tax deduction (half of
   SE tax from Schedule SE).
3. **AGI** = Income - Adjustments → Line 11.
4. **Standard or itemized.** Standard: 2025 single $15,000, MFJ
   $30,000, HoH $22,500. Itemized: SALT cap $10k, mortgage interest,
   charitable. Pick the larger.
5. **QBI deduction** (Schedule 199A) if 1099 income, with phase-out
   thresholds.
6. **Taxable income** = AGI - deductions - QBI → Line 15.
7. **Tax** from the tax tables (2025 brackets — re-check the
   `retrieved` date in this template's frontmatter; bump if stale).
8. **Credits.** Child Tax Credit ($2,000/child phased out), EITC if
   eligible, education credits, retirement contribution credit.
9. **Other taxes.** Schedule 2 — SE tax, additional Medicare, NIIT
   (3.8% on investment income above thresholds).
10. **Payments.** W-2 box 2 + 1099 withholding + estimated tax paid.
11. **Refund/owed.** Tax - Credits - Payments. Positive = owed.

## Citation discipline

Every numeric line in the `:::filing` block MUST cite a source row.
Acceptable forms:

- `[1040 line 1a, from W-2 box 1: Acme Corp $85,234]`
- `[Schedule 1 line 8a, from 1099-NEC: Freelance LLC $12,400]`
- `[Schedule A line 8a, SALT cap: $10,000 (capped from actual $14,200)]`

If you can't cite, you can't compute. Add it to OPEN-QUESTIONS.

## Output shape

```
:::filing
form: 1040
year: 2025
status: DRAFT — review by CPA required before signing
identifying:
  filing-status: <single|mfj|...>
  dependents: <n>
income:
  - line-1a (wages):  $X  [W-2 box 1 — <employer> $X]
  ...
adjustments:
  ...
agi: $X
standard-or-itemized: <amount>
taxable-income: $X
tax: $X
credits: $X
other-taxes: $X
payments: $X
refund-or-owed: ±$X
open-questions:
  - "Did you contribute to an HSA?"
  - "Do you have 1099-K from payment processors?"
must-review:
  - QBI-eligible income classification (Sched C vs. wages)
  - State return (out of scope here)
:::
```

## Refusal mode

Refuse to:

- Sign or "finalize" the draft
- Compute lines without input data (use OPEN-QUESTIONS)
- Recommend a tax position you can't cite from current IRS guidance
- Provide audit defense advice (legal territory — `refusal-protocol.md`)
