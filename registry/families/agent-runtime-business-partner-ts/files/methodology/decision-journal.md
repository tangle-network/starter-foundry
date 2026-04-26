---
capability: decision-journal
status: active
source: hand-authored
retrieved: 2026-04-25
---

# Decision Journal

A decision-journal entry produces a `:::artifact` block tagged
`template: decision-journal` capturing a decision before it is made,
with a predicted outcome, a checkpoint date, and an honest score
written **after** the checkpoint comparing the prediction to reality.

The point is not to make better decisions today; the point is to
**calibrate** the operator over time by forcing them to commit
predictions to paper before reality renders verdict. A decision
journal that is never reviewed is a journal, not a decision journal.

## When to use

- Any decision the operator labels "important" or "I keep going back
  and forth on."
- Any **Type 1 decision** (irreversible — see below).
- Any decision that, if wrong, would cost > 1 month of team capacity
  to undo.
- When the operator says "I need to think about this", "I'm stuck on
  this call", "should I do X".

## Method

### 1. Name the decision

A single sentence. "Should we hire a VP Sales now or wait two
quarters?" Not "thinking about sales leadership."

If the operator cannot state it in one sentence, the decision isn't
ripe — help them frame it before journaling.

### 2. Reversibility (Type 1 vs Type 2 — Bezos)

- **Type 1** — one-way door. Hard or impossible to reverse. Treat
  with deliberation, gather more evidence, slow down. Examples:
  selling the company, firing a co-founder, taking a strategic
  investor with veto rights.
- **Type 2** — two-way door. Cheap to reverse if wrong. Move fast,
  bias to action, treat the cost of delay as real. Examples: most
  hires, most product bets, most pricing experiments.

Most decisions are Type 2 and the operator over-deliberates them.
Most "I'm stuck" moments are Type 2 dressed up as Type 1. Naming the
class explicitly is half the value.

### 3. Current state of evidence

Three to five bullets, each citing the source of the claim:

- Customer signal (which customers, what they said, when)
- Market signal (citation via research-corpus if a published claim;
  internal data if proprietary)
- Team signal (who has weighed in, what was their stake)
- Financial signal (what the model says under what assumptions)

If a bullet has no citation and no source, mark it **opinion** so
the operator can see how much of their decision rests on intuition
vs. evidence.

### 4. Alternatives considered

At least two, ideally three. The "do nothing" option is always one
of them. If the operator cannot name a real alternative, they have
not stress-tested the decision.

For each alternative, one sentence on why it was rejected.

### 5. Predicted outcome (with timeframe)

A specific, falsifiable prediction. Not "this will go well" — that
cannot be scored.

- Concrete number ("ARR will be $X by end of Q4")
- Concrete event ("we will close the round by August 1")
- Concrete observation ("by month 3, the new hire will have closed
  3 enterprise deals")

The prediction must be reviewable by an outsider without asking the
operator what they meant.

### 6. What would change my mind

Two to three signals that, if observed, would cause the operator to
reverse the decision. This is the **kill criteria** — write it
before reality starts to flatter or punish the decision, because
afterward the operator will rationalize.

Examples: "If we're below 10 customers by month 6, we kill the
self-serve motion." "If the new hire's first 30-day plan slips by
two weeks, we end the trial."

### 7. Review at agreed checkpoint

Set a date. Add it to the operator's calendar in the same artifact.

At checkpoint:

- **Was the prediction correct?** (yes / partly / no — name the gap)
- **Why?** — was the model right and the world cooperated, or was
  the model wrong and the world cooperated anyway? Distinguishing
  good outcome from good decision is the calibration the journal
  exists to provide.
- **What would I do differently next time?** — one sentence.

### 8. Honest scoring

Score the decision on a 1–5 scale on each axis:

- **Process** — was the right method used given Type 1 / Type 2?
- **Information** — did the operator gather what was reasonably
  available?
- **Outcome** — did reality match the prediction?

A high outcome score with a low process score is a warning, not a
victory: the operator got lucky and is at risk of over-trusting the
method.

## Output shape

Wrap the entry in a `:::artifact` block tagged
`template: decision-journal`, dated, with the eight numbered sections
above. After checkpoint review, append the scoring section to the
**same** artifact — do not start a new entry; the predict-then-score
pairing is the load-bearing part.

## Escalation

If the decision involves any of the system-prompt's mandatory
escalation triggers (HR, M&A, securities, comp, legal, fiduciary),
emit a `:::escalation` block **before** opening the journal entry.
The journal helps the operator think; it does not substitute for the
professional opinion the trigger requires.

## Source

Jeff Bezos, 1997 + 2015 + 2016 shareholder letters (Type 1 vs Type 2,
disagree-and-commit). Shane Parrish / Farnam Street decision-journal
template (kill criteria, post-hoc scoring, calibration discipline).
Daniel Kahneman, *Thinking, Fast and Slow* (separating outcome
quality from decision quality). Adapted with concrete checkpoint and
scoring scaffolding for an operator-cadence context.
