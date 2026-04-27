# {{projectName}}

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

- `src/eval/runner.ts` — main entrypoint. Loads scenarios, runs
  each via `runTestGradedScenario`, persists traces to
  `FileSystemTraceStore`, aggregates via `summarize`.
- `src/eval/scorecard.ts` — produces `scorecard.json` matching the
  project-level dashboard shape (timestamp, aggregate, flows[]).
- `src/eval/cli.ts` — `eval-harness run | compare`.
- `scenarios/` — author one `Scenario` per file.
- `judges/` — author one `JudgeFn` per file. Calibrate before
  gating.

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

- Need a different judge dimension? Add a file in `judges/`. Use
  `createCustomJudge` from agent-eval.
- Need a custom regression policy? Edit
  `src/eval/regression/gate.ts` — it's composed from the
  `eval:regression` layer; override the thresholds in your scaffold.
- Need to gate on a specific dimension? The gate accepts
  `--dimension <name>` and runs the comparison only on that slice.
