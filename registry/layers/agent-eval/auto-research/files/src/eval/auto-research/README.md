# auto-research

Composable optimization layer over `@tangle-network/agent-eval@0.135.1`.

Wraps `runOptimization`, `runImprovementLoop`, `PairwiseSteeringOptimizer`, `runProposeReview`, `paretoFrontier`, `paretoFrontierWithCrowding`, and `analyzeRuns` behind a small API for generated research projects.

## Capabilities

- `provides`: `eval:auto-research`
- `requires`: `eval:scenarios`, `eval:judge-rubric`, `eval:regression`

The required layers define scenarios, score runs, and decide whether a change can ship.
This layer ranks the completed runs.

## How a family composes this

```ts
import {
  runSteeringOptimization,
  runMultiShotTrajectoryOptimization,
  runEvolution,
  proposeReview,
  frontier,
  DEFAULT_OBJECTIVES,
} from './eval/auto-research/index.js'
import type { SteeringOptimizationRow } from '@tangle-network/agent-eval'

// 1. Score each bundle and scenario first, then rank the resulting rows.
const bundles = [bundleA, bundleB, bundleC]
const rows: SteeringOptimizationRow[] = await Promise.all(
  scenarios.flatMap((scenario) =>
    bundles.map(async (bundle) => ({
      variantId: bundle.id,
      scenarioId: scenario.id,
      bundle,
      score: await runAndScore(bundle, scenario),
    })),
  ),
)
const result = await runSteeringOptimization({ rows })

// runAndScore is your evaluator and returns an Agent Eval RunScore.

// 2. Variable-length agent trajectory optimization.
const optimized = await runMultiShotTrajectoryOptimization({
  runId: `research-${Date.now()}`,
  baselineSurface: baselinePrompt,
  scenarios,
  judges,
  dispatchWithSurface,
  driver,
  reps: 2,
  maxGenerations: 3,
  populationSize: 4,
})
deploy(optimized.winnerSurface)

// 3. Reflective hypothesis to final state via propose/verify/review.
const report = await proposeReview({
  goal: 'reduce judge-rubric failures on category=tool-use',
  initialState: { promptVersion: 'v1' },
  propose: ...,
  verify: ...,
  review: ...,
})

// 4. Pareto-non-dominated points across (quality, cost, latency).
const f = frontier([
  { variantId: 'A', quality: 0.81, costUsd: 0.12, wallSeconds: 4.1 },
  { variantId: 'B', quality: 0.83, costUsd: 0.40, wallSeconds: 6.0 },
])

// 5. Convert captured RunRecords into a launch decision report. Call AFTER
//     the optimizer emits real records; do NOT invent records from aggregates.
import { analyzeOptimization } from './eval/auto-research/index.js'

const rl = await analyzeOptimization({
  runs,
  baselineCandidateId: 'baseline',
  candidateCandidateId: optimized.winnerSurfaceHash,
  split: 'holdout',
})
// rl.recommendations contains ranked launch, hold, or investigate guidance.
```

`analyzeOptimization` reads captured `RunRecord[]` and returns launch recommendations.
Do not construct fake records from aggregate scores.

## What this layer does NOT do

- Run the eval. That belongs to `eval:scenarios` and `eval:judge-rubric`.
- Persist results. The generated research project owns storage.
- Decide promotions. That belongs to `eval:regression`.
- Generate hypotheses. The generated research project owns proposal logic.

This layer ranks variants. Other layers execute, score, store, and promote them.
