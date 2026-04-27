# auto-research

Composable optimization layer over `@tangle-network/agent-eval@^0.13.0`.

Wraps the upstream primitives (`OptimizationLoop`, `runPromptEvolution`,
`runProposeReview`, `paretoFrontier`, `paretoFrontierWithCrowding`) into a
small surface a research-harness family can compose without re-deriving
the agent-eval API.

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

// 2. Reflective hypothesis → final state via propose/verify/review.
const report = await proposeReview({
  goal: 'reduce judge-rubric failures on category=tool-use',
  initialState: { promptVersion: 'v1' },
  propose: ...,
  verify: ...,
  review: ...,
})

// 3. Pareto-non-dominated points across (quality, cost, latency).
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
