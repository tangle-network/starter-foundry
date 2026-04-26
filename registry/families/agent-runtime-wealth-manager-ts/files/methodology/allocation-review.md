---
capability: asset-allocation-review
status: active
source: Bogleheads three-fund methodology; Vanguard 2025 target-date glidepath; 5/25 rebalancing rule (Larry Swedroe)
retrieved: 2026-04-25
---

# Allocation Review & Rebalancing

A methodology output for evaluating a user's current portfolio against
a target allocation, identifying drift, and describing rebalancing
mechanics. Output ships as a `:::artifact` block marked EDUCATIONAL.
**No buy/sell recommendations. No specific tickers.**

## When to use

Trigger this template when the user asks for:

- "Review my portfolio" / "is my allocation right?"
- "Am I diversified?" / "should I rebalance?"
- "What's a good allocation for my age?"

If the user asks "should I buy/sell X?" — that's a security pick.
Refuse and escalate per system-prompt trigger 1.

## Required user inputs (open `:::question` block first)

Before computing any drift, get from the user:

1. Age (drives glidepath)
2. Time horizon (years until withdrawal begins)
3. Risk tolerance (low / moderate / high — anchored to a max
   acceptable peak-to-trough drawdown: 20% / 35% / 50%)
4. Account-type breakdown (taxable / Traditional IRA-401k / Roth /
   HSA — placement matters for tax efficiency)
5. Current holdings: each position's category (US equity, ex-US
   equity, US bond, ex-US bond, REIT, cash, alts) + market value
6. Anticipated contribution rate (changes the rebalance-via-flow vs.
   rebalance-via-trade decision)

If the user can't answer one, mark `OPEN-QUESTION` and refuse to
compute lines that depend on it.

## Method

### Step 1 — Target allocation

Anchor on age-based equity weight (commonly cited heuristic, not law):
`equity % ≈ 110 − age` for moderate risk tolerance. Adjust:

- Low tolerance: `100 − age`
- High tolerance: `120 − age`, capped at 90%
- Time horizon < 5 years: cap equity at 40% regardless of age

Within equity, the Bogleheads three-fund split:
- US total market: 60% of equity
- Ex-US total market: 40% of equity (developed + emerging)

Within fixed income:
- US aggregate bond: 70% of fixed income
- TIPS or short-duration: 30% of fixed income (inflation hedge,
  weight up if user is in or near withdrawal phase)

### Step 2 — Drift analysis (5/25 rule)

For each asset class, compute current weight vs. target weight.
Flag for rebalance if EITHER:

- **Absolute drift ≥ 5 percentage points** (e.g. target 60% US
  equity, current 66%)
- **Relative drift ≥ 25%** of the target weight (e.g. target 10%
  bonds, current 7.4% — drift = 2.6pp absolute, but 26% relative)

The 5/25 rule catches both large-class drift and small-class drift
that absolute thresholds miss.

### Step 3 — Tax-aware location

Tax-inefficient assets belong in tax-advantaged accounts:
- Taxable bonds → Traditional IRA / 401(k) (interest taxed as
  ordinary income anyway; deferral helps)
- REITs → Traditional IRA / 401(k) (non-qualified dividends)
- US total-market equity → taxable (qualified dividends + step-up
  basis at death)
- Roth → highest expected-return assets (growth never taxed)

Surface mismatches but do not recommend specific moves — describe
the *principle*, escalate the *trade* to a CPA/CFP.

### Step 4 — Rebalance via flow vs. trade

If the user's annual contribution > the dollar drift amount,
recommend rebalancing-via-flow (direct new contributions to
under-weight classes) — this avoids realizing taxable gains.
Otherwise note that a rebalancing trade in a taxable account has
tax consequences (short-term gains taxed at ordinary rates;
long-term at 0/15/20% based on bracket) — this is where the user
needs a CPA in the loop.

## Output shape

```
:::artifact
type: allocation-review
status: EDUCATIONAL — not investment advice
disclaimer: "Investment Advisers Act §202(a)(11): no advisory
  relationship. Consult a fee-only CFP or RIA before acting."
inputs:
  age: <n>
  horizon-years: <n>
  risk-tolerance: <low|moderate|high>
  total-portfolio: $<X>
target-allocation:
  us-equity: <X>%
  ex-us-equity: <X>%
  us-bond: <X>%
  tips-or-short: <X>%
  reit: <X>%
  cash: <X>%
current-allocation:
  us-equity: <X>% [drift: <±X>pp / <±X>% relative]
  ...
flagged-for-rebalance:
  - "<class>: <reason — 5pp absolute or 25% relative>"
location-mismatches:
  - "<class> in <account-type>: <principle violated>"
rebalance-mechanic:
  via-flow-feasible: <yes|no>
  reason: "<contribution rate vs. drift dollars>"
open-questions:
  - "Are any positions concentration > 25%? (escalate if yes)"
  - "Is the user in or near withdrawal? (changes glidepath)"
:::
```

## Refusal mode

Refuse to:

- Name a specific replacement ticker for any class
- Recommend a specific trade size or timing
- Comment on whether the user's current adviser's fees are reasonable
- Project future returns of any single holding

If the user pushes for any of the above, emit `:::escalation` with
the trigger cited and a fee-only-CFP-finder pointer (NAPFA, Garrett
Planning Network, XY Planning Network).
