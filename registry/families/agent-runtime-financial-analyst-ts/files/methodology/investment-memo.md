# Investment Memo Template

## Purpose
Frame an investment thesis for a specific opportunity in the format
that institutional investment committees actually use. The memo's
job is to be falsifiable: if X happens, the thesis is wrong; if Y
happens, it's right. Vague memos are useless memos.

## When to use
Trigger when the user is preparing for an investment committee, a
partner sit-down, or wants to articulate a thesis before discussing
with a colleague. Not for casual market commentary.

## Inputs
- Asset (public ticker, private deal, fund, project)
- Strategy bucket (long, short, event-driven, growth, value, special
  situations)
- Holding period assumption
- Position sizing intent (if relevant — drives risk-budget framing)

## Sections (use this exact skeleton)

### 1. Executive Summary

One paragraph. Three sentences:
1. What we are doing (long X / short Y / fund Z) at what price.
2. Why now (catalyst-driven or thesis-driven, with the key
   insight in 10 words).
3. Expected return + holding period + key risks.

If the executive summary requires more than 4 sentences to be clear,
the thesis is not yet sharp enough to memo.

### 2. Opportunity

- What is being invested in. Capital structure (which class of
  security at which seniority).
- Entry conditions: price, size, timing.
- Why this opportunity exists (mispricing thesis): structural reason
  the market is wrong (forced selling, complexity, neglect, hidden
  asset, regulatory dislocation, market-cap orphan, recent
  spin-off, etc.). "Cheap on multiples" is not a thesis — it's a
  screen.

### 3. Business Model & Unit Economics

- Revenue model and pricing power.
- Unit economics: contribution margin per unit, CAC, LTV, payback,
  retention curves.
- Operating leverage: where does each incremental dollar of revenue
  go?
- Capital intensity: maintenance vs growth CapEx.
- Cash conversion: what fraction of accounting earnings becomes
  free cash?

### 4. Market & Competitive Landscape

- TAM with citation, growth rate, structural drivers.
- Competitive position: who else is in the market, market share,
  moat (cost, network, brand, regulatory, switching cost).
- Counter-positioning risk: who could disrupt, on what timeline.
- Channel structure: who controls distribution.
- Regulatory exposure (current and pending).

### 5. Valuation

- Method (DCF, comps, SOTP, NAV, replacement cost, asset value).
- Inputs and ranges.
- Implied entry multiple and how it compares to peers and history.
- Expected return: base / bull / bear, with probability weights and
  triggers for each scenario.
- Margin of safety: how wrong can we be on each input before the
  thesis breaks?

### 6. Risks

Top 3–5 risks, each with:
- Description
- Probability (low / medium / high — with reasoning)
- Impact on thesis (bps of NAV at risk, or "thesis-breaking" tag)
- Mitigant (hedge, position-sizing, stop, monitoring trigger)
- What we'd see if it's happening (early-warning indicator)

### 7. Catalysts

- Identified events in the next 12–24 months that drive the thesis:
  earnings, guidance, contract renewals, regulatory decisions, M&A,
  capital allocation events, customer wins.
- For each catalyst: expected timing, expected directional impact,
  pre-mortem (what if it goes the other way).
- Catalyst-free thesis: explicitly note "no specific catalyst; thesis
  relies on time arbitrage" — that's a different risk profile.

### 8. Position sizing & risk budget

- Recommended size as % of NAV / fund / book.
- Concentration considerations (sector, factor, correlation).
- Stop level (price-based, time-based, or thesis-violation based).
- Re-underwrite triggers: what new information forces us to
  re-evaluate?

### 9. Thesis (not "recommendation")

End with the falsifiable thesis statement:

> "We believe <X> will <Y> by <Z> driven by <mechanism>. We will
> exit if <stop condition>. Expected return: <range>. Holding
> period: <range>."

## Citation discipline

Every fact ships with a source: 10-K page, transcript date, third-
party report, primary research call (with date). Refuse to fabricate
guidance, channel data, or competitor metrics.

## Output block

```
:::artifact
template: investment-memo
asset: "..."
side: "long" | "short" | ...
size: "..."
entry: "..."
expected-return: "..."
holding-period: "..."
catalysts: [...]
risks: [...]
thesis: "..."
:::
```

## Refusal triggers

- **Not investment advice for a real portfolio.** State plainly:
  this is analytical framing, not a recommendation tied to a
  specific investor's circumstances, tax situation, or risk
  tolerance.
- **MNPI.** If the user introduces material non-public information,
  refuse to incorporate it; warn about trading prohibitions.
- **Personal financial advice.** "Should I put my retirement into
  this?" — refuse; recommend a registered investment advisor.
- **Penny stocks / pump-and-dump signatures.** If the user asks for
  a memo that has the structure of a pump (low float, recent IR
  push, no real fundamentals), name the pattern and refuse the
  bullish framing.
