---
capability: fundraise-prep
status: active
source: hand-authored, drawn from YC fundraising guides + Bill Gurley + Brad Feld (Venture Deals)
retrieved: 2026-04-26
---

# Fundraise Prep (CFO-Advisor-led, multi-role)

A fundraise-prep artifact produces a `:::artifact` block tagged
`template: fundraise-prep` containing the deck math (burn, runway,
ask, use of funds, comparables, key metrics), a diligence-data-room
checklist, and the kill-criteria for when to walk from a term sheet.
**The artifact is a preparation tool. It is not a fundraising
strategy substitute for outside corporate counsel and a banker —
the moment term-sheet language is on the table, escalate.**

## When to run

- Operator says "we should think about raising" — open this
  template even if the raise is 6 months out. Prep is cheap; being
  unprepared at T-9 is expensive.
- Burn / runway model fires the T-9 alarm.
- A board member or investor signals interest unsolicited.
- Plan-scenario hiring or paid-spend would breach runway tolerance
  without a raise.

## Multi-role contributions

| Slot | Contributor |
|---|---|
| Burn / runway / unit-economics math, deck financial slides, comparable-company benchmarks, diligence checklist | CFO Advisor (you) |
| Narrative arc, why-now, founder story, mission framing | CEO |
| Growth story (positioning, ICP, channel performance, traction proof) | CMO |
| Product / engineering moat (what's hard to replicate, what's shipped) | CTO |
| Team slate / org-chart / open-roles narrative | HR |
| Term-sheet language, securities mechanics, governance terms | **Outside corporate counsel — emit `:::escalation`** |

The fundraise-prep artifact is genuinely team-wide. Hand off in
sequence; do not assemble alone.

## The three numbers every deck must defend

Investors will press on three numbers. If you cannot defend them
under stress, the round will not close.

### 1. The ask

- **How much, at what valuation, on what instrument** (priced /
  SAFE / convertible).
- Anchored to **18–24 months of runway under plan + 6 months
  reserve.** Anything less and the next round will start before
  this one closes.
- **Use of funds**: minimum three named buckets (typically
  hiring, GTM spend, infra/product). Each bucket maps to an OKR.

### 2. The unit economics

- **CAC, LTV, payback period, gross margin, net retention.**
- **Provenance**: which numbers are actuals, which are
  projections, what are the assumptions behind each. An LTV
  number with no source is a number that fails diligence.
- **Cohort view, not blended.** Blended numbers hide
  deterioration. Show by cohort.

### 3. The growth narrative (CMO contribution)

- **Funnel by stage, last 4 quarters.** Acquisition →
  activation → revenue → retention → expansion. Show absolute and
  rates.
- **One channel that's working** (or the experiment plan to find
  it). Investors fund discovered channels, not theoretical ones.
- **The bet**: what you'll do with the money that you can't do
  without it. CEO writes the narrative; you supply the math
  scaffolding.

## Comparable-company benchmarks

For a Series A / B raise, gather 3–5 public + private
comparables matched on:

- Stage (revenue band, headcount band).
- Vertical / segment.
- Business model (SaaS, marketplace, infra, etc.).

Compare on: revenue multiple at last round, growth rate, NRR,
gross margin, burn multiple. **Cite each comparable** with a
public source (filings, press, public-data trackers). Investors
will check. A fabricated comp tanks the round.

## Diligence data room checklist

Build the room before you start meetings. Investors that go to
term sheet will diligence in 2–3 weeks; the data room is the
gate.

- **Corporate**: cap table, board consents, prior round docs,
  IP assignments, stock-option ledger.
- **Financial**: monthly P&L last 24 months, balance sheets,
  bank statements, AR aging, AP aging, current model with
  assumptions visible.
- **Customer**: top-10 customers by revenue, contract terms
  (with PII redacted as appropriate), churn cohort table, NPS /
  CSAT data if collected.
- **Product / Tech (CTO contribution)**: architecture overview,
  uptime / SLA history, security posture (SOC 2 status if any),
  major incidents last 12 months and remediation.
- **Team (HR contribution)**: org chart, open roles, comp bands,
  attrition last 12 months (anonymized).
- **Legal (escalate)**: any pending or threatened litigation,
  outstanding contracts with material terms, open IP / employment
  / data-protection issues. **You do not assemble this section —
  outside counsel does.**

## Kill criteria (when to walk from a term sheet)

Pre-commit these before the first investor meeting. They will be
hardest to honor under deal pressure.

- **Pre-money valuation that creates a down-round risk** for the
  next raise (i.e. the next round needs growth you cannot defend).
- **Liquidation preference > 1× non-participating.** Anything
  more is a stacked preference cap that will eat the founders /
  early employees in a moderate exit.
- **Board control concession** that gives investors veto over
  hiring / firing the CEO, or board majority pre-Series-B.
- **Anti-dilution provisions** beyond broad-based weighted
  average. Full-ratchet is a red flag.
- **Unfunded reserve / pool-shuffle** that effectively dilutes
  the founders without lowering the price.
- **Pro-rata + super-pro-rata** that locks the next round's
  allocation before that round even opens.

When any of these surface, **emit `:::escalation`** to operator's
corporate counsel. You can flag the pattern; you cannot negotiate
the term.

## Output shape

```
:::artifact
template: fundraise-prep
date: <YYYY-MM-DD>
contributors: [cfo-advisor, ceo, cmo, cto, hr]
ask:
  amount: <usd>
  valuation: <usd, pre-money>
  instrument: priced | safe | convertible
  use-of-funds: [{ bucket, amount, mapped-okr }]
  runway-months-post-close: <int>
unit-economics:
  cac: <usd>
  ltv: <usd>
  payback-months: <int>
  gross-margin-pct: <pct>
  net-retention-pct: <pct>
  cohort-table-ref: <link to data room>
comparables:
  - { company, source, revenue-multiple, growth-rate, nrr, burn-multiple }
diligence-room:
  url: <data room link>
  sections-complete: [<list>]
  sections-pending: [<list>, with owners]
kill-criteria: <pre-committed list — see methodology>
narrative-owner: ceo
growth-story-owner: cmo
team-slate-owner: hr
:::
```

## Escalation triggers (always)

- **Term sheet on the table** → emit `:::escalation` immediately
  to operator's corporate counsel and a banker if the round size
  warrants. Do not interpret term-sheet language.
- **409A valuation** → emit `:::escalation` to operator's CPA +
  409A provider. Do not opine on strike prices.
- **Secondary sale** discussion → emit `:::escalation` to
  operator's corporate counsel. Tax + securities + dilution
  intersection is a counsel matter.
- **Anything resembling investment advice for the operator
  personally** → emit `:::escalation` to operator's licensed
  financial advisor.

## Source

YC's fundraising guides (PG essays + the standard 10-slide deck
shape). Bill Gurley's "On the Road to Recap" and adjacent essays
(structure on liquidation preferences and clean cap tables). Brad
Feld & Jason Mendelson, *Venture Deals* (term-sheet anatomy and
red-flag list). Standard FP&A practice for unit economics and
cohort-driven retention math.
