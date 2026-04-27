# Deploying `multi-agent-startup-team-ts` end-to-end

End-to-end walkthrough for the **multi-agent** flow: compose a 5-role
startup advisory team, deploy it into a single Tangle sandbox via
`scripts/deploy-agent-bundle.ts`, and watch the orchestrator delegate to
its subagents.

> Read [`docs/architecture/agent-bundles.md`](../architecture/agent-bundles.md)
> first — the model is "one sandbox + one orchestrator + N subagents",
> not "one sandbox per role" and not "an external dispatcher parses
> `:::handoff` blocks". `AgentProfile.subagents` and the on-disk
> `agents.json` registry are the harness features doing the heavy
> lifting.

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
├── AGENTS.md                                  # orchestrator (CEO) prompt;
│                                              # includes coordination rules
├── agents.json                                # OpenCode subagent registry
├── roles/
│   ├── cto/
│   │   ├── AGENTS.md                          # subagent prompt
│   │   └── methodology/*.md
│   ├── cmo/    {…}
│   ├── hr/     {…}
│   └── cfo-advisor/ {…}
└── README.md
```

Two harness-native files do the bootstrap work for free:

- `AGENTS.md` at the workspace root is the CEO orchestrator's system
  prompt. It contains the role definition, output conventions
  (`:::handoff`, `:::artifact`), and delegation triggers — what would
  have lived in a separate `coordination-protocol.md` lives here. The
  harness reads this file at session start (`apps/sidecar/src/agents/base-agent.ts:170`
  in `agent-dev-container`) and concatenates it into every agent's
  system prompt.
- `agents.json` is the OpenCode subagent registry. `apps/sidecar/src/agents/subagents/load-agents-config.ts`
  parses it and registers each entry as a callable subagent in the
  harness, with no extra glue from this repo.

## Step 2 — Inspect `agent.json` and `agents.json`

```bash
cat /tmp/startup-team/agent.json | jq '.subagents | keys'
```

Expected output:

```json
["cfo-advisor", "cmo", "cto", "hr"]
```

The orchestrator (CEO) is the _root_ of the profile — its system prompt
is `prompt.systemPrompt` (mirrored from `AGENTS.md`), not a subagent.
The other four roles are subagents under `subagents.*`:

```json
{
  "name": "startup-leadership-team",
  "prompt": {
    "systemPrompt": "@file:AGENTS.md",
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
    "cto":          { "description": "…", "prompt": "@file:roles/cto/AGENTS.md", "tools": {…} },
    "cmo":          { "description": "…", "prompt": "@file:roles/cmo/AGENTS.md", "tools": {…} },
    "hr":           { "description": "…", "prompt": "@file:roles/hr/AGENTS.md",  "tools": {…} },
    "cfo-advisor":  { "description": "…", "prompt": "@file:roles/cfo-advisor/AGENTS.md", "tools": {…} }
  }
}
```

The sibling `agents.json` mirrors this registry on disk for the
harness's direct consumption:

```bash
cat /tmp/startup-team/agents.json | jq 'keys'
```

```json
["cfo-advisor", "cmo", "cto", "hr"]
```

```json
{
  "cto":         { "description": "…", "prompt": "roles/cto/AGENTS.md",         "tools": { "read": true, "write": true } },
  "cmo":         { "description": "…", "prompt": "roles/cmo/AGENTS.md",         "tools": { "read": true, "write": true } },
  "hr":          { "description": "…", "prompt": "roles/hr/AGENTS.md",          "tools": { "read": true, "write": true } },
  "cfo-advisor": { "description": "…", "prompt": "roles/cfo-advisor/AGENTS.md", "tools": { "read": true, "write": true } }
}
```

### How `subagents` + `agents.json` map to the harness

`AgentProfile.subagents` is a record of `id → AgentSubagentProfile`
([SDK source][agent-profile]). When the sandbox starts with this
profile, the OpenCode harness reads `agents.json` from the workspace
root and registers each entry as a callable subagent. The
orchestrator's instructions tell it _when_ to dispatch. The harness's
native subagent feature handles:

- isolated context per subagent invocation
- per-subagent tool / permission policy (the `tools` and `permissions`
  fields on each entry override the orchestrator's)
- `maxSteps` per subagent invocation
- returning the subagent's final answer back to the orchestrator's
  turn so it can summarize / route further

Both `AgentProfile.subagents` (passed via SDK) and `agents.json` (on
disk) carry the same registry — see
[`docs/architecture/agent-bundles.md`](../architecture/agent-bundles.md#what-the-deploy-script-writes-vs-whats-pushed-via-sdk)
for why we ship both. There is **no external dispatcher**. There is no
`:::handoff` parser this repo is responsible for. The CEO orchestrator
decides; the harness executes the delegation.

## Step 3 — Deploy

```bash
export TANGLE_SANDBOX_API_KEY=sk_sandbox_...
pnpm exec tsx scripts/deploy-agent-bundle.ts \
  --bundle /tmp/startup-team \
  --name my-startup-team
```

The script does the same five things as the single-agent flow
([cookbook](./deploy-agent-runtime-research.md#step-3--deploy-into-a-sandbox)),
emitting at `/home/agent/` and additionally:

- inlines `roles/*/AGENTS.md` into each subagent's `prompt` field
  in the `AgentProfile.subagents` SDK payload
- writes `agents.json` to `/home/agent/agents.json` so the OpenCode
  harness can register subagents from disk
- writes `roles/*/methodology/*.md` under `/home/agent/roles/<id>/methodology/`
  so each subagent can read its playbooks at runtime

Output (shape):

```
✓ validated agent.json (4 subagents)
✓ inlined 5 system prompts (1 orchestrator + 4 subagents)
✓ wrote agents.json (4 entries)
✓ sandbox created: sandbox_01HZR…
✓ files written: 17 under /home/agent/
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

1. The CEO orchestrator's `AGENTS.md` is in the system prompt; the
   question arrives.
2. The orchestrator's instructions match "hiring / recruiting" → it
   decides to delegate to the `hr` subagent.
3. The OpenCode/Claude harness invokes the `hr` subagent (registered
   from `agents.json`) with the question + relevant context. The HR
   prompt's bias safeguards (`protectedClassRefusal`,
   `structuredInterviewDefault`) apply.
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

Reference data points (in-repo measurements against `router.tangle.tools`
for `claude-sonnet-4`): single-agent first-turn latency lands in the
3–6 s range for a ~1k-token prompt; subagent delegation adds at least
one more model call, so plan for 2× single-agent latency on the first
multi-role artifact.

## What this cookbook proves vs. claims

| Claim                                                                            | Status                                                                              |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Multi-agent bundles can be expressed as a single `agent.json` with `subagents`   | ✓ proven by SDK source — `AgentProfile.subagents` exists, no new SDK feature needed |
| `agents.json` at the workspace root is read directly by the OpenCode harness     | ✓ proven by `apps/sidecar/src/agents/subagents/load-agents-config.ts`                |
| `AGENTS.md` at the workspace root is auto-injected into the system prompt        | ✓ proven by `apps/sidecar/src/agents/base-agent.ts:170`                              |
| Compose still produces a deployable bundle                                       | ✓ verified (Step 1)                                                                 |
| Live deploy + multi-role response works end-to-end                               | ✗ gated on `TANGLE_SANDBOX_API_KEY` — to be verified next operator session          |

## Related

- [`docs/architecture/agent-bundles.md`](../architecture/agent-bundles.md) — the canonical doc; multi-agent shape lives there.
- [`docs/cookbooks/deploy-agent-runtime-research.md`](./deploy-agent-runtime-research.md) — the single-agent variant, same flow without `subagents`.
- [`docs/specs/agent-base-secure.md`](../specs/agent-base-secure.md) — bias safeguards on HR and `notALicensedAdvisor` on CFO are policy metadata; enforcement is the in-sandbox agent's policy compliance.

[agent-profile]: https://github.com/tangle-network/agent-dev-container/blob/main/products/sandbox/sdk/src/agent-profile.ts
