# recruiter-eval-workspace-eval

Standalone eval harness wrapping `@tangle-network/agent-eval`. Runs
scenarios + LLM-as-judge rubrics against an agent under test and
emits a statistical-quality scorecard.

This README is for humans. The agent-readable spec is in
[`AGENTS.md`](./AGENTS.md) — that's what auto-loaded into in-sandbox
agents (Claude Code, OpenCode) when they extend this bundle.

## Quick start

```bash
pnpm install
pnpm eval                                       # run all scenarios
pnpm eval -- --target http://127.0.0.1:8787     # custom target URL
pnpm eval:compare scorecard-a.json scorecard-b.json
pnpm eval:gate baseline.json head.json          # CI regression gate
```

Outputs land in `.evolve/scorecard.json` (latest) and
`.evolve/agent-eval/traces/` (per-run JSONL).

## Layout

- `src/eval/runner.ts` — smoke-test entrypoint (`pnpm eval`). Loads
  scenarios, executes every declared turn with full conversation
  history, persists traces to `FileSystemTraceStore`, and aggregates
  a scorecard. Operational errors remain unmeasured and fail the CLI.
- `src/eval/conversation.ts` — ordered HTTP conversation executor.
  Every turn carries a stable session ID and accumulated messages.
- `src/eval/judge-client.ts` — run-bound model client that records
  linked LLM spans and redacted raw provider events.
- `src/eval/judge-policy.ts` — strict applicability and weighted
  judge-score aggregation.
- `src/eval/campaign.ts` — **launch-decision-grade** entrypoint
  (agent-eval 0.22+). Wraps `runEvalCampaign` for sweeps over
  (variants × scenarios × seeds) with paired bootstrap CIs +
  anytime-valid sequential verdicts. The four capture-integrity
  directives are wired by construction — the caller can't skip one
  without rewriting the function. Import + call from your own
  script when you have variants to compare.
- `src/eval/scorecard.ts` — produces `scorecard.json` matching the
  project-level dashboard shape (timestamp, aggregate, flows[]).
- `src/eval/cli.ts` — `eval-harness run | compare`.
- `scenarios/` — author one `Scenario` per file.
- `judges/` — author one `JudgeFn` per file. Calibrate before
  gating.

## Capture integrity (agent-eval 0.21+)

Every `pnpm eval` run wires the four directives from the agent-eval
skill's "Capture integrity" section by default:

1. **`RawProviderSink`** — a `FileSystemRawProviderSink` per scenario
   under `.evolve/agent-eval/raw-events/<scenarioId>/`. Headers + body
   credentials are redacted at persistence. The runner passes the sink
   directly to its run-bound judge client.
2. **`assertLlmRoute`** at preflight — fires when `EVAL_LLM_BASE_URL`
   is set. Fails loud if the sweep would silently fall back to the
   public router or run unauthenticated.
3. **`assertRunCaptured`** after each scenario — verifies the run wrote
   an outcome and every expected `LlmSpan` has a matching raw request
   event. Default `EVAL_INTEGRITY=log` surfaces issues
   on the outcome row; `EVAL_INTEGRITY=strict` fails the scenario;
   `EVAL_INTEGRITY=off` disables the wiring.
4. **`onRunComplete` hooks** — supported on the campaign path; pass
   `traceAnalystOnRunComplete(...)` via `onRunComplete` in
   `runCampaign` opts. The smoke-test path uses
   `runTestGradedScenario` which constructs its own emitter — wire
   the analyst out-of-band or migrate to `runCampaign` when a hook is
   load-bearing.

Env knobs:

| Var | Default | Effect |
| --- | ------- | ------ |
| `EVAL_TARGET_BASE_URL` | `http://127.0.0.1:8787` | Base URL whose `/chat` route receives scenario turns. |
| `EVAL_INTEGRITY` | `log` | `off` \| `log` \| `strict` capture-integrity policy. |
| `EVAL_LLM_BASE_URL` | unset | Triggers `assertLlmRoute` preflight. |
| `EVAL_LLM_API_KEY` | unset | Auth for the LLM judge route (falls back to `TANGLE_API_KEY`). |
| `EVAL_LLM_PROVIDER` | unset | Pin the expected provider (`openai`, `anthropic`, …). |

## Campaign mode (agent-eval 0.22+)

When the question is "does variant A beat variant B over scenarios ×
seeds?" — i.e. a launch-decision sweep — use `src/eval/campaign.ts`:

```ts
import { runCampaign } from './src/eval/campaign.js'

const result = await runCampaign({
  campaignId: 'prompt-v2-vs-baseline',
  commitSha: process.env.GIT_SHA!,
  comparator: 'baseline',
  variants: [
    { id: 'baseline', payload: { systemPrompt: '...' } },
    { id: 'v2',       payload: { systemPrompt: '...' } },
  ],
  scenarios: [{ scenarioId: 'math-1' }, { scenarioId: 'tools-a' }],
  seeds: [0, 1, 2],
  llmOpts: { baseUrl: process.env.EVAL_LLM_BASE_URL!, apiKey: process.env.TANGLE_API_KEY! },
  runner: async (ctx) => {
    await ctx.emitter.startRun({ scenarioId: ctx.scenarioId, variantId: ctx.variantId })
    // ... call the agent under test, score the response ...
    await ctx.emitter.endRun({ pass, score })
    return { pass, score, costUsd, tokenUsage, model, promptHash, configHash }
  },
})

// result.runs       → RunRecord[] (canonical, hashed, costed)
// result.report     → researchReport with paired-bootstrap verdicts
// result.integrityReports → per-run capture-integrity reports
```

The campaign emits a `RunRecord[]` that is the exchange currency
across the rest of agent-eval (research report, replay cache, RL
bridge, predictive-validity). Skip this entrypoint and you're back to
re-implementing the same shape ad hoc.

## Composed layers

This bundle is composed with three base layers from
`registry/layers/agent-eval/`:

- `agent-eval:scenarios` — scenario loader + types
- `agent-eval:judge-rubric` — multi-dimensional rubric runner
- `agent-eval:regression` — bootstrap-CI / Welch's t-test gate +
  Benjamini–Hochberg correction

## CI

`.github/workflows/eval.yml` runs the harness on every PR, uploads
the scorecard as an artifact, and fails the build on a REVERT
verdict from `pnpm eval:gate` against `origin/main`'s scorecard.

## Extending

- Need a different judge dimension? Add a file in `judges/`. Build it
  with `llmJudge` from agent-eval (see `judges/example.judge.ts`).
- Need a custom regression policy? Edit
  `src/eval/regression/gate.ts` — it's composed from the
  `eval:regression` layer; override the thresholds in your scaffold.
- Need to gate on a specific dimension? The gate accepts
  `--dimension <name>` and runs the comparison only on that slice.
