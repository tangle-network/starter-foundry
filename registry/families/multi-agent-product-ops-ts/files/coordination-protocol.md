# Coordination Protocol — Weekly Product Cadence

This document is the **wiring diagram** for the four roles. Each role has its own
system prompt and methodology library; this file specifies who talks to whom,
when, with what artifact, and what kicks off the next handoff. Without this
file the team is four monologues.

The cadence is a **calendar week**. Monday is sharpest at the start of a
discovery cycle; Friday is sharpest at the end of a build cycle. The team
overlaps phases — discovery for the next feature runs in parallel with the
build of the current one.

## Roles at a glance

| Role               | Owns                                       | Emits                       | Consumes                          |
|--------------------|--------------------------------------------|-----------------------------|-----------------------------------|
| `pm`               | scope, hypothesis, kill criterion          | `:::artifact` PRD, RICE     | discovery notes, CS escalations   |
| `designer`         | flow, fidelity, usability heuristics       | `:::artifact` UX strategy   | PRD, eng feasibility flags        |
| `eng-manager`      | feasibility, capacity, sprint plan         | `:::artifact` sprint plan   | PRD, design fidelity, CS bug-rate |
| `customer-success` | user pain, churn risk, QBR readouts        | `:::artifact` health report | sprint plan, ship notes           |

Every cross-role artifact is wrapped in `:::artifact` and tagged with a
`producedBy:` field so the receiving role knows the provenance.

## Weekly cadence (one feature cycle = ~2 weeks; two cycles overlap)

### Monday — Discovery sync (PM-led)

- **PM** opens with the riskiest assumption for the *next* feature (cycle N+1)
  and the discovery cycle status (interviews scheduled, prototype tests
  planned). Emits `:::artifact template: discovery-cycle`.
- **CS** brings the top 3 churn-risk and top 3 escalation themes from the
  prior week (`:::artifact template: churn-risk-analysis`). PM treats these as
  **discovery inputs**, not feature requests.
- **Designer** and **eng-manager** listen only. No scoping yet — discovery
  must crystallize the user job before fidelity or feasibility matter.
- **Output:** PM writes a one-pager naming the user job, riskiest assumption,
  and what evidence would falsify it. Saved as `discovery/<feature>.md`.

### Tuesday — Scoping double-down (Designer + Eng Manager simultaneously)

- **PM** hands the discovery one-pager to designer + eng-manager **in
  parallel** (not sequentially — sequential scoping costs a day).
- **Designer** drafts a fidelity decision (paper / wireframe / interactive
  mock / coded prototype) tied to the question discovery is trying to answer.
  Emits `:::artifact template: ux-strategy` if the feature warrants it,
  else `:::analysis` only.
- **Eng-manager** runs `tech-feasibility-scoping` against the PRD draft.
  Output is **not** a story-point estimate — it's a list of *unknowns*, each
  rated as spike-needed / known / blocked. Emits
  `:::artifact template: tech-feasibility-scoping`.
- **Handback rule:** both roles return to PM by end-of-day Tuesday with their
  artifact + a one-line **biggest concern**. PM merges concerns into the PRD
  draft.

### Wednesday — PRD lock (PM-led)

- **PM** consumes Tuesday's artifacts and locks the PRD using the
  `prd-template` methodology. The PRD is **falsifiable**: hypothesis, primary
  metric, sample-size proxy, kill criterion. No PRD ships without all four.
- **PM** runs `prioritization-rice` against the locked PRD plus any
  competing PRDs in the queue. RICE score is a **tiebreaker**, not the
  decision — PM names the strategic reason this beats the others.
- **Output:** `:::artifact template: prd-template` + `:::artifact template:
  prioritization-rice`. These two go to eng-manager for sprint inclusion and
  to designer for full-fidelity work.

### Thursday — Sprint commit (Eng Manager-led)

- **Eng-manager** runs `sprint-planning` against the locked PRD plus any
  carry-over from cycle N. Capacity check uses **historical velocity**, not
  aspirational; subtract 20% for overhead.
- **PM** is consulted for scope-trim decisions (which acceptance criteria
  drop if capacity is short). Designer is consulted for fidelity-trim
  decisions (which states ship without polished comps).
- **CS** flags any in-flight escalation that should slot into the sprint
  ahead of new work. CS does not own scope; it owns the *signal* that scope
  needs adjustment.
- **Output:** `:::artifact template: sprint-planning`. This is the
  **commitment artifact** — once locked, scope changes mid-sprint require an
  explicit escalation block (see below).

### Friday — Ship review + QBR prep (mixed)

- **Eng-manager** reports cycle-N ship status: shipped, slipped, or pulled.
  Names the systemic cause if anything slipped.
- **CS** runs `qbr-prep` for any customer with a QBR landing in the next
  7 days. Pulls from sprint-ship notes, health-score deltas, and PM's PRD
  history. Emits `:::artifact template: qbr-prep`.
- **PM + CS** run a 30-minute retrospective on the cycle that just shipped:
  did the metric move? Was the kill criterion the right one? Findings feed
  next Monday's discovery sync.
- **Designer** reviews shipped UI against the locked UX strategy and emits
  `:::analysis` calling out drift. Drift is not a failure — it's a discovery
  input for the next cycle.

## Handoff rules

1. **No handoff without an artifact.** A handoff is a `:::artifact` block
   with `producedBy: <role>` and `consumedBy: <role>`. Verbal handoffs do
   not count and cannot be relied on by the next role.
2. **Parallelize Tuesday.** Designer and eng-manager scope the same PRD
   simultaneously. Sequential scoping is the most common cycle-time leak.
3. **PM owns the merge.** Conflicting feedback from designer and eng-manager
   resolves at PM. Neither role escalates above PM unless rule 4 fires.
4. **PRD is locked Wednesday.** After Wednesday, PRD changes require a new
   discovery cycle or an `:::escalation` block. No silent scope creep.
5. **CS is a signal, not a queue.** Customer escalations are discovery
   inputs, not auto-prioritized features. PM converts signal to scope.

## Escalation rules

Any role may emit `:::escalation` when a risk crosses the team's authority.
The escalation block names the kind of decision and the human who owns it.

- **PM escalates** to operator/board when: pivot decisions, kill decisions,
  pricing changes, regulatory risk surfaces in discovery.
- **Designer escalates** to PM when: a fidelity decision blocks discovery
  (e.g., the question requires a working prototype but capacity is paper-only).
- **Eng-manager escalates** to PM when: feasibility is **blocked** (not just
  unknown), a dependency requires an outside team, or capacity is below 50%
  of what the PRD requires.
- **CS escalates** to PM when: a single customer's escalation reflects a
  systemic gap (multiple customers reporting same symptom), or when an
  escalation crosses into legal/security/compliance — those go to the
  operator's counsel, not into the sprint.

When `:::escalation` fires, the affected artifact is **not** consumed by the
downstream role until the operator (human) signs off. The cadence pauses on
that artifact only — other parallel work continues.

## Stakes and advisory limits

This is a **moderate-stakes** team. The team advises; the operator decides.
The team does **not**:

- replace the operator's actual product team or board
- replace the operator's HR, legal, security, or finance counsel
- make pricing, hiring, or pivot calls
- ship code or design assets to production without operator review
- pretend to know cap-table, runway, or interpersonal dynamics it cannot see

Every role names its advisory limit on the first turn of any new conversation
(see each role's `system-prompt.md`).
