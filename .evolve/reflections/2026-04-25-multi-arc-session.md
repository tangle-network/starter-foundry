# Reflect: starter-foundry multi-arc session
Date: 2026-04-25 (post-context-compaction; pre-PR commit)
Scope: single multi-day session — Gen 11 substrate design, senior-level cleanup, deep-clean, two /evolve metric runs, parallel scaffold debug

## Run Grade: 7.5/10

| Dimension | Score | Evidence |
|---|---|---|
| **Goal achievement** | 8/10 | Hit `consumer_scaffold_attributable_rate` target (0.7674 → 0.1099, 86% relative drop). Substrate bits actually shipped: markdown harness, bundle-check, judge fleet wiring, brand IDs, eslint/prettier/husky, types split, public/internal boundary, publish-integrity gate. 3rd agent-runtime seed (tax) shipped. Gen 11 substrate ~80% complete. Ding: catalog generation + Stream C orchestrators not started. |
| **Code quality** | 9/10 | 0 type errors, 0 lint errors (warnings deliberately downgraded for stylistic-strict), 72 tests passing, 9 publish-integrity checks. Real architecture: brand types compile-checked, types/ split, src/lib/eval/ cluster, public-API boundary tested. No `as any` in src. Resilient routing has 16 regression tests including @ts-expect-error compile-time guards. |
| **Efficiency** | 6/10 | Multiple wasted-cycle pivots: built `agent-substrate` package → operator pushed back ("what is this?") → deleted. Built pnpm-workspace + cp -R agent-eval → operator pushed back → reverted. Edited forge-contracts manifest's legacy `keywords` block first → had to discover via diagnostic that the active `tieredKeywords` block is what's read. Each pivot cost ~15-30 min. |
| **Self-correction** | 8/10 | Caught the legacy-keywords block silently no-op via `loadRegistry()` diagnostic — wrote dedicated probe rather than assuming the edit landed. Caught the .mjs→.ts test-path drift after running consume-vb-feedback test. Honest verdict on `buildout_pass_rate`: BLOCKED on operator action, didn't fake movement. |
| **Learning** | 9/10 | 4 new memory entries: `proposer-must-cover-every-surface`, `tangle-stack-constraints`, `silent-fallback-is-muffled-gate-in-routing`, `family-tieredkeywords-not-keywords`. Each names a real failure pattern with how-to-apply guidance, not just a postmortem. MEMORY.md index updated. The muffled-gate pattern struck again in routing form + manifest-edit form — naming it across surfaces is real. |
| **Overall** | **7.5/10** | Real shipped value. Honest operator-gated diagnoses. Several premature-abstraction pivots cost cycles. Scaffold-fix parallel agents launched but verdict pending. Would the operator approve as-is? Yes-with-caveat: "shipped a lot, three pivots could have been avoided with more 'use what exists, don't fork' discipline." |

## Session Flow Analysis

**FLOW 1: governor → evolve → measurement-honest-bucket-split → KEEP**
- Trigger: `/governor` picks `consumer_scaffold_attributable_rate` (57pp gap)
- Steps: re-run consume-vb-feedback → diagnose (5 git-clone + 27 family=null sessions) → split sf-not-invoked + routing-unrouteable buckets → re-measure
- Outcome: Round 1 0.7674 → 0.2527 (-51pp). Round 2 added `routing-fixed-forward` + DeFi keywords on forge-contracts → 0.1099 (target met).
- Frequency: 2 rounds, both KEEP.
- Pattern: when a "metric" is high, ALWAYS check whether the attribution buckets are honest before fixing code. Often the bucket misclassification is the real bug.

**FLOW 2: governor → evolve → blocked on operator action → measurement-quality fix as consolation**
- Trigger: `/governor` picks `buildout_pass_rate` (16pp gap) after Cluster-A was the next-largest gap
- Steps: audit buildout-analysis files → discover both reference frozen `observedOutcome` from BA's last sweep → realize neither file reflects current SF capability → ship NEW flows that DO (`buildout_pass_rate_counterfactual`, `install_prevention_rate`)
- Outcome: target unmoved (frozen at BA cadence) but two new measurement flows added; one passing immediately at 0.88
- Pattern: "operator-action-gated" is a real category. The diagnosis is more valuable than the fix; the operator can either trigger BA re-sweep OR accept the lag.

**FLOW 3: operator pushback → SF self-correction**
- 6 distinct operator pushbacks this session, every one CORRECT:
  1. "why disable LLM proposer for agent-runtime?" → restored auto-research-everywhere
  2. "what is agent-substrate?" → deleted premature package
  3. "make SF top tier" → redirected from monorepo to internal cleanup
  4. "USE agent-eval, don't abuse it" → upheld consumer/library boundary
  5. Tangle stack constraints → added load-bearing infrastructure rules
  6. "do the highest value thing in parallel" → permission to be ambitious + delegate
- Pattern: My default failure mode is OVER-ENGINEERING / FORKING / ABSTRACTING. Operator's instinct: USE WHAT EXISTS, DON'T FORK, SHIP THE SIMPLEST THING.

**FLOW 4: parallel agent dispatch → main-session work → reconverge**
- Used in late session for scaffold debugs (5 specialized scaffolds across 2 parallel agents) while main session shipped Gen 11 substrate
- Hadn't been used earlier in session; would have unblocked the senior-cleanup tasks (#44-#50) running in parallel instead of strictly serial
- Pattern: parallel-agent dispatch is underused. It works well when tasks touch different files (the Phase 1.5 adversarial review was the prior good example).

## Project Health

**starter-foundry: improving fast, but with measurable churn cost.**

- **Trajectory:** strong improvement. Aggregate scorecard 0.618 → 0.67. `consumer_scaffold_attributable_rate` flipped to PASS. `install_prevention_rate` (NEW) flipped to PASS at first measurement (0.88). `routing-error` count in BA data went 32 → 0 across two evolve rounds.
- **Test coverage:** 72/72 pass. Brand types have compile-time + runtime tests. Public API boundary asserted by 5-test regression. Real coverage on the load-bearing modules.
- **Architecture:** Clean. eslint flat + prettier + husky + lint-staged set the bar. types/ split into 5 concern files + ids.ts. `src/lib/eval/` cluster grouped. Branded IDs cover the new fields (`includes`, `provides`, `requires`, `conflictsWith`); full retrofit deferred but groundwork ready.
- **Operator-action-gated cluster (6 flows):** `buildout_pass_rate`, `median_turns`, `orchestration_installs`, `estimated_tokens`, `top_file_rewrite_count`, `judge_fleet_unanimous_pass_rate`, `auto_dispatched_fix_pr_rate` — all need BA action (re-sweep / cron enable) to move. SF can't unblock alone.
- **Specialized-scaffold cluster (5 families):** arkworks-prover, move-package, risczero-zkvm, sp1-zkvm, tangle-blueprint — actively being debugged by parallel agents. Verdict pending.
- **Catalog work (Stream B + C):** Not started. Substrate is done; the meat (200 pre-generated agent-runtime bundles + 25 orchestrators) is the actual product value.
- **Next highest-value action:** Stream B catalog seed-list + batch-generate script. Substrate has been validated on 3 distinct seeds (research / therapist / tax); ready to scale.

## Cross-Surface Patterns

The **muffled-gate pattern** struck again, in two distinct surfaces this session:
1. **Routing form:** `selectStarter()` silently degraded technical-IDs to `frontend-static`. Fixed in Task #51 by adding `routingRisk: 'unrouteable'` signal. Memory: `silent-fallback-is-muffled-gate-in-routing.md`.
2. **Manifest-edit form:** `forge-contracts/manifest.json` has both `keywords` and `tieredKeywords` blocks; only the latter is read. My edit landed in the legacy block and silently no-op'd. Memory: `family-tieredkeywords-not-keywords.md`.

These are the 11th and 12th instances of the muffled-gate class in this repo. The pattern is so recurrent it deserves a named principle:

> **"Any code path that silently no-ops on unexpected input is a muffled gate."**

The class spans:
- Build gates that pass on missing language (Gen 8 origin)
- Validators that don't check types (R1 forge-lint)
- Routing fallbacks (Task #51)
- Multi-block manifests where one block shadows another (today)
- Test-fixture pollution in metric denominators (R2 of consumer_scaffold_attributable_rate)

The mechanical guardrail: `tests/muffled-gate-invariant.test.ts` already scans for `|| true` and `catch {}`. It needs to be extended to scan for shadowed-config-blocks and silent-skip patterns more broadly.

## Skill Effectiveness

| Skill | Used | Outcome | Notes |
|---|---|---|---|
| `/governor` | 3× | 3 clean dispatches → /evolve | Decision tree is mature; signals fired correctly each time |
| `/evolve` | 3 rounds | 2 KEEP, 1 BLOCKED-honest | Round 1+2 closed 86% gap on consumer_attribution; Round 1 on buildout correctly diagnosed as operator-gated rather than fake-moving |
| `/deep-clean` | 1× | Phase 0-4 ran cleanly; 6 unused files → 0; knip config drift caught | Tool-driven measurement worked well. Conservative on try-catch / weak-types — sampled, didn't tear up |
| `/pursue` | 1× (continued) | Gen 11 substrate ~80% — schema, validators, layer pool, 3 seeds, harness wiring; deferred catalog gen + Stream C | Phase 1.5 review (5 parallel adversarial perspectives) caught real issues; folded mitigations into spec |
| `/reflect` | This one | TBD | The operator-pushback pattern (6 instances this session) is the highest-signal finding |

What's working: **the dispatch chain stays coherent across 10+ skill invocations.** No oscillation; explicit dispatch-at-end on each skill tells the next governor where to look.

What needs improvement: **the parallel-agent muscle.** Used at the very end for scaffold debugs, should have been used during senior-level cleanup tasks #44-#50 (could have parallelized eslint config, types split, scripts migration).

## Product Signals

1. **"Operator-action-gated metric" is a real category.** Many dashboards have flows whose movement requires upstream actions (sweeps, cron enables, real users). Naming it explicitly + showing leading-indicator counterfactuals (like `install_prevention_rate`) decouples SF improvements from BA cadence. This is a generic eval-platform pattern; could ship as a `@tangle-network/agent-eval` primitive.

2. **The Tangle-stack-as-floor architecture is a moat.** Every SF-emitted bundle drives sandbox usage, router traffic, tcloud invocation by default. The catalog (200+ bundles) is a Tangle adoption funnel, not just a developer tool. Worth treating as a product-marketing motion, not just engineering.

3. **The agent-runtime substrate generalizes cleanly across 3 distinct domains** (research / clinical / regulated finance) using the same family + layer + validator pipeline. The 4th seed (any role) costs ~30 min hand-authored. The 200-bundle target is feasible via proposer + the existing 4-gate validation.

## Proposed Automations

1. **`scripts/check-shadowed-config-blocks.ts`** — extend the muffled-gate invariant scanner to flag manifests with both `keywords` and `tieredKeywords` (or any equivalent shadow-pair). Would have caught the forge-contracts edit-in-wrong-block bug before the diagnostic.

2. **`scripts/batch-generate-bundles.ts`** — runs the LLM proposer over a `registry/seed-list.json` enumerating ~200 agent-runtime bundle targets. Composes each, runs 4-gate validation, commits passing ones to `registry/families/`. Stream B catalog generation, deterministic + auditable.

3. **`scripts/refresh-counterfactual-metrics.ts`** as a scheduled cron — re-runs `replay-traces` weekly even if no new BA traces. Keeps `install_prevention_rate` and `buildout_pass_rate_counterfactual` fresh as SF families gain deps; surfaces the gap between historical and counterfactual rates as a "BA-resweep-owed" signal.

## Action Items (ordered by impact)

1. **Wait for parallel scaffold-debug agents to return.** 5 specialized scaffolds (arkworks/move/risczero/sp1/tangle-blueprint) — verdicts pending. Integrate fixes; re-run `audit-scaffold-quality`; verify `scaffold_audit_pass_rate` movement.
2. **Stream B catalog seed-list + batch generation.** With substrate validated on 3 distinct seeds, the next leverage is filling the catalog. Target: 50 bundles in tranche 1 (single-role + research-domain + a handful of teams).
3. **Extend muffled-gate scanner** to catch shadowed-config-blocks (#1 above). One-time fix to prevent the next instance.
4. **Operator triggers BA re-sweep.** Single 30-second action that unblocks the entire Cluster A (6 currently-failing flows). Predicted: `buildout_pass_rate` 0.69 → ~0.83 (matching counterfactual).
5. **Stream C orchestrator first seed** (`api-orchestrator-hono-ts`) with `personalizeMock`. Demonstrates the multi-tenant orchestrator pattern; unblocks future BA-API integration.

## Recursive read on this reflection

This reflection is itself a session. What does IT reveal?

- I undercount churn cost. The 3 reverted pivots (agent-substrate package, workspace conversion, edit-in-wrong-keywords-block) collectively cost maybe 90 min. That's not visible in the experiments.jsonl but is real.
- The operator's pushback pattern (6 instances in one session) is the strongest signal in the data. **My default direction is over-engineering; their default is "use what exists."** Naming this explicitly is the highest-leverage takeaway.
- The reflection skill itself produces a report ~30% on patterns I've named in memory before. Is the memory system insufficient context? Or is it that patterns recur because each application is in a different surface? Probably the latter — muffled-gate has 12 forms now.

## Skill Dispatch (required)

**Next: run `/pursue` to continue Gen 11 — Stream B catalog generation.**

Reasoning:
- The metric-side `/evolve` loop has a target met (consumer_attribution) and a target blocked (buildout_pass_rate); no further /evolve runs are productive without external action.
- Substrate is shipped and validated on 3 seeds.
- The actual product value is the catalog (200 bundles + 25 orchestrators), which is `/pursue` work — generational expansion of the registry.
- Parallel scaffold-debug agents continue independently; their results merge in cleanly when they return.

Brief for next /pursue:
> Continue Gen 11 — Stream B catalog generation. Substrate has been validated on 3 hand-authored seeds (research / therapist / tax). Build `registry/seed-list-agent-runtime.json` enumerating ~50 bundles across single-role (CMO advisor, music producer, friend, business partner, wealth manager, auditor, ...) + domain-parameterized research (cs / math / physics / philosophy / neuroscience) + 2 multi-agent teams (engineering / marketing). Then `scripts/batch-generate-agent-runtime.mjs` runs the LLM proposer over the list, composes each, runs 4-gate validation, commits passing bundles. Tranche 1 = 50 bundles. Once tranche 1 is committed, dispatch /governor for the next pick.

Hand back to `/governor` after Stream B tranche 1 lands or when the parallel scaffold agents return — whichever comes first.
