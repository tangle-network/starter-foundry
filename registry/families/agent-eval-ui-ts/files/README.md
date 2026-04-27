# {{appName}} — agent-eval-ui-ts

Vite + React + TypeScript dashboard for evaluators. Reads `agent-eval` output
(JSONL traces + per-run JSON reports) from a directory you point it at, and
renders four views:

- **Overview** — aggregate score across every loaded trace, plotted on a multi-dimensional radar.
- **Trace list** — sidebar with date / family / status / search filters.
- **Trace detail** — turn-by-turn timeline (user / assistant / tool), score table, per-trace radar, phase summary, and any `:::artifact`-style blocks the run emitted (rendered via `ui-adapter:blocks-renderer`).
- **Compare** — pick two traces, see per-dimension delta + winner with both runs overlaid on one radar.

## Quick start

```bash
pnpm install
cp .env.example .env
# edit AGENT_EVAL_TRACES_DIR to point at your agent-eval output (e.g. .evolve/agent-eval)
pnpm dev
```

Open http://localhost:{{port}}.

## Data sources

The loader reads everything under `$AGENT_EVAL_TRACES_DIR`, bucketed by
top-level subdir (run date). It understands four file shapes:

| File | What it contributes |
| --- | --- |
| `<runDate>/traces.jsonl` | per-phase rows; turns when a row carries them |
| `<runDate>/three-layer-report.json` | per-project build / meta / runtime scores |
| `<runDate>/structural-assertions.jsonl` | structural pass/fail per seed |
| `<runDate>/cost-summary.json` | total cost + p95 latency per seed |

Each unique seed in a run becomes one `AgentEvalTrace` in the UI.

## Scoring dimensions

Default radar dimensions (all normalised to `[0..1]`, with lower-is-better
dims pre-inverted against a budget so outer = good):

- `correctness`, `helpfulness` — populated when the upstream judge writes them.
- `structural`, `build`, `runtime`, `runtimePassRate`, `meta` — agent-eval scaffold scores.
- `latencyP95` — inverted against a 30s budget (override per-call in `radarData`).
- `costUsd` — inverted against a $1 budget.

Add your own dimensions: write them into the trace's `scores` map; they show
up automatically in the table and on the radar.

## Production deploy

The dev server uses a Vite middleware (`/__traces`) to read the configured
directory off the host filesystem. For production:

1. Mount your traces dir at a known path on the same origin and rewrite
   `loadTraces('/your-static-path')`, OR
2. Build a tiny API route that mirrors the `/__traces` JSON shape (see
   `vite.config.ts` for the contract).

Run `pnpm build` for a static bundle in `dist/`.

## What's NOT in scope

- Running evals — this is a viewer for artifacts produced by `pnpm run agent-eval` (or your equivalent). Pair with `scripts/agent-eval-scaffold.ts`.
- LLM-as-judge logic — judges write into `scores`; this UI only visualises.
- Multi-tenant auth — stand it up behind your own auth proxy.
