# Sprint Planning Template

## Purpose
Commit to a realistic scope the team can actually deliver, balancing
business value, risk, and sustainable pace. The output is a list of
items the team has *signed up for*, not a wishlist.

## When to use
Trigger when the user is preparing for a sprint planning meeting,
debugging a chronically over-committed team, or rebuilding a planning
process that lost the thread.

## Inputs
- Historical velocity (last 3–6 sprints, *actual* completed, not
  committed). Reject "aspirational velocity" — it produces missed
  sprints and burnout.
- Prioritized backlog with each item having: business value, risk,
  rough estimate, owner area.
- Calendar capacity: PTO, holidays, on-call rotation, interview
  load, ceremonies.
- Carryover from last sprint (how much, why — recurring carryover is
  a planning signal).

## Method

1. **Capacity calculation.** Sum person-days available across the
   team, then subtract:
   - **20–25% overhead** for meetings, code review, design review,
     refactor, on-call interruption, support tickets, recruiting.
   - **Specific known commitments** (interview slots, customer calls,
     on-call rotation, planned spikes).
   - The remainder is *delivery capacity*.
2. **Sprint goal first.** Define one sentence: "By end of sprint, we
   will have <user-visible outcome>." A sprint without a goal is a
   shopping list. The goal is what the team protects when scope
   pressure hits mid-sprint.
3. **Pull items toward the goal.** For each candidate, check:
   - Estimate exists, in the team's units (story points, ideal days,
     or t-shirt — pick one and stick with it).
   - Definition of done is clear, including: code reviewed, tests
     pass, deployed to staging or prod, monitoring in place,
     stakeholders informed.
   - Acceptance criteria are testable. "Improves UX" is not.
   - Dependencies are identified and either resolved or owned by a
     person with a date.
4. **Buffer for the unknown.** Reserve 10–15% of capacity for bugs,
   support escalations, and small unplanned work. A sprint with 100%
   capacity committed is a sprint that misses.
5. **Risk flagging.** For each item, mark:
   - **Cross-team blocker risk** (someone outside the team must do
     X first)
   - **Unknown-unknown risk** (work in an unfamiliar area)
   - **Customer-facing deadline** (date-sensitive)
   - **Reversibility** (is it safe to ship and roll back, or is it a
     one-way door)
6. **Team commitment.** Not the manager's commitment. The team
   collectively says yes; if anyone is uncomfortable with the
   commitment, surface it now, not at the demo.
7. **No mid-sprint top-down injection.** If a new urgent item
   appears, scope something *out* explicitly; don't silently push
   the team to absorb it.

## Output

- **Sprint goal**: one sentence the team will protect.
- **Sprint backlog**: items with owners, estimates, and DoD.
- **Capacity ledger**: planned vs available person-days.
- **Risk register**: flagged items with mitigation owner.
- **Carryover policy**: what happens to in-flight work that doesn't
  ship by sprint end (continue / re-estimate / explicitly defer).

```
:::artifact
template: sprint-planning
sprint: "S2026-Q2-W17"
goal: "Ship the export-CSV endpoint behind a feature flag with monitoring."
capacity:
  team-days: 28
  overhead: 7
  known: 4
  delivery: 17
  buffer: 2
items:
  - { id: "ENG-1234", owner: "alex", estimate: 5, dod: "..." }
  - ...
risks:
  - { id: "ENG-1234", kind: "cross-team", mitigation: "..." }
:::
```

## Common planning failures

1. **Aspirational velocity.** Using best-ever velocity instead of
   median. Median is what the team will actually do.
2. **Hidden overhead.** Forgetting recruiting, on-call, customer
   calls, design partnership. They're 20–30% of real time.
3. **No definition of done.** "Build the feature" without DoD lets
   work look done while monitoring, docs, or rollout are missing.
4. **Single-owner items only.** Pair work, design partnership, and
   review effort don't show in single-assignee tickets. Either model
   it explicitly or let estimates float higher.
5. **No carryover policy.** Carry-over without re-estimation hides
   slip; carry-over without explicit defer hides scope creep.
6. **Sprint goal as a list.** "Ship A, ship B, ship C" is not a
   goal. One sentence, one outcome.
7. **Team didn't commit.** The PM committed; the team didn't agree.
   This is the #1 source of "we missed sprint" complaints.

## Output block

Use `:::artifact` with `template: sprint-planning`. Tag the velocity
basis (median of last 3, 6, etc.) so future planning can audit
whether the team is calibrated.

## Refusal

The agent will not:
- Pad an estimate to make capacity look bigger
- Recommend cancelling 1:1s, reviews, or on-call work to "find
  capacity" — that's borrowing from a different account
- Approve a sprint with zero buffer or zero risk surfacing — that's
  not a plan, it's a ship-or-bust gamble
