# research-harness

Hypothesis-driven research harness on top of `@tangle-network/agent-eval`.

## What this bundle is

A Node-only TypeScript bundle that implements `/research`-style
hypothesis-driven optimization. The eval-harness layers (scenarios,
judge-rubric, regression) supply the measurement substrate; this
bundle drives the optimizer that runs variants against it.

It composes the upstream agent-eval primitives:

- `runOptimization` — default path for optimizing full variable-length
  agent trajectories through the campaign driver API.
- `runImprovementLoop` — promotion shell that re-scores against holdout
  scenarios and returns the release gate decision.
- `PairwiseSteeringOptimizer` — N scored steering variants → ranked
  winner.
- `runProposeReview` — propose / verify / review inner loop for the
  hypothesis proposer.
- `paretoFrontier` + `paretoFrontierWithCrowding` — multi-objective
  filtering across (quality, cost, latency).
- `bootstrapCi` + `cohensD` — statistical sign-off in the validator
  pass.
- **`analyzeRuns`** (agent-eval contract bridge, exposed here as
  `analyzeSweep`) — converts captured `RunRecord[]` into the decision
  report: score distributions, paired lift, cost/quality frontier, and
  ranked recommendations. Call after the optimizer emits real records;
  idempotent and read-only with respect to the sweep result.

## Workflow

```
hypotheses/queue.json
        │
        ▼
   pnpm research:screen        (1 rep / hypothesis, ranks by delta)
        │
        ▼  passedFloor[]
   pnpm research:validate      (5 reps / candidate, bootstrap-CI gate)
        │
        ▼
research-results/<runId>/scorecard.json
```

Or all at once: `pnpm research:sweep`.

## Subcommands

| Command                | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `pnpm research:propose`| LLM-assisted hypothesis drafting (requires LLM hook)      |
| `pnpm research:screen` | 1-rep cheap pass over every hypothesis in `queue.json`    |
| `pnpm research:validate` | 5-rep statistical gate over candidates                  |
| `pnpm research:sweep`  | Screen → validate end-to-end, write scorecard             |

## Anti-overfitting (built in)

These are not suggestions:

- Screener requires ≥ 3 scenarios. Single-scenario "wins" are
  memorisation, not improvement.
- Validator runs the FULL scenario set, not the screener subset. The
  held-out check is the gate.
- Pareto frontier surfaces non-dominated variants on (quality, cost,
  latency). The harness never collapses three axes into one without
  the operator opting in.
- Cost + wall-time tracked per hypothesis. A 2pp pass-rate win that
  doubles cost is surfaced, not hidden.
- Promotion is human, not automatic. The harness emits a
  recommendation; the operator merges the change.

## Wiring a real `ScenarioRunner`

The CLI ships a `noOpRunner` that throws on first call — by design.
Wire your own runner (one that talks to your eval harness) and call
`runScreen` / `runValidate` / `runSweep` programmatically:

```ts
import { runSweep } from './src/research/runner.js'
import type { ScenarioRunner } from './src/research/types.js'

const runner: ScenarioRunner = {
  scenarioIds: ['math-1', 'math-2', 'math-3', 'tools-a', 'tools-b'],
  runTrial: async ({ hypothesis, scenarioId, rep }) => {
    // Apply hypothesis.treatment to the agent, run the scenario via your
    // eval-harness, return the score. For agents, prefer wrapping this
    // same execution as a MultiShotRun so the optimizer can consume the
    // full trajectory and ASI.
    const out = await myEvalHarness.run({ scenarioId, treatment: hypothesis?.treatment })
    return {
      scenarioId,
      score: out.judgeMean,
      costUsd: out.costUsd,
      wallSeconds: out.wallSeconds,
      ok: out.pass,
    }
  },
}

await runSweep({
  queuePath: 'hypotheses/queue.json',
  resultsDir: 'research-results',
  runner,
})
```

## Closing the loop into run analysis

After a `runMultiShotTrajectoryOptimization` / `runEvolution` sweep emits
real `RunRecord[]`, call `analyzeSweep` to emit the canonical decision packet:

```ts
import { runMultiShotTrajectoryOptimization } from './src/eval/auto-research/loop.js'
import { analyzeSweep } from './src/research/runner.js'

const optimized = await runMultiShotTrajectoryOptimization(config)

const rl = await analyzeSweep({
  runs,
  baselineCandidateId: 'baseline',
  candidateCandidateId: optimized.winnerSurfaceHash,
  split: 'holdout',
})

// rl.recommendations → ranked launch / hold / investigate guidance
```

The report is the evidence-backed handoff from search to launch decisions.
Do not synthesize `RunRecord[]` from aggregate scores; analysis must start
from real captured runs.

## Tests

`pnpm test` runs the harness's own regression tests against synthetic
runners. The tests cover: queue load, proposer shape verification,
screener ranking + floor, validator promote / reject / inconclusive
verdicts, sweep persistence.

## CI

`.github/workflows/research.yml` runs the screener nightly. Manual
dispatch supports `screen`, `validate`, or `sweep` modes. Results
upload as a workflow artifact retained 30 days.

## Where this fits

- `agent-eval-harness-ts` measures.
- `agent-research-harness-ts` (this bundle) optimizes.
- `auto-research` (capability layer) wraps the agent-eval primitives.

Keep the boundary clean: don't add the loop INSIDE the eval-harness.
Measurement and optimization rot at different rates and live in
different families on purpose.
