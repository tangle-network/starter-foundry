# Evaluating `agent-runtime-recruiter-ts` end-to-end

End-to-end walkthrough: take any agent-runtime bundle, compose it into a
preset eval workspace, author scenarios + judges, and wire CI so every
PR touching the bundle triggers a real measurement against
`router.tangle.tools`. The recruiter bundle is the canonical example —
`examples/recruiter-eval-workspace/` is the committed result of running
this cookbook against `agent-runtime-recruiter-ts`.

## What you need

| Thing                               | For                                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| Node ≥ 22 + `pnpm`                  | running compose + the eval harness                                                             |
| `pnpm install` from the repo root   | engine itself                                                                                  |
| `TANGLE_API_KEY` env var            | the live LLM judge (`rubric-quality`)                                                          |
| Repo secret `TANGLE_API_KEY`        | unlocks the CI eval workflow                                                                   |
| `TANGLE_ROUTER_BASE_URL` (optional) | override `https://router.tangle.tools` — set when proxying through your own gateway            |
| `RUBRIC_JUDGE_MODEL` (optional)     | override `claude-sonnet-4-6` — the model the rubric judge calls (must be available at the URL) |

If `TANGLE_API_KEY` is absent, the LLM judge returns a structured
`unmeasured` shape (`score: NaN`, `status: 'unmeasured'`, plus a
`reasoning` string referencing the missing key) — never fake-success.
The aggregator at `eval/judges/aggregate.ts` skips unmeasured scores so
the workspace mean reflects only what was actually measured. The other
two judges (`artifact-shape`, `refusal-correctness`) are programmatic
and run with no network.

The two override env vars (`TANGLE_ROUTER_BASE_URL`, `RUBRIC_JUDGE_MODEL`)
are read inside `eval/judges/rubric-quality.judge.ts`; both default to
the canonical values above. Document them in `examples/recruiter-eval-workspace/.env.example`
when the operator needs to override.

## Step 1 — Compose the workspace

```bash
pnpm build
node dist/cli.js workspace-compose \
  --preset app+agent+eval \
  --agent agent-runtime-recruiter-ts \
  --app agent-with-ui-ts \
  --out examples/recruiter-eval-workspace \
  --name recruiter-eval-workspace
```

Time: **~2 s wall**. Files written:

```
examples/recruiter-eval-workspace/
├── package.json                    # workspace root, top-level scripts
├── pnpm-workspace.yaml             # 3-package workspace
├── .env.example                    # TANGLE_API_KEY + EVAL_TARGET_URL
├── .github/workflows/ci.yml        # per-workspace CI (composed from preset)
├── README.md                       # operator-facing
├── app/                            # agent-with-ui-ts shell
├── agent/                          # agent-runtime-recruiter-ts bundle
└── eval/                           # agent-eval-harness-ts (where step 2 + 3 author into)
```

The preset wires `EVAL_TARGET_URL` into `eval/.env` so the runner POSTs
scenario prompts at the agent endpoint. Replace the placeholder
`http://localhost:3001` with the deployed sandbox URL once `pnpm dev`
or `scripts/deploy-agent-bundle.ts` is running.

## Step 2 — Author scenarios

Drop one `*.scenario.ts` per scenario into
`examples/recruiter-eval-workspace/eval/scenarios/`. Each file
default-exports a `Scenario` from `@tangle-network/agent-eval`. Shape:

```ts
import type { Scenario } from '@tangle-network/agent-eval'

const scenario: Scenario = {
  id: 'recruiter/jd-drafting-happy',
  persona: 'hiring-manager',
  label: 'Drafts a JD for a senior backend engineer',
  thesis:
    'Bona-fide capability test. The agent must produce a JD wrapped in `:::artifact` with a header line and the canonical sections.',
  dimensions: ['artifact-shape', 'jd-completeness'],
  turns: [
    {
      user: 'Draft a JD for a Senior Backend Engineer ...',
      expectedBehaviors: [
        'wraps the JD in a `:::artifact` block',
        'includes responsibilities and requirements',
        'lists Go + distributed-systems as bona-fide qualifications',
      ],
    },
  ],
  artifactChecks: [
    { type: 'block_extracted', target: 'artifact', description: 'JD inside `:::artifact`.' },
  ],
}

export default scenario
```

The recruiter workspace ships 8 scenarios across three categories:

- **Happy path (3)**: `jd-drafting-happy`, `screening-rubric-happy`, `interview-loop-happy` — exercises the bundle's three artifact-shaped capabilities.
- **Hard refusal (3)**: `refuse-hire-decision`, `refuse-rank-candidates`, `refuse-protected-class` — exercises the `notHiringManager: true` and `biasRefusalRequired: true` contracts in `agent.json`.
- **Edge (2)**: `edge-ambiguous-prompt` (no fabrication), `edge-multi-turn` (context preservation across 3 turns).

## Step 3 — Author judges (optional — bundle-specific contracts)

Drop one `*.judge.ts` per judge into
`examples/recruiter-eval-workspace/eval/judges/`. Each file
default-exports a `JudgeFn`. The recruiter workspace ships 3:

```
eval/judges/
├── artifact-shape.judge.ts        # programmatic — regex the `:::artifact` block
├── refusal-correctness.judge.ts   # programmatic — refusal marker + reframe
└── rubric-quality.judge.ts        # LLM-as-judge — calls router.tangle.tools
```

Programmatic judges are pure functions over `JudgeInput.turns[*].agentResponse`.
LLM-as-judge calls go through `router.tangle.tools` (OpenAI-compatible at
`/v1/chat/completions`). Use `claude-sonnet-4-6`. Always JSON-mode + a
regex fallback so a malformed judge response degrades gracefully.

The `rubric-quality.judge.ts` returns the canonical unmeasured score
shape — one entry per dimension, each with `score: NaN`, `status:
'unmeasured'`, and a `reasoning` string that names the missing env var.
Aggregators (`eval/judges/aggregate.ts`, `eval/src/eval/runner.ts`,
`scripts/refresh-scorecard.ts`) skip unmeasured entries; the
`agent_eval_meta_pass_rate` flow surfaces as `null` with `notes:
source=recruiter-unmeasured` rather than as a fake `0`. Do this for any
LLM judge you author — it is the no-fake-success contract from
`docs/DESIGN-INVARIANTS.md` and the muffled-gate measurement-layer rule
in `.evolve/patterns/muffled-gate.md`.

## Step 4 — Wire CI

Add a top-level workflow at `.github/workflows/eval-<bundle-slug>.yml`.
The canonical example for the recruiter bundle is
[`.github/workflows/eval-recruiter.yml`](../../.github/workflows/eval-recruiter.yml) —
copy and adapt:

- **Triggers**: PR (paths-filtered to the bundle + the eval layer + the
  example workspace), `workflow_dispatch`, daily cron at `0 6 * * *`,
  push to main.
- **Gating**: the live eval step is gated on the `TANGLE_API_KEY`
  repo secret. When absent, the workflow logs a warning and exits 0 —
  it does **not** fail PRs.
- **Artifact**: `eval/.evolve/scorecard.json` uploaded.
- **On main push**: scorecard committed under `.evolve/eval-runs/<bundle>/<date>.json`,
  then `pnpm exec tsx scripts/refresh-scorecard.ts` re-emits the
  repo-level `.evolve/scorecard.json` so the `agent_eval_meta_pass_rate`
  flow updates.

## Expected output

When `pnpm eval` runs (locally or in CI), the harness writes to
`examples/recruiter-eval-workspace/.evolve/scorecard.json`:

```json
{
  "product": "eval-harness",
  "timestamp": "2026-04-27T...",
  "aggregate": 0.91,
  "coverage": "8/8 scenarios passed",
  "flows": [
    { "name": "recruiter/jd-drafting-happy", "value": 1.0, "status": "pass", ... },
    { "name": "recruiter/refuse-hire-decision", "value": 1.0, "status": "pass", ... },
    ...
  ]
}
```

`scripts/refresh-scorecard.ts` then reads that file and emits two flows
into the **repo-level** scorecard (`.evolve/scorecard.json`):

- `agent_eval_meta_pass_rate` — value = aggregate from the recruiter
  scorecard. Source label: `recruiter-live`. Target 0.85.
- `judge_fleet_unanimous_pass_rate` — fraction of scenarios where every
  flow passed (per-scenario unanimity). Target 0.85.

When the recruiter scorecard does not exist, both flows fall back to
their Gen-4 / Gen-10 sources (the agent-eval scaffold three-layer
report). Status `unmeasured` surfaces transparently when no source has
emitted yet.

## How the metric flows back to `.evolve/scorecard.json`

```
1. operator runs `pnpm eval` (locally) OR CI cron triggers
   ↓ (lives in examples/recruiter-eval-workspace/eval)
2. harness loads scenarios + judges, calls EVAL_TARGET_URL, runs every judge
   ↓
3. writes examples/recruiter-eval-workspace/.evolve/scorecard.json
   ↓
4. on main: CI commits to .evolve/eval-runs/recruiter/<date>.json
   ↓
5. CI runs scripts/refresh-scorecard.ts
   ↓
6. .evolve/scorecard.json — agent_eval_meta_pass_rate flow updated
   ↓
7. governor reads .evolve/scorecard.json on next dispatch
```

The loop closes at step 7 — the metric the governor uses to decide
"is recruiter-bundle quality enough" is now the live measurement, not
a scaffold-only proxy.

## Replicating for any bundle

The 4 steps generalize:

1. `pnpm exec tsx scripts/sync-example-workspaces.ts` (or run
   `workspace-compose` directly) — emit the workspace.
2. Author 5-10 scenarios that exercise the bundle's contract.
3. Author bundle-specific judges only if the default rubric doesn't
   capture the contract. Two judges (artifact-shape, refusal-correctness)
   are reusable — copy them.
4. Add the CI workflow gated on `TANGLE_API_KEY`. Use the recruiter
   workflow as the template.

When the second example workspace lands, generalize
`scripts/sync-example-workspaces.ts` — add an entry to its `EXAMPLES`
array. The script handles diff-and-rewrite for any preset-shaped file
without touching user-authored scenarios or judges.

## Step 5 (Gen-17): emit RunRecords + run the gate

Each scenario × variant emission appends a `RunRecord` to
`.evolve/runs.jsonl` so the `HeldOutGate` can decide promote vs revert.
Use `emitRunRecord` from `src/lib/eval/emit-run-record.ts`:

```ts
import { emitRunRecord } from '@tangle-network/starter-foundry'

emitRunRecord({
  experimentId: `eval/${bundleId}`,
  scenarioId,
  candidateId: variantId,
  profile: 'default-judge', // pulls model + ceiling from the profile
  promptText: scenario.prompt,
  configObject: judgeConfig,
  wallMs,
  costUsd,
  costProvenance,
  tokenUsage,
  terminalOutcome: 'succeeded',
  outcome: {
    searchScore,
    raw: { rubricPass: Number(rubricPass), refusalCorrect: Number(refusalCorrect) },
  },
  splitTag: 'search',
})
```

Then, on the candidate branch:

```bash
pnpm gate baseline.jsonl candidate.jsonl
```

See `docs/cookbooks/run-records-and-gates.md` for the full gate runbook.
