# Pattern: Lying Metric

**Named in:** R2 → C arc (2026-04-24)
**Sibling pattern:** [muffled-gate.md](muffled-gate.md) — same shape (silent
failure), different layer (measurement vs gating)

## Shape

Measurement infrastructure that compiles, runs, and produces a number — but
the number is noise, empty, or a proxy for something other than what the
scorecard claims to measure. Unlike a muffled gate (which silently lets
bad code ship), a lying metric silently points optimization attention at
the wrong thing: teams chase a red flow that was never really red, or
declare victory on a green flow that was never really green.

Both patterns are "something that should fail loud returns silent
success." The muffled gate fails loud by rejecting bad code. The lying
metric fails loud by returning `null` / `undefined` / `NaN` instead of
fabricating a number.

## Sub-shapes observed

1. **Denominator pollution.** The metric's denominator includes events
   the metric's definition excludes. Example: `proposal_promotion_rate`
   counted test-fixture `promote-failed` events because the tests spawned
   the real promoter script without a synthetic-run env flag.
2. **Silent-fail aggregator.** The aggregation call silently returns
   empty when the method name is wrong or the input is null. Example:
   `costTracker.getSummary?.() ?? {}` — typo on method name + optional
   chain + nullish default = three layers of sound-suppression. TypeScript
   can't catch it (runtime-dispatched property access), the writer saw
   `{}` on disk and moved on.
3. **Never recorded.** The collector is created but never written to.
   Example: `costTracker` instantiated at module load, zero `.record()`
   calls in the per-scenario loop, end-of-run `.summary()` returns an
   empty rollup.
4. **Event-level double-counting.** The metric counts events instead of
   unique entities, inflating the denominator on retry workflows. Example:
   a proposal that was promoted → reverted → re-promoted contributes 2
   promoted events + 1 revert, so `(promoted.length - revertedPromoted) / (promoted+failed)` halves the rate for successful retry-and-ship.
5. **Missing upstream emission.** The metric reads a field the source
   pipeline never populates, and the scorecard reports `null` instead of
   flagging "source doesn't emit this." Honest with intent, but the null
   shows up as a red flow in the scorecard summary and gets mistaken for
   a real gap. Example: `cost_usd_per_buildout` reads
   `buildout-analysis.json`'s `costRollup.meanCostUsd` — VB doesn't emit
   `outcome.costUsd`, so the field stays null indefinitely.

## Live instances (closed in R2 / R3 / C arc)

| # | Sub-shape | Location | Closed in |
|---|---|---|---|
| 1 | Denominator pollution | `proposal_promotion_rate` — test-fixture events counted | R2 / PR #59: `STARTER_FOUNDRY_SYNTHETIC_RUN=1` env gate on promoter `logImpact` + fixture-id filter in scorecard |
| 2 | Event-level double-counting | same metric — reverted-then-re-promoted ids counted twice | R2 / PR #59: `latestByIdPromote` map — count unique id outcomes, not events |
| 3 | Silent-fail aggregator | `costTracker.getSummary?.() ?? {}` — method name typo | C / PR #61: `.summary()` correct name |
| 4 | Never recorded | `costTracker` created but `.record()` never called | C / PR #61: record per-seed after `invokeMetaJudge`, using its new `usage` field |

## Still in the tree (honest-null, not closed)

| # | Sub-shape | Location | Why acceptable |
|---|---|---|---|
| 5 | Missing upstream emission | `cost_usd_per_buildout` = null — VB's `outcome.costUsd` is never populated | Read comment in `refresh-scorecard.mjs` line 310: "Null when no run has emitted cost yet — signals 'measurement not wired up' instead of faking a number." Documented honest-null is better than a lie. |
| 6 | Missing upstream emission | `agent_eval_meta_pass_rate` = null — LLM judge doesn't run without creds | Same rationale. |

Both #5 and #6 are honest-null by design. They're RED on the scorecard
because target > null, but the comment and null value together say "not
measured yet, don't optimize against this number."

## How to avoid

When writing a new scorecard flow OR reviewing one:

1. **Probe the data, not the number.** Before trusting a metric that
   reads suspicious, run a direct probe: count events by type, sample
   raw records, check mtimes. In R2 I ran a Python script against
   `generation-impact.jsonl` that immediately exposed the pollution.
2. **Count entities, not events, for ratios.** If the metric is "fraction
   of X that succeeded," dedupe by X before dividing. Events are noisy
   (retries, reverts); entities are the thing the claim is about.
3. **`.call()` is not safer than `.call()`.** An optional chain on a
   typo'd method name returns undefined silently. If the method is
   required for the flow, call it directly and let the error fire.
4. **Differentiate honest-null from lying-null.** A metric that reads
   null because its source doesn't emit yet is honest (document the
   expected population point). A metric that reads null because of an
   aggregation bug is lying. They look identical on the scorecard.
5. **Test fixtures must not write to production logs.** Either filter at
   write time (env var gate) or at read time (id/message pattern).
   Filter-at-write is safer — test runs are more common than scorecard
   refreshes, so polluted data accumulates faster than it's cleaned.

## Regression guard

`tests/proposal-rate-measurement.test.ts` + `tests/agent-eval-cost-tracking.test.ts`
assert the specific fixes from PR #59 and PR #61 stay in place:

- Promoter scripts gate `logImpact` on `STARTER_FOUNDRY_SYNTHETIC_RUN`.
- Scorecard filter includes known fixture-id patterns + 'already exists'
  idempotency message.
- Scorecard computes `proposal_promotion_rate` as unique-id outcomes,
  not raw event counts.
- `invokeMetaJudge` return type declares `usage` field.
- `agent-eval-scaffold.mjs` contains `.record()` + `.markOutcome()` +
  `.summary()` (and NOT `.getSummary`).

A silent regression on any of these fails CI.

## For future proposers

Before shipping a change that touches a scorecard flow computation:

1. Does the flow's filter exclude test-fixture events (or is there a
   write-time env gate that makes the filter unnecessary)?
2. Does the aggregation call use the exact method name the library
   exports? Spot-check by running the library import + method call
   directly, not just through the code path.
3. If the metric is a ratio, does the denominator count entities or
   events? If events, does the event shape carry retry/revert
   relationships that should be collapsed?
4. If the metric reads a field from upstream, does the upstream
   actually emit it? If not, is the null documented?

If any answer reveals a potential lie, fix it before merging. Honest-null
is better than a lying-number, but a test-pinned truth is better than both.
