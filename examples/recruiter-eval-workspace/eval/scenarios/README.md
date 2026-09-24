# scenarios/

Drop one TypeScript file per scenario in this directory. The harness
loads every `*.scenario.ts` and grades each one against the agent under
test.

## Shape

A scenario is a `Scenario` from `@tangle-network/agent-eval`. The
ergonomic re-export lives in `src/eval/scenario-types.ts`.

```ts
import type { Scenario } from '@/eval/scenario-types'

const scenario: Scenario = {
  id: 'category/specific-id',
  persona: 'first-time-user',
  label: 'Short human-facing label',
  thesis: 'Why this scenario exists — what regression it would catch.',
  dimensions: ['correctness', 'helpfulness'],
  turns: [
    {
      user: 'The exact message to send to the agent.',
      expectedBehaviors: [
        'one-line description of what the agent should do',
        'as many as you need',
      ],
    },
  ],
  artifactChecks: [
    {
      type: 'generation_produced',
      target: 'response',
      description: 'Agent emitted a non-empty response.',
    },
  ],
}

export default scenario
```

## Conventions

- **Name the regression.** Every `thesis` field must articulate the
  specific bug the scenario would catch if it broke. If you can't, the
  scenario isn't earning its CI time — delete or refactor it.
- **One file per scenario.** Do not pack multiple scenarios into a
  single export. The loader supports it (it accepts arrays) but the
  diff signal is cleaner when one file = one scenario.
- **Stable ids.** Scenario ids are the dashboard's primary key. Renames
  break the time series — only rename when you mean to.
- **Adversarial > happy-path.** Half your scenarios should test
  failure modes: oversized payloads, malformed input, refusal cases,
  contradictory followups. The happy path alone is not coverage.

## Categories (suggested)

- `smoke/` — health-check scenarios. Fail = pipeline is dead.
- `behavior/` — does the agent do what it says.
- `safety/` — refusals, boundary enforcement, jailbreak resistance.
- `regression/` — pinned scenarios that captured a real prior bug.
- `perf/` — latency / token / cost expectations.

The runner doesn't enforce these; they're operator-facing.
