# Financial Modeling Template

## Purpose
Build a three-statement financial model (income statement, balance
sheet, cash flow) tied together with a DCF valuation. The model
should reconcile, be auditable line-by-line, and let a reader
stress-test assumptions.

## When to use
Trigger when the user asks for a model build or rebuild, an LBO, an
M&A merger model, a budget vs actuals frame, or a forecast for a
real planning exercise. If the user just wants a back-of-envelope
DCF, say so and offer the lighter format.

## Inputs
- ≥3 years of audited annual financials (10-K) plus 4–8 quarters of
  interim (10-Q) — without this, the model has no calibration.
- Forward guidance from the company (when public).
- Industry assumptions: secular growth, margin trajectory, capex
  intensity.
- Discount rate inputs: risk-free rate, market risk premium, beta
  (levered and unlevered), cost of debt, tax rate, target capital
  structure.
- Scenario constraints (base / bull / bear with named triggers).

## Method

1. **Historicals first.** Lay out 3–5 years of historical IS, BS, CF
   on the same sheet, sourced cell-by-cell from the filings. Tie
   each line back to the 10-K page or table for audit. Calculate the
   ratios that drive the projection (revenue growth, margins, DSO,
   DIO, DPO, CapEx-to-revenue, D&A-to-CapEx).
2. **Revenue build.**
   - **Top-down**: TAM × share × ASP. State the TAM source.
   - **Bottom-up**: units × price, by segment. Cite where the unit
     count comes from (filings, channel data, primary research).
   - **Subscription**: cohort retention × ARPU × cohort count, with
     net-dollar-retention as a check.
   Pick one method, document the alternative as a sanity check.
3. **Cost projection.**
   - COGS as % of revenue, with mix-shift adjustments.
   - OpEx by function: R&D, S&M, G&A. Use historical % of revenue
     as a baseline and shift only with stated rationale.
   - Hold the implied operating leverage explicit: "as revenue
     grows X%, S&M grows Y%, so margin expands by Z bps."
4. **Working capital.** Project DSO, DIO, DPO from history; convert
   to AR, inventory, AP balances. Working-capital changes flow into
   cash from operations.
5. **CapEx and D&A.**
   - CapEx as % of revenue with maintenance vs growth split if
     possible.
   - D&A as % of prior-year gross PP&E, or roll the schedule.
   - Reconcile that long-run CapEx and D&A converge unless the
     company is in a deliberate ramp.
6. **Balance sheet plug.** Cash and revolver as the balancing items
   after building IS, CF, and the BS roll-forwards. The balance
   sheet must balance every year — if it doesn't, the cash flow has
   a sign error or a working-capital mistake.
7. **Cash flow statement.** Start from net income, add back non-cash
   (D&A, SBC, deferred tax, impairment), subtract WC changes,
   subtract CapEx, plus/minus financing (debt, equity, dividends).
8. **WACC.** Cost of equity from CAPM (`Rf + β × MRP`), cost of debt
   from current YTM on the company's debt or comparable rated debt,
   weighted by target capital structure. Show inputs.
9. **DCF.**
   - Project unlevered FCF for 5–10 years.
   - Terminal value via Gordon Growth (`FCF × (1+g) / (WACC – g)`)
     and Exit Multiple. Show both; reconcile if they diverge by
     >25%.
   - Discount each year's FCF + TV by WACC; sum to enterprise
     value; subtract net debt → equity value; divide by shares
     out → price per share.
10. **Sensitivity tables.** WACC × terminal growth (2D), WACC ×
    revenue growth, margin × multiple. Show the cells where the
    valuation flips bull / base / bear.
11. **Cross-checks.**
    - Implied EBITDA multiple at the DCF target vs comps.
    - Implied IRR for a holder buying today and exiting in year 5
      at the DCF price.
    - Implied P/E at the DCF target vs historical and peer.

## Output

- A model file (Excel / Sheets / Python notebook) with: assumptions
  block, historicals, projections, three statements, DCF, sensitivity.
- Documentation of every non-obvious assumption with source.
- A summary slide: base / bull / bear, key drivers, sensitivity
  diamond.

```
:::artifact
template: financial-modeling
ticker: "..."
historicals-period: "2021–2024"
projection-period: "2025–2030"
revenue-build: "top-down: TAM=$120B, share 2026 = 4%, ASP=$..."
wacc: 9.4
terminal-growth: 2.5
dcf-base-pt: $...
sensitivity:
  wacc-x-terminal-growth: [...]
:::
```

## Common modeling failures

1. **Balance sheet doesn't balance.** Hide-the-error with a "plug"
   that grows over time. Find the sign error.
2. **Revenue projection without driver.** "10% growth" is not a
   model — it's a slope. State the underlying mechanism.
3. **Margin assumptions out of touch with operating leverage.**
   Steady-state margins should reconcile with peer benchmarks.
4. **Terminal value > 80% of EV.** Terminal-heavy DCFs are
   driven by the perpetuity assumption; either extend the explicit
   period or document why TV is structurally large.
5. **WACC wrong.** Using a generic "9% discount rate" without CAPM
   build is sloppy and misleads the reader.
6. **No sensitivity.** Single-point valuations look false-precise.
   Always show the 3D sensitivity surface or at least a 2D table.
7. **Off-balance-sheet items skipped.** Operating leases (post
   ASC 842), pension liabilities, contingent considerations all
   matter for EV bridge.

## Refusal

- Refuse to build a model with <3 years of history.
- Refuse to fabricate guidance that the company hasn't issued.
- Refuse to deliver a model presented as investment advice for a
  real account — frame as analysis, not recommendation.
- If the user asks for a model that incorporates material
  non-public information, refuse and warn about trading
  prohibitions.
