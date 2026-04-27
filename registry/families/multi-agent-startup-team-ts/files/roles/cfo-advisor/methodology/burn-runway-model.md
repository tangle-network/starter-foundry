---
capability: burn-runway-model
status: active
source: hand-authored, drawn from David Skok (SaaS metrics) + Mark Suster (default-alive frame) + standard FP&A
retrieved: 2026-04-26
---

# Burn / Runway Model (CFO-Advisor-owned)

A burn / runway model produces a `:::artifact` block tagged
`template: burn-runway-model` containing trailing burn, projected
burn under named scenarios, runway months at each, and the date
the runway alarm fires (T-9 months from zero cash). Sensitivity
tables show how runway changes under +/- assumptions on the two
or three highest-leverage drivers.

The point is not to predict the future. It's to surface **how
many months of optionality the operator has** under realistic vs
stress scenarios, and **what changes that number most**. A model
with no sensitivity is a model that pretends to know what no
model knows.

## When to run

- Monthly close (or weekly close if the operator runs a tighter
  cycle).
- Before any decision that materially changes burn (hire >
  1 person, paid-spend campaign > 1% of monthly burn, multi-month
  vendor commitment, fundraise close).
- Triggered by Friday cron (`0 15 * * 5`) — late-week refresh so
  the operator goes into the weekend with a current number.
- When CEO emits a runway flag in weekly review (runway < 9
  months, or shortened > 1 month vs last review).

## Multi-role data sources

| Input | Source |
|---|---|
| Last month's actuals (revenue, expenses, cash position) | Operator (financials) |
| Hiring plan + comp bands | HR (handoff for joint hiring-plan turn) |
| Engineering infra spend + planned changes | CTO (handoff if architecture decision affects burn) |
| Marketing budget + planned channel experiments | CMO (handoff per experiment) |
| Strategic priority weighting (which scenarios matter) | CEO (you check assumptions against strategy) |

If the data is incomplete, **ask** — do not interpolate. A
plausible-looking model built on missing data is more dangerous
than no model.

## Model structure

### 1. Trailing burn (3-month average)

- Net burn = monthly cash out − monthly cash in.
- Use **3-month trailing average** as the baseline. A single
  month is noisy (one-time payments, refund timing, period-end
  lumps). Three months smooth most of this.
- Distinguish **gross burn** (total expenses) from **net burn**
  (after revenue offset). Both matter; net burn is what depletes
  the bank.

### 2. Cash on hand

- Bank balance + readily-available reserves. Exclude restricted
  cash (escrows, security deposits) — those don't fund operations.
- If the operator has a credit line, list it separately. Lines
  are runway extensions only when actually drawable; verify
  covenants are not blocking.

### 3. Runway (months)

- Runway = cash on hand / net monthly burn.
- Runway should always be quoted with the burn-scenario it
  assumes. "12 months at current burn" — never "12 months."

### 4. Scenarios (at least three)

Run the model under **three named scenarios**:

- **Default-alive (current trajectory).** No revenue
  acceleration, no new hires beyond confirmed offers, no new
  paid spend. The floor scenario.
- **Plan (operator's intended trajectory).** Hiring plan + paid
  spend per the operator's intended quarter. The expected
  scenario.
- **Stress (downside).** Revenue 20% under plan, hiring as
  planned, paid spend as planned. The "what if growth slows"
  scenario.

Some teams add an **upside** scenario; that's optional. The
mandatory three are default-alive, plan, stress — they bound
the operator's optionality.

### 5. Alarm date

- The date the runway hits **T-9 months from zero cash** under
  each scenario. T-9 is the standard fundraise-prep window — at
  T-9 the operator must either be raising, cutting, or in
  default-alive territory.
- Surface the alarm date prominently. "Under the stress
  scenario, the T-9 alarm is March 14." That date drives
  decision-journal entries on Type-1 calls (raise / cut / pivot).

### 6. Sensitivity table

Pick the **two or three highest-leverage drivers** and show how
runway changes:

- **Hiring delta** (e.g. +/- 2 hires in next 90 days).
- **Revenue delta** (e.g. +/- 20% on next-quarter revenue).
- **Major vendor or infra spend** (if pending an architecture
  decision with cost implications).

A sensitivity table that doesn't move runway by ≥ 1 month is a
sensitivity table that picked the wrong drivers — re-pick.

### 7. The two-question close

After the table, write a `:::analysis` block answering:

1. **Which lever moves runway most?** Name it. The operator
   should have it on a sticky note.
2. **What would I tell the CEO to do this week?** One line.
   Concrete. This is the input to the next decision-journal
   entry or weekly-review one-bet.

## Output shape

```
:::artifact
template: burn-runway-model
date: <YYYY-MM-DD>
contributors: [cfo-advisor]
trailing:
  gross-burn-3mo-avg: <usd>
  net-burn-3mo-avg: <usd>
  revenue-3mo-avg: <usd>
cash:
  on-hand: <usd>
  available-credit-line: <usd or null>
scenarios:
  default-alive:
    monthly-net-burn: <usd>
    runway-months: <int>
    alarm-date-t9: <YYYY-MM-DD>
  plan:
    monthly-net-burn: <usd>
    runway-months: <int>
    alarm-date-t9: <YYYY-MM-DD>
  stress:
    revenue-haircut-pct: 20
    monthly-net-burn: <usd>
    runway-months: <int>
    alarm-date-t9: <YYYY-MM-DD>
sensitivity:
  - { driver: hiring-delta, range: "-2 to +2 hires", runway-impact-months: <range> }
  - { driver: revenue-delta, range: "-20% to +20%", runway-impact-months: <range> }
  - { driver: <third>, range, runway-impact-months }
biggest-lever: <one of the drivers>
recommended-this-week: <one line>
:::
```

## Common antipatterns (refuse these)

- **"Best case" hockey stick.** A scenario where everything goes
  right has zero diagnostic value. Stress scenarios are the load
  bearing artifact.
- **Single-point estimates with no sensitivity.** Runway is a
  range, not a number. A model that quotes "14 months" without a
  range is overconfident.
- **Runway quoted without the burn scenario.** "We have 12
  months" is meaningless without "at current burn / at planned
  hiring / under stress." Always pair runway with scenario.
- **One-time items not annualized.** A massive Q4 cash collect
  inflates the trailing-3 number. Smooth or call it out; do not
  let the operator extrapolate from a one-time spike.
- **Hiring plan from HR not reconciled.** HR's slate must
  reconcile to the model's hiring delta. If HR says 4 hires, the
  model better not assume 2.
- **Vendor / infra change from CTO not reconciled.** If CTO is
  about to ship an ADR with material monthly cost, the model
  must include it under "plan."

## Escalation

- **Runway < 6 months** under any scenario → emit `:::escalation`
  recommending the operator immediately re-confirm with their CPA
  AND notify their board. Hand off to CEO for a decision-journal
  entry on cut-vs-raise-vs-pivot.
- **Covenants triggered** on a credit line → emit `:::escalation`
  to operator's lender + corporate counsel. Do not advise on
  remediation.
- **Operator asks "should I take this term sheet" or "should I
  buy/sell this asset"** → emit `:::escalation` to the
  appropriate licensed professional. Do not advise.

## Source

David Skok, SaaS Metrics 2.0 (cohort-driven revenue projection,
unit-economics gates). Mark Suster, "Default Alive vs Default
Dead" (Paul Graham frame, T-9 alarm convention). Standard FP&A
practice (3-month trailing baseline, scenario partition, two-
or-three-driver sensitivity).
