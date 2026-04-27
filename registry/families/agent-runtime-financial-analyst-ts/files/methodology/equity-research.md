# Equity Research Template

## Purpose
Produce a concise, defensible equity research report on a public
company — citation-grounded in public filings, with a valuation range
the reader can stress-test. Not investment advice for a real
brokerage account.

## When to use
Trigger when the user asks for a public-company analysis, a thesis
write-up, or a comparison to peers. If the target is private, refuse
and direct to startup-research methodology with appropriate caveats.

## Inputs
- Ticker (and country of listing — `AAPL` US ≠ `AAPL` LSE)
- Period of analysis (TTM by default; specify if historical)
- Comparison set (sector peers, declared by ticker)
- Reader sophistication (institutional / retail / generalist) —
  affects depth of jargon explained

## Method

1. **Filings before opinion.** Pull the most recent 10-K, last
   four 10-Qs, latest 8-Ks for material events, latest proxy (DEF
   14A) for compensation / governance. For non-US issuers, the
   equivalent (20-F, prospectus, regulatory filings).
2. **Earnings transcripts.** Last 4 quarters minimum. Management
   tone, guidance changes, analyst Q&A pressure points.
3. **Reconcile GAAP and non-GAAP.** Many companies report adjusted
   EBITDA with their own bridge. Always show the GAAP number
   alongside; flag adjustments (restructuring, SBC, impairments)
   and apply your own judgment about which to add back.

## Sections

### 1. Business Overview
- What the company sells, to whom, in what geography.
- Revenue mix by segment, by geography, by customer concentration.
- Competitive moats and counter-positioning. Cite specific filings
  where the moat is described or contested.
- Capital structure: total debt, cash, net debt, weighted-avg
  interest rate, maturity wall, credit ratings.

### 2. Industry & Market
- TAM / SAM / SOM with explicit citation (third-party research
  firms — IDC, Gartner, IBISWorld — or company filings if they
  cite their own size). Tag estimates as "company-cited" or
  "third-party."
- Growth rate, secular tailwinds / headwinds, regulatory
  exposure (e.g., FDA, FERC, FCC, antitrust posture).
- Cyclicality: early-cycle, late-cycle, defensive, secular.

### 3. Financial Analysis
- Top-line: revenue growth (YoY, 3y CAGR, 5y CAGR), organic vs
  acquisition, FX impact.
- Profitability: gross margin, operating margin, EBITDA margin,
  net margin, FCF margin. Compare to peers and to the company's
  own history.
- Capital efficiency: ROIC vs WACC, asset turnover, working-capital
  cycle (DSO, DPO, DIO).
- Cash flow quality: OCF / net income, CapEx intensity, FCF
  conversion, share-based compensation as a % of revenue and FCF.
- Balance sheet: net debt / EBITDA, interest coverage, liquidity
  ratios, off-balance-sheet items.

### 4. Valuation
- **DCF** with explicit assumptions: revenue growth, margin path,
  CapEx, working capital, terminal growth, WACC. Sensitivity to
  ±100bps on WACC and ±100bps on terminal growth.
- **Comps**: EV/Revenue, EV/EBITDA, P/E, P/FCF vs sector peers
  and broad market. Flag outliers.
- **Precedent transactions**: relevant M&A multiples in the last
  3–5 years.
- **SOTP** (sum-of-the-parts) where multiple segments warrant
  separate multiples.
- **Output a range, not a point.** Bull / base / bear with
  triggers for each.

### 5. Risks
- Company-specific (product, customer concentration, key-person,
  regulatory action, litigation).
- Industry (competitive intensity, disintermediation, technology
  shift, regulatory).
- Macro (rates, FX, commodity, recession sensitivity).
- ESG / governance (board independence, CEO compensation
  alignment, related-party transactions).

### 6. Catalysts
- Upcoming events: earnings (date), product launches, regulatory
  decisions, contract renewals, capital allocation events
  (buyback, dividend, M&A).
- Quantify expected impact where possible.

### 7. Thesis
- **Base case**: what most likely plays out, with price target
  driven by the base-case DCF / comps midpoint.
- **Bull case**: upside scenario with explicit triggers
  (margin expansion, share gain, multiple re-rating). Price target.
- **Bear case**: downside scenario with explicit triggers (lost
  customer, margin compression, multiple compression). Price
  target.
- Probability-weighted PT if the user wants one number.

## Citation discipline

Every financial number cites its source: 10-K (page X), 10-Q,
earnings call transcript (date), third-party research (firm + date).
Refuse to fabricate revenue, margin, or guidance numbers. If the
filing doesn't disclose, say so plainly.

## Output block

```
:::artifact
template: equity-research
ticker: "..."
as-of: "2026-04-26"
filings-cited: ["10-K 2024", "10-Q Q1 2025", "8-K 2025-04-12"]
financials: { ... }
valuation:
  dcf-range: { low: ..., mid: ..., high: ... }
  multiple-range: { ... }
thesis:
  base: { pt: ..., rationale: "..." }
  bull: { pt: ..., rationale: "..." }
  bear: { pt: ..., rationale: "..." }
risks: [...]
catalysts: [...]
:::
```

## Refusal triggers

- **Not investment advice.** State the disclaimer clearly. The
  agent is generating analysis, not making recommendations for a
  real account.
- **Private company without public data.** Refuse a public-equity
  research format if the company is private; offer
  startup-research methodology with caveats.
- **Material non-public information.** If the user shares MNPI,
  the agent must refuse to incorporate it and warn that trading on
  MNPI is illegal.
- **Specific buy/sell recommendations to a real account.** Frame
  as "thesis" not "recommendation"; explicitly tell the user this
  is research, not a registered investment-advisor opinion.
