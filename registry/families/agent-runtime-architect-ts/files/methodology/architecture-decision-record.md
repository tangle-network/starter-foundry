# Architecture Decision Record (ADR) Template

## Purpose
Capture an architectural decision in a durable, auditable record
that future engineers can read, critique, and either honor or
explicitly supersede. ADRs are the institutional memory of why a
system is the way it is.

## When to use
Trigger when the user is making a non-trivial architectural choice:
new dependency, new service, new data store, new auth model, new
deployment substrate, new SLA. Don't ADR every PR; do ADR every
decision a future engineer will ask "why did we…" about.

## Format

Each ADR is a single markdown file, numbered (`0007-use-postgres-
for-billing.md`), and immutable once accepted (later ADRs can
supersede; existing ones do not get rewritten).

### ADR-NNNN: [Short title]

#### Status
One of: Proposed / Accepted / Deprecated / Superseded by ADR-XXXX /
Rejected.

Status changes are appended to the file with date and reason — never
deleted.

#### Date
YYYY-MM-DD when the status was set.

#### Context

- The problem being solved (1–3 sentences).
- The forces in play (technical, organizational, business).
- The constraints (budget, timeline, expertise, regulatory).
- What is *not* in scope.

Avoid vagueness here. "Improve performance" is not context;
"the order-export endpoint p99 is 4.8s and our SLA is 1.0s; we
have ~3 weeks; the team has Postgres expertise but not
ClickHouse" is.

#### Decision

- The chosen path, stated unambiguously: "We will <do X> by
  <doing Y>."
- The mechanism: how this decision is implemented.
- The boundary: where the decision applies and where it does not.

#### Alternatives considered

For each alternative seriously considered:
- Description.
- Why it was *not* chosen — the specific blocker (cost, risk,
  capacity, ergonomics).

The alternatives section is the most-read part of the doc later.
Engineers re-evaluating the decision want to see the option they're
about to revisit was already on the table.

#### Consequences

- **Positive**: what this enables / fixes / clarifies.
- **Negative**: what this costs / forecloses / risks.
- **Neutral**: secondary effects worth naming.

Don't pretend negatives don't exist. A decision with no negative
consequences is either trivial or under-analyzed.

#### Compliance / enforcement

- How will the decision be honored in code (lint rule, CI gate,
  architectural fitness function, framework constraint)?
- How will violations be detected?
- What's the override path if a future case genuinely warrants
  deviation?

#### Review trigger

- Conditions under which this decision should be re-evaluated:
  scale threshold, vendor change, regulatory change, expiration of
  vendor contract, new internal capability.
- Without a review trigger, accepted ADRs ossify even when the
  underlying assumptions have changed.

## Worked example (sketch)

> ADR-0023: Use Postgres for the billing event log
>
> Status: Accepted
> Date: 2026-04-26
>
> Context: billing requires append-only event log with strict
> ordering, immediate read consistency, and 7-year retention.
> Volume: ~2K events/sec peak. Team has Postgres expertise; we
> already operate Postgres at this scale for orders.
>
> Decision: store billing events in a dedicated Postgres
> database, partitioned by month. Reads via materialized views
> kept fresh by triggers.
>
> Alternatives considered:
> - **Kafka + S3**: high write throughput; but read consistency
>   requires Kafka Streams or downstream materialization, adding
>   ops surface. No team expertise.
> - **DynamoDB**: managed; but query patterns require multiple
>   GSIs and the per-RU cost projections exceed Postgres TCO at
>   our volume.
> - **ClickHouse**: read-optimized; but eventual-consistency
>   semantics conflict with billing accuracy requirements.
>
> Consequences:
> - Positive: leverages existing Postgres operational expertise;
>   strong consistency; cheap at our volume.
> - Negative: ceiling at ~10K events/sec without sharding;
>   re-evaluate at 5K/sec sustained.
> - Risk: 7-year retention will require partition lifecycle
>   automation; assigned to platform-team.
>
> Compliance: lint rule blocks new billing event writers from
> targeting any other store; weekly partition-health alert.
>
> Review trigger: sustained >5K events/sec, OR cost crosses
> $X/month, OR Postgres EOL announcement, OR if new compliance
> regime requires immutability beyond append-only (e.g., WORM
> storage).

## Common ADR failures

1. **Status never updated.** ADRs go stale; review on the
   trigger.
2. **No alternatives section.** Future engineers can't tell if
   the decision was deliberate or default.
3. **Vague consequences.** "May affect performance" — quantify
   or omit.
4. **No enforcement.** ADRs without lint / CI / framework
   support drift; the decision exists on paper only.
5. **One huge ADR.** Bundling 5 decisions hides the disagreement
   on each. Split.
6. **Late ADR.** ADRs after the code has shipped are
   archaeology, not decision-making. Write them before or
   alongside the work.

## Output

Wrap in `:::artifact` with `template: architecture-decision-record`
and the ADR number. Include the full ADR body.

## Refusal

The agent will not:
- Approve an ADR without alternatives or enforcement section.
- Mark an ADR "Accepted" without a stated review trigger.
- Rewrite an Accepted ADR; it will instead author a superseding
  ADR with a back-link.
