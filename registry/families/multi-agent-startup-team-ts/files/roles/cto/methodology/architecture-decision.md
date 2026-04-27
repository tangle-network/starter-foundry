---
capability: architecture-decision
status: active
source: hand-authored, drawn from Michael Nygard (ADR format) + Hohpe + build-vs-buy literature
retrieved: 2026-04-26
---

# Architecture Decision (CTO-led, multi-role priced)

An architecture decision produces a `:::artifact` block tagged
`template: architecture-decision` — an Architecture Decision Record
(ADR) in the Nygard format, with build-vs-buy or option-comparison
math when the decision has cost or vendor implications.

ADRs exist so future engineers (and future you) can reconstruct
**why** the call was made, what was considered, and what would
change the call. An undocumented architecture decision is a
landmine; an ADR is the mine map.

## When to use

- Selecting a database, queue, language, framework, or runtime.
- Designing a system at service-level scope or above.
- Build-vs-buy on any infra component (auth, billing, search,
  analytics, observability).
- Reversing a prior architectural call — write a new ADR
  superseding the old one.
- Operator says "should we use X" — open the ADR, do not answer
  in chat alone.

## Multi-role contributions

| Section of ADR | Contributor |
|---|---|
| Context, options, technical evaluation | CTO |
| Cost / TCO / build-vs-buy math | CFO Advisor (handoff) |
| Customer-visible impact (latency, capability, regional coverage) | CMO (handoff if user-facing) |
| Strategic fit (does the option support the company's bets) | CEO (handoff if the call is non-trivial strategy) |
| Compliance / regulatory blockers (HIPAA, SOC2, GDPR data residency) | escalate to outside counsel |

Default flow: CTO drafts the ADR through "Decision," then **hands
off to CFO Advisor** for cost evaluation if the options have
material cost differences. Hand off to CMO if the call is
user-visible. CEO sign-off is required for Type-1 architecture
decisions (database, primary language, vendor lock-in).

## ADR structure

### 1. Title

`ADR-NNNN: <verb> <noun>` — e.g. "ADR-0007: Adopt PostgreSQL for
primary OLTP store."

### 2. Status

One of: `proposed | accepted | deprecated | superseded by ADR-NNNN`.
A proposed ADR is under review; do not act on it. Accepted ADRs
move into implementation.

### 3. Context

What is the situation that requires a decision? Three to five
sentences. Include the constraints (capacity, deadline, team
skill, compliance, budget). The context is what makes the same
decision look different in two different orgs.

### 4. Options considered

At least three. "Do nothing" is always an option. For each:

- **One-line description.**
- **Pros** (3–5 bullets, technical and operational).
- **Cons** (3–5 bullets, including the failure modes the option
  is bad at).
- **Cost estimate** — if non-trivial, leave blank and mark "pending
  CFO Advisor" — handoff before finalizing.

If there are only two options, you have not stress-tested the
decision. Force a third — even if the third is clearly worse, naming
it sharpens the comparison.

### 5. Decision

The selected option, in one sentence. Decisive language: "We will
use PostgreSQL." Not "we are leaning toward PostgreSQL." An ADR
that hedges is an ADR that has not been written yet.

### 6. Consequences

What changes after this decision is implemented? Include both
positive and negative consequences. Include what becomes harder,
not just what becomes possible. Include any new operational debt
(monitoring, on-call, runbooks) the decision creates.

### 7. What would reverse this decision

Two to three signals that, if observed, would cause the team to
write a superseding ADR. This is the **kill criteria** — write it
now, not after the migration is sunk-cost.

Examples: "If P99 query latency exceeds 250ms at the planned scale,
we revisit." "If we exceed 1TB per primary, we re-evaluate sharding
strategy." "If the vendor's SOC2 lapses, we migrate within 90 days."

### 8. Cost summary (CFO-supplied if priced)

When CFO Advisor has run the math:

- One-time cost (engineering time + migration tooling).
- Ongoing monthly cost (license, hosting, ops time).
- Payback (if option replaces an existing cost).
- TCO over 3 years vs alternatives.

If the cost section is "pending" at decision time, the ADR is
proposed-only — do not move to accepted until CFO Advisor returns.

## Build-vs-buy heuristic

When the decision is "build it ourselves vs use a vendor":

- **Buy** if the capability is **outside the core**: payments,
  auth, transactional email, observability, analytics. Time
  building these is time not building the product.
- **Build** if the capability **is the core**: the agent runtime,
  the inference pipeline, the proprietary algorithm, the
  customer-data graph. Outsourcing the core outsources the moat.
- **Buy with escape hatches** for capabilities that are
  **adjacent to core**: search, vector store, queue. Pick a vendor
  whose API is portable; budget engineering time to migrate if
  needed.

The 3-year TCO often surprises here. CFO Advisor's payback math
will catch the cases where a vendor that's "cheap today" is
expensive at scale.

## Common antipatterns (refuse these)

- **Resume-driven design.** Picking a stack because the engineer
  wants it on their resume. Surface this directly: "what about
  this option serves the business, not the engineer's career?"
- **Big-co-mimicry.** "Netflix uses X." Netflix has 10,000
  engineers and your team has 8. Reject the analogy unless the
  scale is comparable.
- **Premature optimization.** Designing for 10M users when you
  have 200. The ADR's cost section flushes this — you won't pay
  10M-user TCO at 200 users without flinching.
- **No-ADR drift.** A team that ships a major architectural change
  without an ADR is a team that will repeat the conversation in
  6 months. Force the ADR.

## Output shape

```
:::artifact
template: architecture-decision
adr-id: ADR-NNNN
title: <verb noun>
status: proposed | accepted | deprecated | superseded
date: <YYYY-MM-DD>
contributors: [cto, cfo-advisor?, cmo?]
context: <prose>
options:
  - { id: A, description, pros, cons, cost-estimate }
  - { id: B, description, pros, cons, cost-estimate }
  - { id: C, description, pros, cons, cost-estimate }
decision: <one sentence>
consequences:
  positive: <bullets>
  negative: <bullets>
  new-operational-burden: <bullets>
reverse-criteria: <bullets>
cost-summary:
  one-time: <usd>
  monthly: <usd>
  payback-months: <int>
  three-year-tco: <usd>
:::
```

## Escalation

- **Compliance blocker** (HIPAA, SOC2, GDPR data residency) — emit
  `:::escalation` to operator's legal / compliance counsel. Do not
  finalize an ADR with a compliance dimension you cannot anchor.
- **Type-1 decision** (database, primary language, vendor lock-in
  with > 1 quarter exit cost) — emit `:::handoff to: ceo` for a
  decision-journal entry alongside the ADR.

## Source

Michael Nygard, "Documenting Architecture Decisions" (2011) — the
canonical ADR format. Gregor Hohpe, *The Software Architect
Elevator* (architect's role in cost / strategy translation).
Reinertsen, *Principles of Product Development Flow* (cost of
delay vs cost of error). Build-vs-buy heuristic adapted for
startup scale.
