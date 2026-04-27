# Multi-turn trajectory eval

Per-turn scoring for multi-turn agent rollouts. Composes
`@tangle-network/agent-eval`'s `Trajectory` + `TrajectoryStep` +
`StepRubric` + `buildTrajectory` + `gradeSemanticStatus`.

## Why per-turn

Outcome-only eval ("did the final artifact pass?") gives a single bit of
signal across N turns. Most agent regressions don't change the final
verdict — they change WHERE the agent gets there:

- "Pass on turn 4 instead of turn 2" — silent latency regression.
- "Pass after a tool error on turn 3" — silent reliability regression.
- "Pass with 8 retries instead of 1" — silent cost regression.

Per-turn scoring surfaces these as `convergenceTurn` deltas and per-turn
score deltas. CI gates on the deltas, not just the terminal pass/fail.

## When to use

- Multi-turn conversational agents (chat, copilot, support).
- Tool-using agents that iterate (research, code review, planning).
- ANY agent where the failure mode "took longer than it should have" is
  meaningful — which is most production agents.

## When NOT to use

- Single-shot completions (use `agent-eval:judge-rubric` instead).
- Agents that never emit intermediate spans (the trajectory will be empty).

## API

```ts
import { runMultiTurnRollout, groupStepsByTurn } from './trajectory-runner.js'
import { scorePerTurn } from './per-turn-scorer.js'
import { defaultStepRubrics } from './example-rubric.js'

const rollout = await runMultiTurnRollout({
  scenario: { scenarioId: 's1', userTurns: ['hi', 'now do X'] },
  driver,    // your TurnDriver — emits spans into `emitter`
  store,     // TraceStore (FileSystem / InMemory / D1)
  emitter,   // TraceEmitter wired to `store`
})
const stepsByTurn = groupStepsByTurn(rollout.trajectory, rollout.transcript.length / 2)
const report = await scorePerTurn({
  scenarioId: rollout.scenarioId,
  runId: rollout.runId,
  trajectory: rollout.trajectory,
  stepsByTurn,
  rubrics: defaultStepRubrics('book a flight to Tokyo'),
  threshold: 0.7,
})
console.log(`converged at turn ${report.convergenceTurn ?? 'never'}`)
```

## Composes with

| Capability                | Source                                         |
| ------------------------- | ---------------------------------------------- |
| `eval:scenarios`          | `agent-eval:scenarios` (Worker 1)              |
| `eval:judge-rubric`       | `agent-eval:judge-rubric` (Worker 1)           |
| `eval:trace-multi-turn`   | this layer                                     |

The rubrics here can be combined with single-turn `JudgeFn`s — pass the
agg result of `judgeRubric` as a custom `StepRubric` to weight per-turn
LLM judgments alongside the deterministic ones.

## Authoring custom rubrics

A `StepRubric` returns `{ score: 0..1, rationale?, evidence? }` per
matching span. See `example-rubric.ts` for two canonical patterns —
deterministic token overlap (cheap, runs at every step) and
goal-progress (uses scenario success criteria). Domain rubrics (e.g.
"tool args reference real entities") follow the same contract.
