# Sprint Planning (Engineering Manager)

## Purpose
Commit to a realistic scope for the cycle that the team can actually deliver
without burning out. Sprint planning runs Thursday, after the PRD locks
Wednesday. The output is the **commitment artifact** — once locked, scope
changes mid-sprint require an `:::escalation` block.

## When to use
- Thursday of every cycle (the load-bearing ceremony of the week).
- Re-planning when a P1 escalation forces mid-sprint scope re-cut.

## Inputs
- Locked PRD (`:::artifact template: prd-template`) from Wednesday
- Feasibility scoping (`:::artifact template: tech-feasibility-scoping`)
- Carry-over from cycle N (work in flight)
- Team velocity — **historical**, not aspirational, last 3 cycles trimmed
  mean
- Capacity: planned PTO, recurring ceremonies, on-call rotation, support
  load
- CS-flagged in-flight escalations (Thursday morning handoff)

## Process

### 1. Capacity check
- Calculate available person-days for the cycle.
- Subtract **20% overhead** (meetings, code review, unplanned work,
  context-switch cost).
- Subtract on-call rotation hours (one engineer's week, conservatively).
- Subtract any PTO and known team events.
- The remaining number is **committable capacity** — not a target, a
  ceiling.

### 2. Pull from sources, in priority order
1. **Carry-over from cycle N** that did not ship — these have already
   consumed discovery and design time; finishing them is highest-leverage.
2. **CS-flagged in-flight escalations** that the locked PRD doesn't
   already cover. CS owns the *signal*; PM converts to scope; eng-manager
   slots based on severity.
3. **Locked PRD** acceptance criteria, in PM's priority order.
4. **Tech debt** — allocate 10–20% of capacity each cycle. Pull from the
   tech-debt register, prioritized by impact-to-value.
5. **Slack** — leave 10–15% buffer for bugs and small unplanned work.
   This is **not** optional. Sprints with zero slack always slip.

Stop pulling when committable capacity is reached. Items below the line
go back to backlog with explicit reason.

### 3. Owner + DoD per item
- Every item has a **single named owner**. Pair work is encouraged but
  one name owns the close.
- Every item has a **definition of done** copied or adapted from the
  PRD's acceptance criteria. "Code merged" is not done; "feature flag
  on for 100% of internal users with no regression in primary metric"
  is.

### 4. Dependency review
For each committed item:
- Cross-team dependencies — who, what, when do we need it.
- External dependencies — vendor SLAs, API rate limits, data feeds.
- Internal dependencies — does item B require item A? Sequence them.

Flag risks. If a dependency is **blocking** rather than **delaying**, it
goes to PM as a scope decision (drop the dependent item or push the cycle).

### 5. Sprint goal (one sentence)
The team commits to **one** sentence describing what the cycle delivers.
"Ship the export-digest feature flag-on for 50% of paid users with
≥95% delivery success" beats "Make exports better."

### 6. Risks and mitigation plan
- Top 3 risks pulled from feasibility scoping + dependency review.
- For each: trigger condition, mitigation, escalation owner.

### 7. Commitment
Team collectively commits to the sprint goal. **No top-down scope
injection mid-sprint** — that's what the `:::escalation` block is for.

## Output (`:::artifact template: sprint-planning`)
- Sprint goal (one sentence)
- Capacity summary: total / committable / committed / slack
- Sprint backlog with owners + DoD
- Carry-over items (with reason they didn't ship cycle N)
- Dependency map
- Top 3 risks with mitigations
- Items below the line + reasons
- `producedBy: eng-manager`, `consumedBy: [pm, designer, customer-success]`

## Anti-patterns

- **Velocity inflation.** Using the team's best cycle as the baseline.
  Use the trimmed mean.
- **Scope = capacity.** Filling every committable hour. Slack is required.
- **Story-point cosplay.** If the team uses points, points must be
  calibrated against historical actual hours, not vibes.
- **Sprint goal salad.** Five sprint goals = no sprint goal. Pick one.
- **Mid-sprint silent scope changes.** Changes go through escalation,
  not Slack DMs.

## Escalation rule
Mid-sprint scope changes require an `:::escalation` block from PM. The
block names what's added, what's dropped to make room, and the trade-off.
