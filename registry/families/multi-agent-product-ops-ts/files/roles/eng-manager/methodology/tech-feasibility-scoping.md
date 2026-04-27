# Tech Feasibility Scoping (Engineering Manager)

## Purpose
Answer "can we build this and at what risk?" — not "how many story points?"
The output is a structured **unknowns list** that PM uses Wednesday to lock
or re-scope the PRD. A clean estimate without unknowns is a fiction; this
methodology refuses to ship one.

## When to use
- Tuesday scoping, after PM hands the discovery one-pager.
- Any time PM asks "is this feasible?" outside the cycle.
- When a CS-surfaced theme requires re-scoping a locked PRD mid-sprint.

## Inputs
- PM's discovery one-pager (the riskiest assumption + decision being made)
- Any prior feasibility reports for adjacent features
- Current system architecture state (versions, flag state, dependencies)
- Team's recent velocity + named PTO/ceremony load

## Process

### 1. Decompose the PRD into capabilities
Walk the discovery one-pager and list the **distinct capabilities** the
feature requires. Capabilities are technical, not user-facing.
Example for "weekly export digest":
- ingest user export history
- aggregate per-user weekly
- render digest template
- deliver via email channel
- handle unsubscribe

### 2. Classify each capability
For each capability, label it **exactly one** of:

- **known** — we've shipped this pattern before; estimate is straightforward
- **spike-needed** — requires investigation; name the spike scope and
  duration (≤ 2 days, single engineer)
- **blocked** — depends on a system, team, or vendor we cannot move; name
  the blocker and who must unblock

### 3. Surface the cross-cutting concerns
Walk the capability list against:

- **Data** — schema changes, migration risk, backfill cost
- **Auth/permissions** — new scopes, new identity surfaces
- **Telemetry** — what the PRD's primary metric requires us to instrument
- **Performance** — does the feature touch a hot path? p95 budget?
- **Security** — new attack surface, secrets, PII flow
- **Compliance** — data residency, retention, audit requirements
- **Rollback** — can we toggle this off without data loss?

Each concern that adds risk gets its own row in the unknowns list.

### 4. Capacity sanity-check
- Sum the known capabilities at high-end estimates.
- Add spike time for spike-needed items.
- Compare to **historical velocity** for the team — never aspirational.
- If the sum exceeds 50% of available capacity, name it explicitly. PM
  decides whether to trim scope or split across cycles.

### 5. Risk ranking
For each spike-needed and blocked item, rate:
- **Probability the risk fires** (low / medium / high)
- **Blast radius if it fires** (slip cycle / slip quarter / break prod)
- **Mitigation** (what we'd do to reduce probability or blast)

## Output (`:::artifact template: tech-feasibility-scoping`)
- Capability table (capability → known / spike-needed / blocked → notes)
- Cross-cutting concerns list
- Top-3 risks with probability × blast × mitigation
- One-line **biggest concern** handed to PM end-of-day Tuesday
- `producedBy: eng-manager`, `consumedBy: pm`

## Anti-patterns

- **Single-number estimates.** "Two weeks" without the unknowns list is a
  guess. PM should refuse it; eng-manager should refuse to give it.
- **Spike avoidance.** Marking everything "known" to look decisive. The
  unknowns are where the schedule slips; surface them honestly.
- **Sandbagging.** Marking known work as spike-needed to buffer. Erodes
  trust with PM and the operator.
- **Capacity by committee.** "We could probably fit it" is not capacity.
  Numbers, named people, named velocity.

## Escalation rule
If a single capability is **blocked** by a dependency requiring an outside
team, OR cumulative spike-needed time exceeds 30% of cycle capacity, emit
an `:::escalation` block to PM **before** Wednesday's PRD lock.
