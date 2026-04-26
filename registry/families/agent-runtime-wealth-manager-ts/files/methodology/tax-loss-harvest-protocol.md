---
capability: tax-loss-harvesting
status: active
source: IRC §1091 (wash sale); IRS Publication 550 (Investment Income and Expenses); Revenue Ruling 2008-5
retrieved: 2026-04-25
---

# Tax-Loss Harvesting Protocol

A methodology output for identifying lots with unrealized losses in
a taxable account, evaluating wash-sale exposure, and describing
the *category* of replacement security to maintain market exposure
during the 30-day window. Output ships as a `:::artifact` block
marked EDUCATIONAL. **No specific replacement tickers. No trade
sizing. No final harvest call.**

## When to use

Trigger this template when the user asks for:

- "Should I tax-loss harvest?" / "harvest my losses"
- "How does TLH work?" / "wash-sale rule"
- "Year-end tax moves" (in the harvesting context)

If the user asks "what should I sell and what should I buy as the
replacement ticker?" — that's an actionable trade recommendation.
Refuse and escalate per system-prompt trigger 2.

## Required user inputs (open `:::question` block first)

1. Account type (TLH only meaningful in **taxable** accounts —
   IRAs / 401(k)s have no realized-loss benefit and an IRA wash-sale
   permanently disallows the loss per Rev. Rul. 2008-5)
2. Filing status + marginal ordinary-income rate + LTCG rate
3. Lot-level cost basis + acquisition date for each position with
   an unrealized loss (long-term vs. short-term matters)
4. Any purchases of the same or "substantially identical" security
   in the **30 days before** the contemplated sale, in **any
   account** (taxable, IRA, spouse's IRA — all count)
5. Any pending dividend reinvestments scheduled to land within the
   31-day window after sale
6. State of residence (some states don't conform to federal
   capital-loss treatment)

If any of these is missing, mark `OPEN-QUESTION`. Wash-sale
analysis without complete buy-history data is dangerous — refuse
to proceed.

## Method

### Step 1 — Identify candidate lots

For each position, compute lot-level unrealized P&L:
`unrealized = current price × shares − cost basis`

Flag lots with unrealized loss meeting BOTH:
- Absolute loss ≥ $500 (below this, transaction friction wipes the
  benefit)
- Loss as % of position basis ≥ 5% (avoids harvesting noise)

Sort by short-term first (offsets ordinary income up to $3,000/yr
deduction limit, then carries forward), then long-term (offsets
LTCG, then ordinary up to $3,000).

### Step 2 — Wash-sale window check (IRC §1091)

The wash-sale rule disallows a loss if, within **30 days before or
after** the sale, the taxpayer:

- Buys the **same** security
- Buys a **substantially identical** security
- Acquires it in a **fully taxable exchange**
- Acquires a **contract or option** to buy it
- Has it acquired in **any account they control** (including IRA
  per Rev. Rul. 2008-5 — and the loss is *permanently* disallowed
  in this case, not merely deferred)

The window is **61 calendar days total** (30 before + sale day +
30 after). Spouse's accounts and entities the taxpayer controls
count.

For each candidate lot, scan the user-provided buy history within
±30 days. Flag any exposure as `WASH-SALE-RISK`.

### Step 3 — Replacement security (category, not ticker)

To maintain market exposure during the 30-day window, the user
needs a security that is **not substantially identical**. The IRS
has not published a bright-line "substantially identical" test
for ETFs/funds — the conservative view (and the only view this
agent will state):

- Different index → not substantially identical (e.g. S&P 500
  fund → total US market fund: different index, different
  constituents, different weights)
- Same index, different issuer → **probably substantially
  identical** (two S&P 500 funds from different issuers track the
  same underlying basket; conservative practitioners avoid this)
- Single stock → no truly equivalent replacement; harvesting
  single names usually means going to cash for 31 days

Describe the *category* of acceptable replacement (e.g. "a total-
US-market index fund tracking a different index than the
harvested S&P 500 fund"). **Never name a specific ticker.** That's
the line between methodology and security selection.

### Step 4 — Tax benefit estimation

Approximate harvest benefit:
- Short-term loss × marginal-ordinary-rate (up to $3,000/yr
  against ordinary income, remainder carries forward)
- Long-term loss × LTCG rate (offsets LTCG first, then up to
  $3,000 against ordinary income)

State the assumption clearly: harvest benefit is real only if the
user has gains to offset (now or in future years). For someone
permanently in the 0% LTCG bracket, harvesting *long-term* losses
may be value-destructive (resets basis lower for no offset).

### Step 5 — Re-entry plan

After the 31-day window closes, the user can repurchase the
original security if they want. Note that the harvested cost
basis is not preserved on the replacement — selling the
replacement realizes its own gain/loss.

## Output shape

```
:::artifact
type: tax-loss-harvest-protocol
status: EDUCATIONAL — not investment advice; not tax advice
disclaimer: "Investment Advisers Act §202(a)(11) + IRC §1091:
  wash-sale analysis depends on the user's complete buy history
  across ALL accounts (incl. spouse + IRA). Consult a CPA before
  executing."
inputs:
  account-type: <taxable|...>
  marginal-ordinary-rate: <X>%
  ltcg-rate: <X>%
candidate-lots:
  - position: <class>
    lot-id: <id>
    acquired: <date>
    unrealized-loss: $<X>
    short-or-long: <st|lt>
    wash-sale-risk: <none|flagged: reason>
replacement-category:
  - description: "<index-different fund of same broad category>"
    NOT-A-TICKER: true
estimated-benefit:
  short-term-offset: $<up to 3000>
  long-term-offset: $<X>
  carry-forward: $<X>
open-questions:
  - "Any buys of same/identical security in last 30 days, any
    account, including spouse's IRA?"
  - "Pending dividend reinvestments in the 31-day post-window?"
  - "Are you in the 0% LTCG bracket? (if yes, LT harvesting may
    destroy value)"
:::
```

## Refusal mode

Refuse to:

- Name a specific replacement ticker
- Confirm two specific funds are "not substantially identical"
  (this is a fact-and-circumstances IRS judgement; CPA territory)
- Estimate harvest benefit without complete buy history
- Recommend harvesting in an IRA (the loss is permanently
  disallowed — value-destructive)
- Suggest harvesting around an upcoming distribution date
  without surfacing the wash-sale risk

If the user pushes, emit `:::escalation` with the IRC §1091 +
Rev. Rul. 2008-5 citation and a CPA-finder pointer.
