# QBR Prep (Customer Success)

## Purpose
Prepare a Quarterly Business Review with a strategic customer. The QBR
deck is **not a status update**. It aligns on customer goals, exposes
product gaps honestly, and ends with a mutual action plan. CS prepares;
the operator runs the meeting.

## When to use
- Friday of any cycle when a QBR is landing in the next 7 days.
- Before a renewal conversation with a strategic customer.
- When the operator asks for a QBR readout.

## Inputs
- Last-quarter QBR notes (the goals set, the action plan committed)
- Sprint-ship notes from cycle N (what shipped that the customer cares
  about)
- Health-score deltas (`churn-risk-analysis` per-customer report)
- PM's PRD history for the customer's segment (what's coming)
- Customer's stated goals from kickoff and prior QBRs

## Five-section agenda

### 1. Customer goals & progress
- What goals did the customer set last quarter?
- What progress was made? Use **measured numbers**, not adjectives.
- What changed in the customer's business? (new exec, new strategy,
  funding round, layoff)
- Honest call-out: did *we* deliver on the commitments we made last QBR?

### 2. Product usage & value
- Key usage metrics (DAU/MAU, feature adoption breadth, session depth)
- Features delivering most value for this customer (named, with
  evidence — not the marketing list)
- Underutilized features that would unlock value (CS recommends an
  enablement plan, not a sales push)
- Quote-able usage numbers ("you ran 12,400 reports this quarter, up
  18% QoQ")

### 3. Support & health review
- Ticket trends, satisfaction scores
- Health score summary (green / yellow / red, with the dimension that
  drives the score)
- Open escalations — status, owner, ETA
- **Honest red flags.** If the customer has a recurring issue we
  haven't fixed, name it. Hiding it surfaces in renewal.

### 4. Roadmap & mutual action plan
- Upcoming product releases relevant to this customer (pull from PM's
  PRD history; flag confidence — committed vs in-discovery)
- Joint initiatives for next quarter (named goal, named owner on each
  side, named success criterion)
- **Refuse vague commitments.** "We'll improve performance" is not a
  joint initiative. "Reduce p95 export latency to ≤2s by end of Q3"
  is.

### 5. Renewal & expansion
- Renewal timeline, term, current commitment
- Renewal likelihood (CS's honest call, not the optimistic one)
- Expansion opportunities (additional teams, additional product
  surfaces) — only if health is green or yellow with positive trend
- Risks that would change renewal language (named with mitigation)

## Preparation rules

- **Re-pull data day-of, not week-of.** A QBR with stale numbers loses
  credibility on the first slide.
- **Name the customer's primary contact and their primary internal
  pressure.** "Their VP-Eng is being measured on cost-per-API-call this
  quarter." Without this, the QBR is generic.
- **Anticipate their three hardest questions.** Draft answers in the
  prep doc so the operator isn't surprised.
- **Bring exactly one ask.** A QBR with five asks lands no asks.

## Output (`:::artifact template: qbr-prep`)
- Pre-meeting brief (1–2 pages) with all five sections
- Annotated deck or doc the operator will present
- Prep notes: customer's primary internal pressure, top-3 anticipated
  hard questions with draft answers, the one ask
- `producedBy: customer-success`, `consumedBy: operator` (not PM —
  QBRs are operator-run, CS-prepared)

## Anti-patterns

- **Status-update QBR.** Listing what shipped without tying to customer
  goals. Customers don't want our changelog.
- **Hiding red flags.** Bad surprises at renewal time always cost more
  than honest conversations at QBR time.
- **Vague mutual action plan.** Without named owners and success
  criteria, the next QBR opens with the same plan.
- **Roadmap promises beyond confidence.** Marking in-discovery PRDs as
  "shipping next quarter." Inflates trust short-term, destroys it
  long-term.

## Escalation rule
If QBR prep surfaces:
- A **legal/contractual dispute** in customer language
- A **pricing renegotiation** request
- A **security/compliance** incident the customer is escalating

…emit `:::escalation` immediately. Operator + counsel/finance/security
own the response; CS prepares the brief but does not advise on the
substance.
