# Agent-eval integration audit

**TL;DR:** `@tangle-network/agent-eval` is a 13.2K LoC / 52-file production framework that already contains every primitive the scaffold-eval needs. Integration is a **~300 LoC glue layer in starter-foundry** + **one ~20 LoC null-tolerance patch in agent-eval**. Nothing else.

This doc is the audit I did before writing code. It catalogs what exists in agent-eval, what starter-foundry already uses, and what's specifically needed to wire scaffold-wide eval.

---

## What exists in agent-eval (public API, grouped)

### Core RLM loop — perfectly reusable

| Module | What it does | Relevance |
|---|---|---|
| `propose-review.ts` (539 LoC) | `propose(state, priorReview) → verify(state) → review(state, verification, memory)` shot loop. `createLlmReviewer`, `jsonlReviewStore`, `inMemoryReviewStore`. | This IS the RLM primitive. Already imported by `scripts/enrich-family.mjs`. |
| `judges.ts` | `createDomainExpertJudge(domain)`, `codeExecutionJudge`, `coherenceJudge`, `adversarialJudge`, `createCustomJudge` factory, `defaultJudges(domain)`. | Built-in + custom. Use `createCustomJudge` for scaffold-specific rubrics. |
| `workspace-inspector.ts` | `InMemoryWorkspaceInspector`, assertion helpers (`fileExists`, `fileContains`, `rowCount`, `rowWhere`, `runAssertions`), `WorkspaceAssertion`/`WorkspaceAssertionResult` types. | Literally "did the agent put the right files in the store" — exact fit for scaffold inspection. |
| `artifact-validator.ts` | `composeValidators`, `regexMatch`, `jsonHasKeys`, `byteLengthRange`, `containsAll`. | Use for Cargo.toml / package.json content assertions. |
| `sandbox-harness.ts` (252 LoC) | `SandboxHarness` + `SubprocessSandboxDriver` + `DockerSandboxDriver` + test parsers (`vitestTestParser`, `pytestTestParser`, `jestTestParser`) + `composeParsers`. | Run `pnpm install && pnpm build` / `cargo check` / `go mod tidy && go build` / `aptos move compile` per-family. Exactly what we need for build_score. |
| `test-graded-scenario.ts` | `runTestGradedScenario` — scenario driven by a test suite, returns pass/fail + score. | For scaffolds that ship their own tests (most families have `validate-*.mjs` scripts). |
| `oracle.ts` | `evaluateOracles`, `textInSnapshot`, `urlContains`, `jsonShape`, `regexMatches`, `notBlocked`. | General-purpose post-run assertions. |
| `trace/*` (1200+ LoC) | `TraceEmitter`, `TraceStore`, `schema`, `query`, `redact`, `otel`. | Full tracing stack. Emit a run per family-eval, query via `judgeSpans`. |

### Scaffold/builder-eval-specific — already exists

| Module | What it does | Relevance |
|---|---|---|
| `builder-eval/builder-session.ts` (236 LoC) | `BuilderSession` with Project → Chat → Ship → AppAgent hierarchy. `startChat`, `ship`, `runAppScenario`, `resume` from trace. | Direct fit. A starter-foundry scaffold eval is: Project = family+prompt, Chat = the planner's decision, Ship = compose+install+build, AppAgent = (optional) runtime scenario. |
| `builder-eval/three-layer-eval.ts` (84 LoC) | `scoreProject(store, projectId) → { meta_score, build_score, runtime_score, correlation }`. `scoreAllProjects`. | Canonical scoring split. **Gap: assumes runtime_score is always computable. For scaffold-only eval, runtime is null.** Needs null-tolerance — see "Gaps" below. |
| `builder-eval/correlation.ts` (99 LoC) | Cross-layer correlation analysis. Flags when meta_score doesn't predict runtime_score. | Kicks in once we have runtime data. Safe to leave inert for now. |
| `builder-eval/project-registry.ts` (125 LoC) | `ProjectRegistry.listProjects`, `projectTimeline`, `projectChats`. | Thin reader over TraceStore. Use when consuming the report. |

### Infrastructure — solid, reuse as-is

| Module | What it does |
|---|---|
| `metrics.ts` | `MetricsCollector`, `TokenCounter`, `estimateTokens`, `estimateCost`, `MODEL_PRICING`. Per-turn product state metrics. |
| `cost-tracker.ts` | `CostTracker`, `ScenarioCost`, `CostSummary`. |
| `budget-guard.ts` | `BudgetGuard`, `BudgetBreachError`. Stops the run when cost exceeds budget. |
| `experiment-tracker.ts` | `ExperimentTracker`, `InMemoryExperimentStore`, run diffing. |
| `prompt-registry.ts` | `PromptRegistry`, `hashContent` — versioned prompt storage. |
| `statistics.ts` (343 LoC) | `mannWhitneyU`, `pairedTTest`, `wilcoxonSignedRank`, `cohensD`, `weightedMean`, `confidenceInterval`, `interRaterReliability`. |
| `power-analysis.ts` | `requiredSampleSize`, `bonferroni`, `benjaminiHochberg`. |
| `baseline.ts` | `compareToBaseline`, `iqr`, `welchsTTest`. |
| `pareto.ts` | `dominates`, `paretoFrontier`. |

### Adversarial / quality floor

| Module | What it does |
|---|---|
| `anti-slop.ts` (8 KB) | `createAntiSlopJudge`, `analyzeAntiSlop` — detects boilerplate, hallucinated facts, over-hedging. |
| `red-team.ts` (280 LoC) | `DEFAULT_RED_TEAM_CORPUS`, `redTeamDataset`, `scoreRedTeamOutput`. |
| `contamination-guard.ts` | `checkCanaries`, `canaryLeakView`, `HoldoutAuditor`. |
| `dataset.ts` | `Dataset`, `HoldoutLockedError`, `hashScenarios` — holdout enforcement. |
| `judge-calibration.ts` | `calibrateJudge`, `positionalBias`, `verbosityBias`, `selfPreference`. |

### Advanced — optional, overkill for first ship

| Module | What it does | First-ship? |
|---|---|---|
| `meta-eval/calibration.ts`, `correlation-study.ts`, `outcome-store.ts` | Judge-quality diagnostics. | Defer until we have 2+ rounds of data. |
| `prm/*` | Process reward model (built-in rubrics, inference, training-export). | Defer. |
| `bisector.ts` | `bisect`, `commitBisect`, `promptBisect`. | Useful AFTER first regression — skip for now. |
| `counterfactual.ts`, `cross-trace-diff.ts` | "What if this factor changed" analysis, alignment. | Defer. |
| `pre-registration.ts` | `signManifest`, `verifyManifest` — reproducibility attestation. | Nice-to-have; not blocking. |
| `self-play.ts`, `active-learning.ts`, `causal-attribution.ts` | Advanced optimization loops. | Defer. |
| `reward-model-export.ts` | Export grader as inference scorer. | Defer. |
| `pipelines/*` (7 modules) | Pre-built failure-taxonomy pipelines (budget-breach, failure-cluster, first-divergence, judge-agreement, regression, stuck-loop, tool-waste). | Consume once we have traces. Not required for first ship. |
| `governance/*` | EU AI Act, NIST AI RMF, SOC2 compliance templates. | Not relevant for scaffold eval. |

---

## What starter-foundry already uses from agent-eval

| Usage site | What's consumed |
|---|---|
| `scripts/enrich-family.mjs` | `runProposeReview`, `createLlmReviewer`, `jsonlReviewStore` (for per-family enrichment — the family-registry agent loop) |
| `dist/training/template_v1/run.js` | Same three primitives (template-generation reviewer loop) |
| `src/training/template_v1/agent-eval.d.ts` | Ambient type shim (linked dep workaround) |
| `package.json` | `"@tangle-network/agent-eval": "link:../agent-eval"` |

**Gap:** no use of `BuilderSession`, `SandboxHarness`, `workspace-inspector`, or `three-layer-eval`. The scaffold-wide eval surface simply isn't wired up.

---

## Gaps that actually exist

### In agent-eval (exactly one)

**`three-layer-eval.ts` assumes runtime_score is computable.** For scaffold-only eval, there's no app-runtime child run. The function will return `runtime_score: null` or skip the project if it treats missing runtime as invalid.

**Fix:** null-tolerance in `scoreProject` — return `{ meta, build, runtime: null, correlation: null }` when no app-runtime spans exist. ~5-10 LoC. PR against agent-eval, not starter-foundry.

Optional: add `two-layer-eval.ts` as a cleaner API surface for scaffold-only — takes a TraceStore + projectId, returns `{ meta, build }`. Saves callers from interpreting the null. Not strictly necessary.

### In starter-foundry (thin glue, no framework primitives)

| Thing to build | Where | Lines |
|---|---|---|
| `scripts/agent-eval-scaffold.mjs` — driver | new | ~100 |
| `src/eval/scaffold-bridge.ts` — maps starter-foundry's compose spec → `HarnessConfig`; registers family-specific judges via `createCustomJudge`; wires `BuilderSession.ship` | new | ~150 |
| `.evolve/agent-eval/seeds.json` — canonical prompts per family (seeded from `tests/coverage.test.ts` FAMILY_PROMPTS) | new data file | ~0 (derive from existing) |
| `package.json` scripts — `eval:scaffold`, `eval:scaffold:sample` | extend | 2 lines |
| `scripts/refresh-scorecard.mjs` — new `agent_eval_pass_rate` flow reading from `.evolve/agent-eval/<date>/three-layer-report.json` | extend | ~30 |
| `tests/agent-eval-scaffold.test.ts` — integration test, runs on 2-3 fixture scaffolds | new | ~80 |

**Total:** ~360 LoC in starter-foundry + ~10 LoC in agent-eval. No duplication.

---

## The integration shape

```
┌────────────────────────────────────────────────────────────────┐
│  starter-foundry/scripts/agent-eval-scaffold.mjs               │
│  ─────────────────────────────────────────────────             │
│  1. Read .evolve/agent-eval/seeds.json (canonical prompts)     │
│  2. For each prompt:                                            │
│       a. planPrompt → spec                                      │
│       b. composeStarter → tmpdir with composed scaffold         │
│       c. scaffold-bridge.makeHarnessConfig(family) → HarnessConfig│
│       d. BuilderSession.startChat(prompt).ship(harnessConfig)   │
│  3. After all runs: scoreAllProjects(traceStore)                │
│  4. Write three-layer report + emit scorecard flow              │
└────────────────────────────────────────────────────────────────┘
                       │
                       ▼ (all primitives below are from agent-eval)
┌────────────────────────────────────────────────────────────────┐
│  BuilderSession → SandboxHarness → SubprocessSandboxDriver     │
│    setupCommand: family-specific (pnpm install / cargo check / │
│                                    go mod tidy / aptos compile)│
│    testCommand: family validator (validate-*.mjs)              │
│    parser: vitestTestParser | pytestTestParser | custom         │
│                                                                 │
│  BuilderSession.ship emits an `app-build` child run with score  │
│  = parser's pass rate. `build_score` in three-layer-eval.      │
│                                                                 │
│  An LLM reviewer (createLlmReviewer) attached as a judgeSpan on │
│  the builder run = meta_score. Rubric = scaffold-bridge's       │
│  createCustomJudge with dimensions:                             │
│    - correctness (imports resolve, build recipe valid)         │
│    - completeness (all manifest.files composed to disk)        │
│    - idiomatic (workspace layout matches family convention)     │
│    - production-ready (env vars, secrets, build caching)       │
│    - over-scaffold (no noise layers)                            │
│                                                                 │
│  Scaffolds don't have a runtime layer → runtime_score: null.    │
│  three-layer-eval returns { meta, build, runtime: null }.       │
└────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────┐
│  .evolve/agent-eval/<YYYY-MM-DD>/                              │
│    three-layer-report.json   (scoreAllProjects output)          │
│    traces.jsonl              (raw TraceEmitter output)          │
│    judge-verdicts.jsonl      (each judgeSpan)                   │
│    cost-summary.json         (CostTracker rollup)               │
│                                                                 │
│  refresh-scorecard reads three-layer-report.json → emits        │
│  `agent_eval_pass_rate` flow (fraction of projects with         │
│  meta ≥ 0.8 AND build == 1.0). Drops into existing scorecard.  │
└────────────────────────────────────────────────────────────────┘
```

---

## Cost ballpark

**Per run:**
- ~96 families × 1 canonical prompt = 96 scaffolds
- compose + install + build per scaffold: ~30 sec wall (cached), 5 min uncached
- LLM judge pass (Sonnet via router): ~8K tokens per scaffold
- Total: ~770K input / ~80K output tokens ≈ **$3-5 per full sweep**

**Sample mode (for dev loop):** 20 representative scaffolds ≈ $1, 10-min wall. `pnpm eval:scaffold:sample`.

**Full sweep:** 96 scaffolds ≈ $5, 45-min wall. `pnpm eval:scaffold`.

Run sample mode on every PR; full sweep nightly via the existing `nightly-measurement.yml` workflow.

---

## Proposed ship order

1. **agent-eval**: null-tolerance patch on three-layer-eval. PR against `~/webb/agent-eval`. ~10 LoC. Ship first so starter-foundry can consume.
2. **starter-foundry**: `scaffold-bridge.ts` + `agent-eval-scaffold.mjs` + `seeds.json` + scorecard wiring + sample test. PR #48.
3. **Run sample**: `pnpm eval:scaffold:sample` on 20 fixtures. Validate no crashes.
4. **Run full**: `pnpm eval:scaffold` on all 96. Capture baseline. Write a short observations doc.
5. **Add to nightly**: append `pnpm eval:scaffold` to `.github/workflows/nightly-measurement.yml`. Guard with budget-guard so a runaway LLM cost doesn't blow up CI.

Gen 4 pursuit scope. Estimated 4-6 hours total work across both repos.

---

## Honest self-call

My first response proposed rebuilding this from scratch (~1000 LoC of "new" code that would have duplicated judges + workspace-inspector + propose-review + three-layer-eval). The user caught it. The correct pattern — extend the existing library, never duplicate — held in every prior session and I missed it here because I didn't inspect agent-eval first. Pattern for future: **before proposing any new eval code, read `~/webb/agent-eval/src/index.ts` end-to-end and map the proposal against it.**
