# auto-research

Composable optimization layer over `@tangle-network/agent-eval@^0.19.1`.

Wraps the upstream primitives (`runMultiShotOptimization`,
`PairwiseSteeringOptimizer`, `runPromptEvolution`, `runProposeReview`,
`paretoFrontier`, `paretoFrontierWithCrowding`) into a small surface a
research-harness family can compose without re-deriving the agent-eval API.

## Capabilities

- `provides`: `eval:auto-research`
- `requires`: `eval:scenarios`, `eval:judge-rubric`, `eval:regression`

The three required capabilities supply the measurement substrate
(scenarios to run, judges to score, gates to promote). This layer
supplies the optimizer that drives variants against that substrate.

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

// 1. Steering bundles → winner (FDR-corrected pairwise).
const result = await runSteeringOptimization({
  variants: [bundleA, bundleB, bundleC],
  examples: scenarios.map((s) => ({ scenarioId: s.id, ... })),
  evaluate: async ({ variant, scenarioId }) => harness.run(variant, scenarioId),
  trialsPerScenario: 3,
})

// 2. Variable-length agent trajectory optimization. Use the same
// MultiShotVariant path for n=1 single-turn tasks and n>1 conversations.
const optimized = await runMultiShotTrajectoryOptimization({
  runId: `research-${Date.now()}`,
  target: 'agent-system-prompt',
  seedVariants: [{ id: 'baseline', label: 'baseline', generation: 0, payload: baselinePayload }],
  searchScenarioIds: scenarios.map((s) => s.id),
  reps: 2,
  generations: 3,
  populationSize: 4,
  runner: {
    run: ({ variant, scenarioId, seed }) => harness.runTrajectory({ variant, scenarioId, seed }),
  },
  scorer: {
    score: ({ run }) => scoreTrajectoryWithAsi(run),
  },
  mutateAdapter,
  gate,
})
deploy(optimized.promotedVariant.payload)

// 3. Reflective hypothesis → final state via propose/verify/review.
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
```

## What this layer does NOT do

- Run the actual eval (that's `eval:scenarios` + `eval:judge-rubric`)
- Persist results (that's the family's runner — see
  `agent-research-harness-ts`)
- Decide promotions (that's `eval:regression`)
- Generate hypotheses (that's the family's proposer)

This layer is the OPTIMIZER. Measurement and bookkeeping are separate
concerns and live in separate layers / families on purpose.
