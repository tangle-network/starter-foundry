---
capability: weekly-review
status: active
source: hand-authored, adapted from agent-runtime-business-partner-ts for multi-role assembly
retrieved: 2026-04-26
---

# Weekly Review (CEO-assembled, multi-role)

A weekly review produces a single `:::artifact` block tagged
`template: weekly-review` covering the operator's state across seven
dimensions, what changed, what surprised, what's blocking, the one
bet for next week, and the one thing to stop. The CEO assembles; the
CFO Advisor, CTO, and CMO contribute named sections.

The cadence is the point. A review skipped is a leading indicator
the operator is reactive rather than proactive — surface that signal
explicitly when it happens.

## When to run

- Triggered by Monday-morning cron (`0 14 * * 1` ≈ 07:00 PT / 10:00 ET).
- On operator request: "weekly review", "let's do the review",
  "what's my state".
- After a board meeting, fundraise close, or major personnel change —
  run the review even mid-week, then resume the Monday rhythm.

## Multi-role turn structure

This is a **joint-decision turn**. As CEO you do not gather all
seven dimensions yourself.

1. **Open the turn.** State that you are assembling the weekly
   review and list the contributing roles.
2. **Hand off in order:**
   - `:::handoff to: cfo-advisor` for the **revenue** and **runway**
     dimensions. Context: last week's review (if any), and the
     current month-to-date numbers the operator can supply.
   - `:::handoff to: cmo` for the **pipeline** and **customer
     feedback** dimensions.
   - `:::handoff to: cto` for the **product** and **team** dimensions
     (delivery, incidents, retention risk on the eng side).
3. **Reassemble.** When all three contributors have returned their
   sections, stitch into the artifact. Add the seventh dimension —
   **personal energy** — yourself; ask the operator directly.
4. **Write the close.** "What changed / what's surprising / what's
   blocking / one bet / one stop." This is CEO output — do not
   delegate.

## The seven dimensions

For each dimension, capture: **current number / state**, **delta vs
last week**, **one-sentence interpretation**.

1. **Revenue** *(CFO Advisor)* — MRR / ARR / cash collected. Delta
   vs last week and vs plan. Flag if delta < 0 or < plan by > 10%.
2. **Pipeline** *(CMO)* — qualified opportunities, weighted pipeline,
   top 3 deals by stage. Flag stalled deals (no movement > 14 days).
3. **Team** *(CTO)* — eng headcount, open roles, anyone in 1:1
   distress, anyone exceptional this week. Flag retention risk.
   *(HR contributes if there is an active recruiting slate; otherwise
   CTO covers eng-side team alone.)*
4. **Product** *(CTO)* — shipped this week, in flight, blocked. Flag
   any reliability incident, regression, or customer-visible bug.
5. **Runway** *(CFO Advisor)* — months of cash at current burn;
   trailing 3-month average burn; date the runway alarm fires (T-9
   months from zero). Flag if runway shortened > 1 month vs last
   review.
6. **Customer feedback** *(CMO)* — top three signals from sales
   calls, support tickets, NPS / churn surveys this week. Flag any
   pattern repeating 3+ times.
7. **Personal energy** *(CEO + operator directly)* — operator's own
   state on a 1–10 scale, with one sentence on why. Flag if < 5 for
   two consecutive weeks — that is itself a leading indicator of
   decisions made under fatigue.

## Five questions after the dimensions

After the seven-dimension scan, walk the operator through:

- **What changed since last week?** — name the deltas explicitly,
  not in aggregate. "Revenue +$12k, lost the Acme deal, hired
  Sarah." Cite which contributor surfaced each.
- **What's surprising?** — anything that violated last week's mental
  model. Surprise is information; do not let it pass without a
  decision-journal entry if the surprise is large enough to change
  strategy.
- **What's blocking?** — name the constraint, not the symptom.
  "Hiring is slow" is a symptom; "we don't have a referral pipeline
  and we haven't written the JD" is a constraint. If the constraint
  is HR-shaped, hand off to HR for next steps in a follow-up turn.
- **One bet for next week** — the single most leveraged action the
  operator will take. Force a single bet; if the operator names
  three, ask which one would still ship if the other two failed.
- **One thing to stop** — what activity, meeting, or commitment the
  operator will drop to make room for the bet. A bet without a stop
  is wishful thinking; weekly capacity is fixed.

## Output shape

```
:::artifact
template: weekly-review
date: <YYYY-MM-DD>
contributors: [ceo, cfo-advisor, cmo, cto]
dimensions:
  revenue: { value, delta, interpretation, contributor: cfo-advisor }
  pipeline: { value, delta, interpretation, contributor: cmo }
  team: { value, delta, interpretation, contributor: cto }
  product: { value, delta, interpretation, contributor: cto }
  runway: { value, delta, interpretation, contributor: cfo-advisor }
  customer-feedback: { value, delta, interpretation, contributor: cmo }
  personal-energy: { value, delta, interpretation, contributor: ceo }
narrative:
  changed: <bullets>
  surprising: <bullets — name decision-journal candidates>
  blocking: <constraints, not symptoms>
  one-bet: <single most-leveraged action>
  one-stop: <what gets dropped>
:::
```

## Escalation triggers (CEO emits)

- **Runway < 9 months** → CEO emits `:::escalation` recommending the
  operator re-confirm runway with their CPA, AND opens a
  fundraise-prep handoff to CFO Advisor.
- **Personnel-action signal** (termination, perf-management,
  harassment) → emit `:::escalation` immediately referring to HR /
  employment counsel. Hand off to internal HR for process-prep
  artifact only.
- **Customer-feedback pattern suggesting PMF regression** → flag for
  decision-journal entry; do not let it default into "we'll watch
  it." Open a handoff to CMO for a positioning re-check.

## Honesty discipline

Do not let the operator round up. If revenue is below plan, name it.
If a key person is at retention risk, name them. If runway shortened,
say so. Soft-pedaling the review is the most expensive thing the
operator can do — the review only earns its hour if it surfaces what
the operator was avoiding.

## Source

Andy Grove, *High Output Management*, ch. 4 (operating cadence) and
ch. 7 (output-oriented review). Bezos shareholder letters (day-1
mentality, "what would change my mind"). Adapted for a multi-role
runtime where the seven dimensions cleanly partition across CFO /
CMO / CTO / CEO.
