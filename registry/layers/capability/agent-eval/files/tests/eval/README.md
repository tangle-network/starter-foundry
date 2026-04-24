# Agent eval

This scaffold ships with a reproducible eval built on [`@tangle-network/agent-eval`](https://www.npmjs.com/package/@tangle-network/agent-eval). Every scenario is a `TestGradedScenario`; the library spawns it via `SubprocessSandboxDriver`, captures it in `InMemoryTraceStore`, and scores it via the sandbox harness. You get structured `Run` records for free.

## What's here

```
tests/eval/
  scenarios.json   ← edit first. Each entry becomes a TestGradedScenario.
  run-eval.mjs     ← thin shell over agent-eval's runTestGradedScenario.
  judge.mjs        ← optional LLM-judge hook (no-op by default — calibrate first).
scripts/
  eval-baseline.mjs ← pin a baseline; re-runs regress against it.
.github/workflows/
  eval.yml         ← PR gate.
```

## Loop

```bash
pnpm install
node tests/eval/run-eval.mjs              # boots agent via `pnpm start`, runs scenarios
node scripts/eval-baseline.mjs --write    # pin current score as baseline
# edit agent code
node tests/eval/run-eval.mjs              # scorecard diffs vs baseline when --check
```

## Scenario shape

Each entry in `scenarios.json` is one HTTP call. `run-eval.mjs` translates it into a shell assertion (`curl` + `jq`) and hands it to `runTestGradedScenario`. The library spawns, captures exit code + stderr, emits a `Run`, and returns `{ pass, score, failureClass }`.

```json
{
  "id": "behavior/handles-task",
  "kind": "http-post",
  "path": "/run",
  "body": { "task": "Summarize X." },
  "assert": {
    "status": 200,
    "jsonShape": { "draft": ["string"] },
    "minResponseChars": 40
  },
  "weight": 2
}
```

Supported assertions: `status`, `statusIn`, `requireJson`, `jsonShape` (per-field `string|number|boolean|null|array|object|undefined`), `minResponseChars`.

## LLM judge (opt-in)

`judge.mjs` is a hook that imports `createCustomJudge` from `@tangle-network/agent-eval`. It's a no-op by default because an uncalibrated rubric is worse than no rubric — it will happily score everything ~0.7 and make your gate useless. Before turning it on, calibrate: score 10-20 real scenario outputs by hand, feed them to your judge, confirm direction-agreement ≥0.8, then turn the hook on and extend `run-eval.mjs` to merge judge scores into the scorecard.

Relevant library primitives for the LLM layer:
- `createCustomJudge(name, systemPrompt, opts?)` — rubric-backed judge
- `createDomainExpertJudge(domain)` — default persona-based rubric
- `coherenceJudge` / `codeExecutionJudge` / `defaultJudges(domain)` — ready-made judges
- `JudgeRunner` — runs a set of judges over a Run and merges scores

## Baseline + regression

`scripts/eval-baseline.mjs --write` pins `.evolve/eval/latest.json` as `.evolve/eval/baseline.json`. `--check --tolerance 0.02` fails non-zero when the aggregate regresses beyond tolerance. CI uses this.

## Going beyond HTTP

The current runner assumes an HTTP agent (`/health` + scenario endpoints). If your agent is stdio-based, websocket-only, or queue-backed: replace the `buildTestCommand` helper in `run-eval.mjs` with one that emits the right shell assertion (stdio pipe, wscat, redis-cli). Everything downstream stays: `runTestGradedScenario` doesn't care what transport you use, only that the shell command exits 0/non-zero.

## The store

`run-eval.mjs` uses `InMemoryTraceStore`. For persistence (benchmarks across sessions, CI artifact inspection), swap to `FileSystemTraceStore`:

```js
import { FileSystemTraceStore } from '@tangle-network/agent-eval'
const store = new FileSystemTraceStore({ root: '.evolve/eval/traces' })
```

Every `Run` object the library emits (scenarioId, pass, score, failureClass, timing, exit codes, stderr) is then on disk, replayable, and consumable by the library's `scoreProject` / `BenchmarkRunner` / `ConvergenceTracker` / `formatBenchmarkReport` for richer reporting.
