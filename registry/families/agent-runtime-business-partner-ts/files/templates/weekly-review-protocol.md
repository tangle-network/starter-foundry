---
capability: weekly-review-protocol
status: active
source: hand-authored
retrieved: 2026-04-25
---

# Weekly Review Protocol

A weekly review produces a `:::artifact` block tagged
`template: weekly-review-protocol` capturing the operator's state
across seven dimensions, what changed, what surprised, what's
blocking, the one bet for next week, and the one thing to stop.

The cadence is the point. A review skipped is a leading indicator the
operator is reactive rather than proactive — surface that signal
explicitly when it happens.

## When to use

- Triggered by the Monday-morning cron (`0 14 * * 1`).
- Triggered manually when the operator says "weekly review",
  "let's do the review", "what's my state".
- After a board meeting, fundraise close, or major personnel change —
  run the review even if it's mid-week, then resume the Monday rhythm.

## The seven dimensions

For each dimension, capture: **current number / state**, **delta vs
last week**, **one-sentence interpretation**.

1. **Revenue** — MRR / ARR / cash collected. Delta vs last week and vs
   plan. Flag if delta < 0 or < plan by > 10%.
2. **Pipeline** — qualified opportunities, weighted pipeline, top 3
   deals by stage. Flag stalled deals (no movement > 14 days).
3. **Team** — headcount, open roles, anyone in 1:1 distress, anyone
   exceptional this week. Flag any retention risk.
4. **Product** — shipped this week, in flight, blocked. Flag any
   reliability incident, regression, or customer-visible bug.
5. **Runway** — months of cash at current burn; trailing 3-month
   average burn; date the runway alarm fires (T-9 months from zero).
   Flag if runway shortened > 1 month vs last review.
6. **Customer feedback** — top three signals from sales calls, support
   tickets, NPS / churn surveys this week. Flag any pattern repeating
   3+ times.
7. **Personal energy** — operator's own state on a 1–10 scale, with
   one sentence on why. Flag if < 5 for two consecutive weeks — that
   is itself a leading indicator of decisions made under fatigue.

## Five questions after the dimensions

After the seven-dimension scan, walk the operator through:

- **What changed since last week?** — name the deltas explicitly, not
  in aggregate. "Revenue +$12k, lost the Acme deal, hired Sarah."
- **What's surprising?** — anything that violated last week's mental
  model. Surprise is information; do not let it pass without a
  decision-journal entry if the surprise is large enough to change
  strategy.
- **What's blocking?** — name the constraint, not the symptom. "Hiring
  is slow" is a symptom; "I don't have a referral pipeline and I
  haven't written the JD" is a constraint.
- **One bet for next week** — the single most leveraged action the
  operator will take. Force a single bet; if the operator names
  three, ask which one would still ship if the other two failed.
- **One thing to stop** — what activity, meeting, or commitment the
  operator will drop to make room for the bet. A bet without a stop
  is wishful thinking; weekly capacity is fixed.

## Output shape

Wrap the entire review in a `:::artifact` block, tagged
`template: weekly-review-protocol`, dated, with the seven-dimension
table at the top and the five-question narrative below.

## Escalation

If the dimension scan surfaces:

- Runway < 9 months → escalate to fundraise-prep conversation +
  recommend the operator re-confirm runway with their CPA.
- A personnel-action signal (termination, performance-management,
  harassment) → emit a `:::escalation` block immediately and refer to
  HR / employment counsel.
- A customer-feedback pattern that suggests product-market-fit
  regression → flag for a decision-journal entry, do not let it
  default into "we'll watch it."

## Honesty discipline

Do not let the operator round up. If revenue is below plan, name it.
If a key person is at retention risk, name them. If runway shortened,
say so. Soft-pedaling the review is the most expensive thing the
operator can do — the review only earns its hour if it surfaces what
the operator was avoiding.

## Source

Andy Grove, *High Output Management*, ch. 4 (operating cadence) and
ch. 7 (output-oriented review). Bezos shareholder letters (day-1
mentality, "what would change my mind"). Adapted for an early-stage
founder context where runway and personal energy are first-class
dimensions.
