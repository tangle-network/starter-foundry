# Trade-off Analysis Template

## Purpose
Compare 2–4 architectural options against the system's quality
attributes, surface the trade-offs explicitly, and produce a
defensible recommendation. Trade-off analysis is the substrate of
a good ADR; ADR captures the decision, this template captures the
reasoning.

## When to use
Trigger when a decision has more than one viable path and the
right answer depends on which qualities the system values most.
Database choice, sync vs async, monolith vs microservices,
build vs buy, framework selection.

## Method

1. **Frame the decision.** State the question in one sentence.
   "Should the order pipeline be synchronous request/response or
   async event-driven?"
2. **Enumerate options.** 2–4 distinct paths. Each gets a name,
   a one-paragraph description, and a sketch of the
   implementation shape. More than 4 options usually means the
   decision space hasn't been pruned; consolidate.
3. **Pick quality attributes that matter.** Don't compare on
   "everything"; pick the 5–8 attributes whose values differ
   meaningfully across options. Common attributes:
   - **Performance**: latency (p50, p99), throughput, scalability
     ceiling.
   - **Availability**: uptime, blast radius of failure, recovery
     time.
   - **Consistency**: strong / eventual / causal; staleness
     tolerance.
   - **Durability**: data-loss tolerance, backup integrity, RPO.
   - **Cost**: TCO including ops, license, compute, storage,
     egress, on-call burden.
   - **Security**: attack surface, data-at-rest exposure, blast
     radius.
   - **Operability**: monitoring, debugging, on-call experience,
     deploy/rollback.
   - **Evolvability**: how this option ages with scale, with
     regulatory change, with team turnover.
   - **Time to value**: how soon the option ships.
   - **Vendor risk**: lock-in, EOL exposure, pricing power.
4. **Score per attribute, per option.**
   - Use a consistent scale (1–5 or H/M/L). Justify each cell
     with one sentence — never a bare number.
   - Where data exists, put numbers (latency, $/month). Where
     it doesn't, name the assumption.
   - **Asymmetric weight** the attributes by what the system
     actually values. Latency-critical systems care less about
     vendor risk; regulated systems care less about time to
     value. The weight matrix is a forcing function — without
     it, comparison is naïve weighted-average.
5. **Identify the dominant trade-off.** Most decisions reduce to
   one or two key tensions:
   - Consistency vs availability (CAP).
   - Latency vs durability.
   - Coupling vs autonomy.
   - Cost vs flexibility.
   - Time to value vs technical debt.
   Naming the dominant trade-off lets the team make a
   *decision*, not a feature comparison.
6. **Sensitivity analysis.** Vary the most important assumptions
   (volume, latency target, cost per unit) and check whether the
   ranking flips. If a small change in one input flips the
   answer, the decision is fragile — name that.
7. **Recommend with a fallback.** Make a recommendation. Also
   name the second-best, and the conditions under which the team
   should switch.
8. **Surface what isn't yet known.** Many trade-offs depend on
   data the team doesn't have yet (real production load, real
   error rates). Explicitly mark those as assumptions and tie
   them to the ADR's review trigger.

## Worked example (sketch)

Question: Should the order pipeline be synchronous (HTTP RPC
with strong consistency) or asynchronous (event-driven with
eventual consistency)?

| Attribute      | Sync (RPC)            | Async (events)         | Weight |
|----------------|------------------------|------------------------|--------|
| Latency p99    | 280ms (measured)       | ~80ms publish + 1–5s settle | High |
| Availability   | 99.5%; cascade risk    | 99.95%; partial degradation | High |
| Consistency    | Strong (read-after-write) | Eventual (1–5s lag)    | Medium |
| Cost           | $X/mo                  | $1.4×X/mo (broker)     | Medium |
| Operability    | Existing patterns      | New broker to operate  | Medium |
| Evolvability   | Tight coupling         | Loose coupling         | High |
| Time to value  | 2 weeks                | 6 weeks                | Medium |

Dominant trade-off: read-after-write consistency vs availability /
evolvability. Sync wins on consistency and time-to-value; async
wins on availability and evolvability under future scale.

Recommendation: async (events) for new pipelines; keep sync for
existing high-consistency reads. Re-evaluate if event broker
operational cost exceeds $Y/mo or async lag exceeds 5s p99.

## Common analysis failures

1. **Comparing on everything.** A 20-attribute matrix dilutes
   signal. Prune to the attributes that actually differ.
2. **No weights.** All attributes treated equal, hiding which
   the org cares about.
3. **Numerical theater.** Adding 1–5 scores when the cells are
   guesses gives false precision.
4. **Forgotten op-cost.** Many "cheap" options are cheap in
   compute and expensive in on-call burden.
5. **Status-quo bias.** Existing tech wins by default unless the
   review forces a real comparison.
6. **No second-best with switch conditions.** Without it, the
   team can't recover when assumptions break.
7. **Ignoring carrying cost.** Some options have low entry cost
   and high removal cost (vendor lock-in, schema migration). Name
   the exit path.

## Output

```
:::artifact
template: trade-off-analysis
question: "..."
options:
  - { name: "A", desc: "..." }
  - ...
attributes:
  - { name: "latency-p99", weight: "high" }
  - ...
matrix:
  A: { latency-p99: { score: 4, note: "280ms measured" }, ... }
  B: { ... }
dominant-trade-off: "..."
sensitivity: "..."
recommendation: "B with fallback to A under conditions X, Y"
unknowns: [...]
:::
```

## Refusal

The agent will not:
- Recommend an option without surfacing the dominant trade-off.
- Score attributes that don't differ meaningfully across options.
- Treat status quo as the default; require it to be evaluated on
  the same matrix.
