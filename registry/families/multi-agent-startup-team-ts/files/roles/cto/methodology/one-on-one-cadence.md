---
capability: one-on-one-cadence
status: active
source: hand-authored, drawn from Grove + Camille Fournier (Manager's Path) + Lara Hogan
retrieved: 2026-04-26
---

# 1:1 Cadence (CTO-owned)

A 1:1 produces a `:::artifact` block tagged
`template: one-on-one-cadence` capturing the prep notes for a
specific 1:1 and the after-action follow-ups. The 1:1 is **not** a
status update. Status belongs in the standup or the project tracker.
The 1:1 is where trust gets built, blockers surface, growth gets
planned, and the manager hears the things they would not otherwise
hear.

## Cadence

- **Weekly, 30 minutes** is the floor for a direct report. No
  cancellations; reschedule if the slot conflicts.
- **Bi-weekly, 60 minutes** for a skip-level or a tenured senior IC
  who has earned the longer cycle.
- **Cancellation policy**: if you cancel three weeks in a row, you
  are signaling that the report does not matter. The 1:1 is the
  smallest unit of management investment; do not let it slip.

## Pre-1:1 prep

Before the meeting, write into the artifact:

- **Last 1:1's action items.** Did each get done? If not, why not?
  An action item that slips repeatedly is a signal — either the
  report is overloaded, or the item was not actually a commitment.
- **Topics from your side.** Three max. Not status — coaching
  signal, scope conversations, feedback (positive or constructive),
  career-path check-ins.
- **What the report has surfaced via the shared agenda.** The
  report owns the agenda 24h ahead. If they bring nothing, that is
  itself a signal.

## Agenda (suggested, ~30 min)

1. **Check-in (2 min)** — "How are you doing this week?" Energy,
   focus, anything on their mind. Listen for the signal under the
   answer; it is rarely literal.
2. **Their topics (10 min)** — they own the agenda. Their items go
   first; your items can wait if theirs run long.
3. **Tactical (5 min)** — blockers, dependencies, decisions they
   need from you. Resolve in-meeting if possible; otherwise commit
   a deadline.
4. **Growth (8 min)** — skills they want to build, stretch
   assignments, feedback on recent work. Rotate weeks: tactical-
   heavy one week, growth-heavy the next. Do not let growth
   conversations get crowded out by tactical.
5. **Strategic (3 min)** — team direction, org changes, long-term
   concerns. Bring the org-context the report does not have.
6. **Close (2 min)** — action items (with owner + date), next 1:1
   topic preview, anything they want to add.

## Feedback discipline

- **SBI format** for any feedback (positive or constructive):
  Situation → Behavior → Impact. "Yesterday in the design review
  *(situation)*, you cut Maria off twice while she was explaining
  the trade-off *(behavior)*, and the room defaulted to your
  proposal without finishing the analysis *(impact)*."
- **Praise publicly, redirect privately.** The 1:1 is the redirect
  channel; standups, all-hands, public docs are the praise channel.
- **Specific over general.** "You're crushing it" produces no
  behavior change. Name the specific thing the report did and the
  specific outcome you observed.
- **Direct over hint.** If the report has a perf issue, name it
  this 1:1 — not in three weeks, not in the perf review. Hinted
  feedback is unsigned feedback; it does not reach.

## Career conversation rotation

Every fourth or fifth 1:1, the **growth** slot becomes a structured
career conversation:

1. **Where do they want to go?** — next 12 months, next 3 years.
   Concrete role / scope / skill, not "more impact."
2. **What's the closest gap?** — the one capability that, if
   built, opens the next move. One gap, not five.
3. **What's the next stretch assignment?** — concrete piece of
   work, with owner-level scope, that exercises the gap.
4. **What support do they need from you?** — coaching frequency,
   sponsor introductions, access to a project, training budget.

Career conversations are not promotion conversations. Do **not**
commit to a promotion outcome — promotion lives in the formal
calibration cycle, with HR + skip-level alignment. State this limit
when the report asks "so will I get promoted next cycle?"

## Escalation triggers

Surface these to the operator and emit `:::escalation` for the
substantive call:

- **Mental-health signals.** Suicidal ideation, severe burnout
  symptoms, signs of acute crisis. → operator's EAP or crisis
  resources. Do not coach this in 1:1; refer.
- **Harassment / discrimination report.** Stop the 1:1, document
  what you heard verbatim, refer the report to HR + employment
  counsel. Do **not** investigate from the 1:1 chair.
- **Performance issue requiring a formal step.** PIP, written
  warning, termination consideration. → handoff to HR for
  process-prep artifact; escalate the substantive call to
  operator's HR business partner + employment counsel.
- **Compensation request.** Hand off to HR; do not commit to a
  number. Compensation is band-driven, not 1:1-driven.

## Output shape

```
:::artifact
template: one-on-one-cadence
date: <YYYY-MM-DD>
report: <name or pseudonym>
agenda:
  last-action-items: [<item, status, why-if-slipped>]
  manager-topics: [<topic, intent>]
  report-topics: [<from shared agenda>]
discussion-notes:
  tactical: <bullets>
  growth: <bullets>
  strategic: <bullets>
new-action-items:
  - { item, owner, due }
career-rotation: <yes | no — note next due>
:::
```

## Self-check before the 1:1

- I read the shared agenda this morning. ✅ / ❌
- Last week's action items have status. ✅ / ❌
- I have ≤ 3 manager topics, all coaching/scope/feedback (not
  status). ✅ / ❌
- The growth slot is not getting crowded out this week. ✅ / ❌
- I have a redirect ready if the report needs one. ✅ / ❌

## Source

Andy Grove, *High Output Management* (the original 1:1 frame).
Camille Fournier, *The Manager's Path* (career conversation
cadence). Lara Hogan, *Resilient Management* (feedback in SBI
format, escalation discipline).
