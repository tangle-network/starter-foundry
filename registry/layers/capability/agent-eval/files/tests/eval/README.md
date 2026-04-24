# Agent eval

This scaffold ships with a reproducible eval so you can answer *is this agent improving or regressing?* on every change.

## What's here

```
tests/eval/
  scenarios.json   ← edit this first: add scenarios that define your agent's contract
  run-eval.mjs     ← runner: spawns the agent, hits each scenario, writes a scorecard
  judge.mjs        ← optional LLM-judge layer (deterministic scoring is the contract)
scripts/
  eval-baseline.mjs ← snapshot current score as the baseline; future runs regress against it
.github/workflows/
  eval.yml         ← CI: deterministic-only on every PR, LLM-judge when TOGETHER_API_KEY is set
```

## Loop

```bash
pnpm install
node tests/eval/run-eval.mjs              # prints scorecard, exits non-zero below threshold
node scripts/eval-baseline.mjs --write    # pin current score as baseline
# edit agent code
node tests/eval/run-eval.mjs              # diff vs baseline is printed by the runner
```

## Scenario shape

Each entry in `scenarios.json` is one turn. The runner supports `http-get` and `http-post`. Assertions are deterministic first (status, jsonShape, minResponseChars) and the LLM judge (if enabled) layers subjective quality on top. Weight lets you bias the aggregate without editing the runner.

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

## LLM judge

Set `TOGETHER_API_KEY` or `ANTHROPIC_API_KEY` and the runner appends a rubric score per scenario. Keeps the deterministic layer as the gate — LLM is observability, not contract, until you've calibrated the rubric. Edit `tests/eval/judge.mjs` to swap providers, rubrics, or plug in `@tangle-network/agent-eval`'s `createCustomJudge`/`codeExecutionJudge`/`coherenceJudge` helpers.

## Baseline + regression

`scripts/eval-baseline.mjs --write` captures `.evolve/eval/latest.json` into `.evolve/eval/baseline.json`. Re-running `run-eval.mjs` prints the aggregate diff vs baseline. CI fails on any regression > `--tolerance` (default `0.02`).

## Extending

- Add a scenario: append to `scenarios.json`. Nothing else to change.
- Swap transport (agent uses websockets / stdio / worker bindings): edit `runHttpScenario` in `run-eval.mjs`.
- Richer scoring dimensions (safety, latency, cost): extend the scorer in `run-eval.mjs` and add dimension fields to the scorecard.
- Use agent-eval library primitives: `import { createCustomJudge, coherenceJudge } from '@tangle-network/agent-eval'` in `judge.mjs`.
