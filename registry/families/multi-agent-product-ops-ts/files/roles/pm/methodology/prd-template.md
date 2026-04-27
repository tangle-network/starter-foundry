# PRD Template (PM)

## Purpose
A falsifiable PRD. Every feature names a hypothesis, a primary metric, a
sample-size proxy, and a kill criterion. PRDs missing any of the four are
**not locked** — they go back to discovery.

## When to use
- Wednesday PRD lock, after Tuesday's design + feasibility handbacks.
- Any time the PM is asked to "spec a feature" — refuse without the four
  required fields.

## The PRD structure

### 1. Problem statement (≤3 sentences)
- What user job is unsolved or solved badly today?
- For whom (named persona, not "users")?
- What evidence proves the job is real (discovery cycle ID + observations)?

### 2. Hypothesis
- "We believe **building X** for **persona Y** will result in
  **measurable outcome Z** within **timeframe T**."
- The hypothesis must be testable. "Users will love it" is not testable.
  "Weekly active export users will increase by 15% within 30 days" is.

### 3. Primary metric (one only)
- The single number that tells us if the hypothesis is true.
- Must be **measurable** (instrumented or instrumentable in the sprint),
  **timely** (moves within the test window), and **actionable** (the team
  can act on the result).
- Refuse a PRD with five co-equal metrics. Pick one. Name the others as
  guardrails (don't regress these), not primaries.

### 4. Sample-size proxy
- How many users / events do we need to observe before drawing a
  conclusion? Use statistical significance if you have the volume; a
  practical threshold otherwise.
- Example: "≥200 export sessions or 30 days, whichever first."
- This sets the **kill criterion's clock**. Without it, kill criteria
  drift.

### 5. Kill criterion
- What result causes us to stop or pivot? **Pre-defined, not post-hoc.**
- Example: "If weekly export users do not increase by ≥5% within 30 days
  of full-rollout, we pull the feature and revisit discovery."
- The kill criterion is the team's commitment to itself. PM enforces it
  on Friday's retrospective.

### 6. Scope: in / out
- **In scope:** acceptance criteria, in priority order. Designer and
  eng-manager use this for fidelity-trim and capacity-trim Thursday.
- **Out of scope:** named exclusions. Anything not listed in/out is
  decided by PM on the fly during the sprint.

### 7. UX strategy reference
- Link to designer's `:::artifact template: ux-strategy` from Tuesday.
- Name the **fidelity** the design will ship at and **why** that
  fidelity matches the discovery question.

### 8. Feasibility reference
- Link to eng-manager's `:::artifact template: tech-feasibility-scoping`
  from Tuesday.
- List the unknowns that remain at Wednesday's lock — these are sprint
  risks, not deal-breakers.

### 9. Dependencies and risks
- Cross-team dependencies (named team + named contact)
- External dependencies (named API, library, vendor)
- Top-3 risks with mitigation plan

### 10. Rollout plan
- Internal → 10% → 50% → 100%, or named alternative.
- Telemetry to watch at each gate.
- Rollback plan if telemetry goes red.

### 11. Success criteria for the cycle retrospective
- What evidence on Friday-of-cycle-N+1 would let the team mark the PRD
  "won"? "Lost"? "Inconclusive — extend telemetry window"?

## Anti-patterns

- **Aspirational PRDs.** "We will increase engagement" without a defined
  engagement metric is not a PRD — it's a wish.
- **Metric salad.** Five primary metrics means no primary metric.
- **Soft kill criteria.** "We'll evaluate after launch" is not a kill
  criterion. The criterion must be actionable on a date.
- **Scope creep cover.** PRD locks Wednesday. Mid-sprint additions
  require an `:::escalation` block, not a quiet edit.

## Output (`:::artifact template: prd-template`)
- All 11 sections filled
- `producedBy: pm`, `consumedBy: [designer, eng-manager]`
- Linked discovery-cycle ID (the riskiest assumption being tested)
- Linked RICE row (the score that placed it in this sprint)
