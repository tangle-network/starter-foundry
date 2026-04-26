---
capability: retirement-projection
status: active
source: Bengen 1994 (4% rule original); Trinity Study (Cooley/Hubbard/Walz 1998 + 2011 update); Pfau & Kitces 2014 (rising-equity glidepath); Milevsky on sequence-of-returns risk
retrieved: 2026-04-25
---

# Retirement Projection

A methodology output for sanity-checking a user's retirement plan
against the published withdrawal-rate literature, running a Monte
Carlo with assumptions surfaced, and stress-testing against
sequence-of-returns risk. Output ships as a `:::artifact` block
marked EDUCATIONAL. **No specific "you'll have $X at age Y"
promise. No specific withdrawal-rate prescription.**

## When to use

Trigger this template when the user asks for:

- "Can I retire at <age>?" / "am I on track?"
- "How much do I need to retire?"
- "Is the 4% rule still valid?"
- "What's my safe withdrawal rate?"

If the user asks "what should my Roth conversion amount be in
2026?" — that's specific tax advice. Refuse and escalate per
system-prompt trigger 3.

## Required user inputs (open `:::question` block first)

1. Current age + planned retirement age + planned end-of-plan age
   (90 is a common floor; 100 for plans that need to survive
   longevity)
2. Current portfolio value + annual contribution + expected
   contribution growth
3. Target real (inflation-adjusted) annual spend in retirement
4. Pension / Social-Security expected annual income (and start
   age — claiming-age has its own optimization the agent does not
   touch)
5. Asset allocation (drives expected return + volatility
   assumptions)
6. Tax bracket in retirement (taxable-account spend is grossed up
   for tax)

## Method

### Step 1 — 4% rule sanity check

Bengen 1994 / Trinity 1998: a 4% initial withdrawal rate (adjusted
for CPI annually), from a 50/50 to 75/25 stock/bond portfolio,
survived 30 years in 95%+ of historical US rolling periods.

Compute:
- `target-portfolio-at-retirement = annual-spend / 0.04`
  (the 25× rule, the inverse of 4%)
- Compare to projected portfolio at retirement age using the
  user's contributions + expected return

State the caveats explicitly:
- 4% is a **historical** US-equity-heavy result; forward-looking
  research (Pfau, Morningstar 2024) suggests 3.0–3.7% is a more
  defensible safe rate given current valuations and bond yields
- The 4% rule does NOT survive a 50-year horizon (FIRE crowd) —
  Bengen's window was 30 years
- It assumes US-only equity history; non-US history is worse

### Step 2 — Monte Carlo projection

Simulate N=5,000 trials of portfolio paths from current age to
end-of-plan age. For each year:

- Sample real return from a distribution matching the user's
  allocation. Conservative defaults:
  - 100% equity: μ=5.5% real, σ=18%
  - 60/40: μ=4.0% real, σ=11%
  - 40/60: μ=3.0% real, σ=8%
- Add contribution (pre-retirement) or subtract real spend net of
  pensions/SS (post-retirement)
- Apply Social-Security as a real annuity starting at the user's
  claim age

Report:
- **Success rate** (% of trials where portfolio > $0 at end-of-plan)
- **Median terminal value**
- **5th-percentile terminal value** (the bad-case to actually plan
  around)
- **Median portfolio at retirement date**

Surface assumptions as part of the artifact. A success rate of
"95%" with bad assumptions is worse than 70% with conservative
ones.

### Step 3 — Sequence-of-returns risk

The single biggest hidden risk in any projection: a bad return
sequence in the **first 5–10 years of withdrawal** can sink a
plan that the same returns in reverse order would have funded
comfortably. Pfau-Kitces "rising-equity glidepath" (2014):
counter-intuitively, *increasing* equity through retirement
reduces tail risk because early-retirement bonds buffer the
sequence.

Stress test by re-running Monte Carlo conditioned on:
- "First 5 years return = 10th-percentile of historical returns"
- "First 10 years return = 25th-percentile"

Report success rates under stress. If stress success < 70%, flag
sequence risk as a planning gap and surface mitigation
*concepts* (cash buffer, rising-equity glide, dynamic
withdrawal — Guyton-Klinger guardrails) — not specific
prescriptions.

### Step 4 — Sensitivity analysis

Show how success rate moves with ±1pp on each lever:
- Real return assumption (±1pp)
- Annual spend (±10%)
- Retirement age (±2 years)
- Contribution rate (±2pp of income)

The largest-elasticity lever is usually the most actionable for
the user.

## Output shape

```
:::artifact
type: retirement-projection
status: EDUCATIONAL — not investment advice; assumptions surfaced
disclaimer: "Investment Advisers Act §202(a)(11): projection is
  illustrative, not a promise. Past returns do not predict
  future results. Consult a fee-only CFP."
inputs:
  current-age: <n>
  retire-age: <n>
  end-age: <n>
  current-portfolio: $<X>
  annual-contribution: $<X>
  target-real-spend: $<X>
  allocation: <X>/<Y>/<Z>
assumptions:
  equity-real-return: <X>%
  bond-real-return: <X>%
  inflation: <X>%
  social-security-start: <age>
four-percent-check:
  target-portfolio-25x: $<X>
  projected-portfolio-at-retirement: $<X>
  gap: $<X>
monte-carlo:
  trials: 5000
  success-rate: <X>%
  median-terminal: $<X>
  fifth-percentile-terminal: $<X>
sequence-risk:
  stress-success-first-5-poor: <X>%
  stress-success-first-10-poor: <X>%
  flag: <none|sequence-risk-material>
sensitivity:
  return-+1pp: <X>% success
  return-−1pp: <X>% success
  spend-+10%: <X>% success
  retire+2yr: <X>% success
open-questions:
  - "Is target-spend pre- or post-tax?"
  - "Are you including LTC / unexpected medical costs?"
  - "What's your cash-buffer plan for the first 2 years of
    retirement spend?"
:::
```

## Refusal mode

Refuse to:

- Promise a specific terminal value ("you'll have $2.4M")
- Recommend a specific withdrawal rate ("you can safely take 4.2%")
- Recommend a specific Social-Security claim age (CFP/SS-claiming
  software territory)
- Recommend a specific Roth-conversion amount or year (CPA territory)
- Issue a "you can retire" / "you can't retire" verdict

If the user pushes for any of the above, emit `:::escalation`
citing the Investment Advisers Act + the specific trigger, with
a fee-only-CFP-finder pointer (NAPFA, Garrett Planning Network).
