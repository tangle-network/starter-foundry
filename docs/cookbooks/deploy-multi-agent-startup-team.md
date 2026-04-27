# Deploying `multi-agent-startup-team-ts` end-to-end

End-to-end walkthrough for the **multi-agent** flow: compose a 5-role
startup advisory team, deploy it into a single Tangle sandbox via
`scripts/deploy-agent-bundle.ts`, and watch the orchestrator delegate to
its subagents.

> Read [`docs/architecture/agent-bundles.md`](../architecture/agent-bundles.md)
> first — the model is "one sandbox + one orchestrator + N subagents",
> not "one sandbox per role" and not "an external dispatcher parses
> `:::handoff` blocks". `AgentProfile.subagents` is the SDK feature
> doing the heavy lifting.

## What you need

| Thing                             | For              |
| --------------------------------- | ---------------- |
| Node ≥ 22 + `pnpm`                | compose + deploy |
| `pnpm install` from the repo root | engine           |
| `TANGLE_SANDBOX_API_KEY` env var  | the deploy step  |

## Step 1 — Compose

```ts
// compose.ts
import { composeStarter } from './src/lib/compose.js'

await composeStarter({
  spec: {
    family: 'multi-agent-startup-team-ts',
    layers: [],
    projectName: 'startup-team',
  },
  outDir: '/tmp/startup-team',
})
```

```bash
pnpm exec tsx compose.ts
```

Files of interest in the composed output:

```
/tmp/startup-team/
├── agent.json                                 # AgentProfile with subagents{}
├── coordination-protocol.md                   # mounted as a resource
├── roles/
│   ├── ceo/
│   │   ├── system-prompt.md                   # orchestrator prompt
│   │   └── methodology/
│   │       ├── decision-journal.md
│   │       ├── okr-design.md
│   │       └── weekly-review.md
│   ├── cto/
│   │   ├── system-prompt.md
│   │   └── methodology/*.md
│   ├── cmo/    {…}
│   ├── hr/     {…}
│   └── cfo-advisor/ {…}
└── README.md
```

In v0.10.x this same family shipped `agent-roster.json` instead of
`agent.json`. The sister-agent track on the schema collapses the roster
into the single `agent.json` shape using `AgentProfile.subagents`.

## Step 2 — Inspect `agent.json`

```bash
cat /tmp/startup-team/agent.json | jq '.subagents | keys'
```

Expected output:

```json
["cfo-advisor", "cmo", "cto", "hr"]
```

The orchestrator (CEO) is the _root_ of the profile — its system prompt
is `prompt.systemPrompt`, not a subagent. The other four roles are
subagents under `subagents.*`:

```json
{
  "name": "startup-leadership-team",
  "prompt": {
    "systemPrompt": "@file:roles/ceo/system-prompt.md",
    "instructions": [
      "You are the CEO and default respondent for this team.",
      "Delegate to cto for primarily-technical questions.",
      "Delegate to cmo for go-to-market and positioning.",
      "Delegate to hr for hiring, recruiting, JD drafting, interview design.",
      "Delegate to cfo-advisor for burn/runway, unit economics, fundraise prep.",
      "For multi-role artifacts (quarterly OKRs, weekly review, board update), invoke each subagent in turn and assemble."
    ]
  },
  "subagents": {
    "cto":          { "description": "…", "prompt": "@file:roles/cto/system-prompt.md", "tools": {…} },
    "cmo":          { "description": "…", "prompt": "@file:roles/cmo/system-prompt.md", "tools": {…} },
    "hr":           { "description": "…", "prompt": "@file:roles/hr/system-prompt.md",  "tools": {…} },
    "cfo-advisor":  { "description": "…", "prompt": "@file:roles/cfo-advisor/system-prompt.md", "tools": {…} }
  },
  "resources": {
    "files": [
      { "path": "coordination-protocol.md", "resource": { "kind": "inline", "name": "coordination", "content": "@file:coordination-protocol.md" } }
    ]
  }
}
```

### How `subagents` maps to the OpenCode / Claude backend

`AgentProfile.subagents` is a record of `id → AgentSubagentProfile`
([SDK source][agent-profile]). When the sandbox starts with this
profile, the OpenCode/Claude backend registers each subagent under its
id; the orchestrator's instructions tell it _when_ to dispatch. The
backend's native subagent feature handles:

- isolated context per subagent invocation
- per-subagent tool / permission policy (the `tools` and `permissions`
  fields on each `AgentSubagentProfile` override the orchestrator's)
- `maxSteps` per subagent invocation
- returning the subagent's final answer back to the orchestrator's
  turn so it can summarize / route further

There is **no external dispatcher**. There is no `:::handoff` parser
this repo is responsible for. The CEO orchestrator decides; the backend
executes the delegation.

## Step 3 — Deploy

```bash
export TANGLE_SANDBOX_API_KEY=sk_sandbox_...
pnpm exec tsx scripts/deploy-agent-bundle.ts \
  --bundle /tmp/startup-team \
  --name my-startup-team
```

The script does the same six things as the single-agent flow
([cookbook](./deploy-agent-runtime-research.md#step-3--deploy-into-a-sandbox)),
plus:

- inlines `roles/*/system-prompt.md` into each subagent's `prompt`
  field at deploy time
- uploads `roles/*/methodology/*.md` via `box.files.write(...)` so the
  subagents can read them at runtime
- uploads `coordination-protocol.md` as a resource the orchestrator
  loads on first turn

Output (shape):

```
✓ validated agent.json (4 subagents)
✓ inlined 5 system prompts (1 orchestrator + 4 subagents)
✓ inlined coordination-protocol.md
✓ sandbox created: sandbox_01HZR…
✓ files written: 17 (5 system prompts + 11 methodology guides + coordination)
$ next:
  const r = await box.task("we're hiring our first engineer, what should I prioritize?")
```

## Step 4 — Run an end-to-end task

```ts
// run-task.ts
import { Sandbox } from '@tangle-network/sandbox'

const client = new Sandbox({ apiKey: process.env.TANGLE_SANDBOX_API_KEY! })
const box = await client.get('sandbox_01HZR…')

const r = await box.task("we're hiring our first engineer, what should I prioritize?")
console.log(r.response)
```

What we expect to happen, narrated:

1. The CEO orchestrator's system prompt sees the question.
2. The orchestrator's instructions match "hiring / recruiting" → it
   decides to delegate to the `hr` subagent.
3. The OpenCode/Claude backend invokes the `hr` subagent with the
   question + relevant context. The HR system prompt's bias
   safeguards (`protectedClassRefusal`, `structuredInterviewDefault`)
   apply.
4. HR drafts a structured-interview-loop answer (rubric, signals,
   resume-screen criteria) and returns to the orchestrator.
5. The orchestrator may also briefly invoke `cto` for technical-bar
   calibration (it's a first engineering hire), then assemble.
6. Final response includes the HR-led answer with optional CTO
   technical-bar input.

`box.streamTask(...)` lets you watch this live — every subagent
invocation comes through as `message.part.updated` events with
distinguishing `part.type` / metadata.

## Time-to-first-response — verdict

**GAP (live deploy gated on `TANGLE_SANDBOX_API_KEY`).** This worktree
does not export a sandbox key, so the end-to-end timing measurement is
not recorded. The compose + agent.json validation half is verified
([Step 1, Step 2](#step-1--compose)). When the key is available, this
section should be filled in with:

- sandbox-create wall time
- first subagent invocation latency
- total `box.task()` duration
- `usage` (`inputTokens`, `outputTokens`)
- the actual transcript

Until then, the runtime claim is **structurally sound, not yet
proven**, and we say so honestly here rather than pasting a fabricated
transcript.

For comparison data points: the v0.10.x single-agent dogfood path
landed in 4568 ms (1146 prompt + 270 completion tokens) against
`router.tangle.tools` — that's a fair lower bound for the orchestrator's
first turn in this corrected path; subagent delegation adds at least
one more model call (so plan for 2× single-agent latency on the
first multi-role artifact).

## What this cookbook proves vs. claims

| Claim                                                                           | Status                                                                              |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Multi-agent bundles can be expressed as a single `agent.json` with `subagents`  | ✓ proven by SDK source — `AgentProfile.subagents` exists, no new SDK feature needed |
| The orchestrator system prompt + `subagents` block replaces a custom dispatcher | ✓ structurally proven; the backend's subagent feature does the dispatch             |
| Compose still produces a deployable bundle                                      | ✓ verified (Step 1)                                                                 |
| Live deploy + multi-role response works end-to-end                              | ✗ gated on `TANGLE_SANDBOX_API_KEY` — to be verified next operator session          |

## Related

- [`docs/architecture/agent-bundles.md`](../architecture/agent-bundles.md) — the canonical doc; multi-agent shape lives there.
- [`docs/cookbooks/deploy-agent-runtime-research.md`](./deploy-agent-runtime-research.md) — the single-agent variant, same flow without `subagents`.
- [`docs/specs/agent-base-secure.md`](../specs/agent-base-secure.md) — bias safeguards on HR / `notALicensedAdvisor` on CFO are policy hints; structural enforcement is documented in §"What's NOT yet built".

[agent-profile]: https://github.com/tangle-network/agent-dev-container/blob/main/products/sandbox/sdk/src/agent-profile.ts
