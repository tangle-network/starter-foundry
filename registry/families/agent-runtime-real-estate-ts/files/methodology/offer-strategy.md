---
id: offer-strategy
capability: offer-strategy
retrieved: 2026-04-25
authority: NAR "Real Estate Buyer's Agent Council" curriculum; state-promulgated purchase contract conventions (varies by jurisdiction)
---

# Offer Strategy Framework

This template produces a **strategy memo**, not a binding offer. The
offer itself — the executed purchase contract, the addenda, the
financing letter, the earnest-money wire instructions — is drafted by
the user's licensed real-estate agent and reviewed by the user's
attorney where applicable. Hand the strategy memo to that agent;
escalate any execution question.

## 1. Inputs (open `:::question` until complete)

- Subject property and asking price
- CMA confidence band (run `comp-analysis` first if not yet done)
- Days on market (DOM) and listing history (price changes,
  withdrawals, relistings)
- Listing agent's brokerage and stated commission split
- User's financing structure (cash / conv / FHA / VA / jumbo / asset-
  backed / DSCR loan; pre-approval status)
- User's flexibility on close date, contingencies, leaseback
- User's hard ceiling (the price above which the deal stops making
  sense — this is private, never goes in the offer)
- Market temperature (months of supply; >6 = buyer's market, 4-6 =
  balanced, <4 = seller's market)

If the user cannot state a hard ceiling, halt. A buyer without a
walkaway price is the buyer who overpays. Surface this and refuse to
proceed until they answer.

## 2. Seller-motivation research

Strategy without seller motivation is a guess. Available signals:

- **DOM trajectory** — long DOM with price reductions = motivated;
  short DOM with no reductions = priced to clear.
- **Listing remarks** — "estate sale," "relocation," "motivated
  seller," "as-is," "must sell" are explicit motivation signals.
- **Concurrent purchase** — if the seller is buying their next home
  contingent on this sale, leaseback or fast close has high value.
- **Public records** — divorce, probate, lis pendens, NOD (notice of
  default), tax-lien, recent mortgage refi/HELOC. Methodology only;
  the user's agent pulls the records.
- **Physical condition** — vacant vs. occupied; deferred maintenance
  visible from comps. Vacant carrying-cost compounds motivation.

Refuse to invent motivation signals. If none are observable, name
that — the strategy under "unknown motivation" is different.

## 3. Contingency stack

A contingency is a buyer-protective right to walk and recover earnest
money. Each one weakens the offer. Stack them deliberately.

| Contingency | Default window | Strategic levers |
|-------------|----------------|------------------|
| Financing | 17-21 days | Shorten if the user has strong pre-approval; waive only on cash or with pre-funded letter from lender — NEVER without lender sign-off. |
| Inspection | 7-10 days | "Information-only" inspection (cannot demand repairs, but can walk on material defect) is a middle ground. Full waiver is rare and risky on resale; surface the risk. |
| Appraisal | tied to financing window | Appraisal-gap clause: "buyer covers up to $X above appraisal" — useful in seller's markets; carries cash-call risk if appraisal misses. |
| Sale of current home | 30-60 days | Heavily disfavored in any market <6 months supply. Bridge financing or HELOC may eliminate the need; surface alternatives. |
| Title | typically 5-10 days from prelim | Standard; rarely waived. |
| HOA/CC&R review | 5-10 days from doc delivery | Standard for condo / HOA properties. Never waive on a complex association. |

Strategic principle: **win on the easiest-to-give contingency, never
on price alone**. Sellers value certainty almost as much as price; a
clean contingency stack at $X often beats a contingent offer at $X +
3%.

## 4. Earnest money calibration

Earnest money is the buyer's "skin in the game" — refundable if
contingencies are met, generally forfeit on default.

Norms (calibrate to local custom):
- Standard: 1-3% of purchase price
- Competitive seller's market: 3-5%, sometimes "non-refundable
  after inspection" structures (escalate to attorney — these are
  contractually live wires)
- Cash / quick close: higher EM signals seriousness; 5%+ is not
  unusual on cash deals

Never recommend non-refundable earnest money without an `:::escalation`
to the user's attorney. The forfeiture mechanics are jurisdiction-
specific and contract-specific.

## 5. Escalation clauses

An escalation clause auto-raises the offer above competing offers, up
to a cap. Mechanics:

```
Buyer offers $X, escalating $Y above any bona-fide higher offer,
up to a maximum of $Z.
```

Cautions to surface:
- The cap is the buyer's true ceiling exposed to the seller — this
  is information leak; some buyers prefer to bid hard once instead.
- "Bona-fide" must be defined (typically "in writing, fully
  contingent terms equal or better"). Without that, the clause is
  unenforceable.
- Seller-side disclosure of the competing offer is rarely required;
  the buyer is trusting the listing agent's representation. Some
  jurisdictions have started requiring proof.
- Escalation clauses are jurisdiction-sensitive. Some state
  associations' standard contracts disfavor them. Escalate the
  drafting question to the user's licensed agent.

## 6. Offer-price recommendation (band, not point)

Combine:

- CMA mid as the anchor
- Market-temperature adjustment: +0 to +5% in seller's markets, −2
  to −7% in buyer's markets (calibrate from listing-agent reductions
  on comps)
- Motivation adjustment: motivated sellers absorb a discount;
  unmotivated sellers anchor on list
- Contingency-strength adjustment: a strong contingency stack lets
  the user offer 2-4% lower at parity expected-acceptance rate

Output a 3-band recommendation:

- **Aggressive** (high acceptance probability, weakest negotiation
  position) — typically near or above CMA high
- **Balanced** — near CMA mid with calibrated escalation cap
- **Disciplined** — at CMA mid-low, contingency-strong, walk-ready

The user picks. Never pick for them. Surface trade-offs explicitly.

## 7. What this template does NOT do

Hard escalation triggers — emit `:::escalation` and stop:

- **Drafting the actual offer / contract / addendum.** That is the
  user's licensed agent's job.
- **Drafting a counter-offer or response to a seller counter.** Same.
- **Reviewing the seller's disclosures, prelim title, inspection
  report.** Each goes to a specialist (agent / attorney /
  inspector).
- **Recommending non-refundable earnest money structures.** Attorney
  territory.
- **Interpreting jurisdiction-specific contract terms** — "as-is"
  rider, financing-contingency removal mechanics, time-is-of-the-
  essence default cure periods, statutory rescission windows.
- **Advising on tax structuring** — installment sale, 1031-exchange
  identification timing, owner-financing tax treatment. CPA
  territory.

## 8. Output

Emit an `:::artifact` block with the regulatory header (see system
prompt §"Regulatory disclaimer") and:

- Subject and CMA reference
- DOM / motivation signals (or "unknown motivation" flag)
- Recommended contingency stack with rationale per line
- Earnest money recommendation with attorney-escalation note if
  non-refundable structures are involved
- Escalation-clause analysis (if relevant) with cautions
- 3-band price recommendation (aggressive / balanced / disciplined)
- Hard ceiling restated (private to the user)
- Hand-off note: "Take this memo to your licensed real-estate agent
  to draft the offer."
