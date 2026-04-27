# Deploying `agent-runtime-research` end-to-end

End-to-end walkthrough: take the `agent-runtime-research` family, compose it
with `composeStarter`, deploy it into a Tangle sandbox via
`scripts/deploy-agent-bundle.ts`, and call `box.task(...)` for a real LLM
response. A bundle is content; the sandbox is the runtime — see
[`docs/architecture/agent-bundles.md`](../architecture/agent-bundles.md).

## What you need

| Thing                                          | For                                 |
| ---------------------------------------------- | ----------------------------------- |
| Node ≥ 22 + `pnpm`                             | running compose + the deploy script |
| `pnpm install` from the repo root (~30 s cold) | engine itself                       |
| `TANGLE_SANDBOX_API_KEY` env var               | the deploy step (sandbox-sdk auth)  |
| `TANGLE_SANDBOX_BASE_URL` (optional)           | non-default sandbox API host        |

If `TANGLE_SANDBOX_API_KEY` is absent the deploy step fails fast with a
typed `AuthError` from the SDK — there is no "fake-success" code path. The
compose step has zero network and zero env-var dependency and runs
identically with or without the key.

## Step 1 — Compose the bundle

```ts
// compose.ts
import { composeStarter } from './src/lib/compose.js'

await composeStarter({
  spec: {
    family: 'agent-runtime-research',
    layers: ['agent-base:tangle', 'agent-tools:research-corpus', 'agent-output:blocks'],
    projectName: 'research-assistant',
  },
  outDir: '/tmp/research',
})
```

```bash
pnpm exec tsx compose.ts
```

Time: **~0.6 s wall**. Files written:

```
/tmp/research/
├── agent.json                       # AgentProfile, see schema below
├── AGENTS.md                        # the agent's role + output blocks
│                                    # (auto-injected by the harness)
├── methodology/
│   ├── index.json
│   ├── literature-survey.md
│   └── proposal-drafting.md
├── README.md
├── TOOLS.md
└── .starter-foundry/compose-report.json
```

`agent-base:secure` auto-attaches via the family manifest's `includes[]`;
do not pass it as an explicit `layers[]` entry.

## Step 2 — Inspect the composed `agent.json`

```bash
cat /tmp/research/agent.json | jq .
```

The shape (single-agent variant of the schema in
[`docs/architecture/agent-bundles.md`](../architecture/agent-bundles.md#agentjson--single-agent-shape)):

```json
{
  "$schema": "https://starter-foundry.tangle.tools/schemas/agent.schema.json",
  "name": "research-assistant",
  "description": "Reads papers, drafts surveys and proposals, emits structured blocks.",
  "version": "0.1.0",
  "tags": ["research", "literature-survey"],
  "prompt": {
    "systemPrompt": "@file:AGENTS.md",
    "instructions": [
      "When the user asks for a survey, follow methodology/literature-survey.md.",
      "When drafting a proposal, follow methodology/proposal-drafting.md.",
      "Emit results as :::survey or :::proposal fenced blocks."
    ]
  },
  "model": { "default": "anthropic/claude-sonnet-4-20250514" },
  "tools": { "bash": true, "read": true, "write": true },
  "permissions": { "bash": "ask", "write": "ask" },
  "resources": {
    "files": [
      {
        "path": "AGENTS.md",
        "resource": {
          "kind": "inline",
          "name": "agents-md",
          "content": "@file:AGENTS.md"
        }
      },
      {
        "path": "methodology/literature-survey.md",
        "resource": {
          "kind": "inline",
          "name": "literature-survey",
          "content": "@file:methodology/literature-survey.md"
        }
      },
      {
        "path": "methodology/proposal-drafting.md",
        "resource": {
          "kind": "inline",
          "name": "proposal-drafting",
          "content": "@file:methodology/proposal-drafting.md"
        }
      }
    ]
  }
}
```

`@file:` refs are deploy-time markers; `scripts/deploy-agent-bundle.ts`
reads those files from the bundle directory and inlines them into the
[`AgentProfileResourceRef`][resource-ref] shape the sandbox-sdk consumes.
The same `AGENTS.md` content lives at both `prompt.systemPrompt` (for the
SDK) and `resources.files[].path: "AGENTS.md"` (for the on-disk
auto-injection); see
[`docs/architecture/agent-bundles.md`](../architecture/agent-bundles.md#what-the-deploy-script-writes-vs-whats-pushed-via-sdk)
for why both.

## Step 3 — Deploy into a sandbox

```bash
export TANGLE_SANDBOX_API_KEY=sk_sandbox_...
pnpm exec tsx scripts/deploy-agent-bundle.ts \
  --bundle /tmp/research \
  --name my-research-agent
```

What the script does, in order:

1. Reads `/tmp/research/agent.json`, validates it against
   `registry/_schemas/agent.schema.json`.
2. Resolves every `@file:` ref — pulls file contents into
   `resources.files[*].resource.content` so the wire payload is
   self-contained.
3. Calls `client.create({ name, backend: { profile } })` — sandbox-sdk
   provisions a container, picks the right backend (default: `opencode`),
   and stamps the profile.
4. Writes every bundle file via `box.files.write(...)` to its target path
   under `/home/agent/` — `AGENTS.md`, `methodology/*.md`, `README.md`,
   `TOOLS.md`, etc.
5. Prints the sandbox id and a sample `box.task(...)` invocation.

Output (shape):

```
✓ validated agent.json
✓ inlined 3 resource files
✓ sandbox created: sandbox_01HZQ…
✓ files written: 6 (under /home/agent/)
$ next:
  const r = await box.task("Survey latest papers on diffusion models")
```

## Step 4 — Run a task

```ts
// run-task.ts
import { Sandbox } from '@tangle-network/sandbox'

const client = new Sandbox({ apiKey: process.env.TANGLE_SANDBOX_API_KEY! })
const box = await client.get('sandbox_01HZQ…')

const r = await box.task('Survey latest papers on diffusion models')
console.log(r.response)
console.log({ usage: r.usage, durationMs: r.durationMs, traceId: r.traceId })
```

`box.task()` runs to completion inside the sandbox — the OpenCode/Claude
harness loads `/home/agent/AGENTS.md` as part of the system prompt, picks
the `literature-survey` capability from the methodology index, calls the
model, and returns the final response.

## Time-to-first-response

**Live deploy is gated on `TANGLE_SANDBOX_API_KEY`.** Without the key,
operators get a typed auth error from the SDK and stop — there is no
mock fallback (see [`docs/DESIGN-INVARIANTS.md`](../DESIGN-INVARIANTS.md)
on fail-loud).

Local-only assertions (verified, deterministic):

- **Compose latency**: ~0.6 s from a cold process, ~5 ms with a warm cache.
- **Validate latency**: `pnpm exec tsx scripts/validate-registry.ts` runs
  the schema check across all 163 families in ~250 ms.
- **Sandbox create p50** (per [`agent-dev-container` SDK README][sdk-readme]):
  typically a few seconds, dominated by container provisioning.
- **`box.task()` first-response latency**: dominated by the LLM call;
  for `claude-sonnet-4-20250514` against `router.tangle.tools`, in-repo
  measurements land in the 3–6 s range for a ~1k-token prompt.

## Related

- [`docs/architecture/agent-bundles.md`](../architecture/agent-bundles.md) — why this works the way it does.
- [`docs/cookbooks/deploy-multi-agent-startup-team.md`](./deploy-multi-agent-startup-team.md) — the multi-agent variant of this same flow.
- [`docs/specs/agent-base-secure.md`](../specs/agent-base-secure.md) — the in-process security helpers a bundle author can use.

[resource-ref]: https://github.com/tangle-network/agent-dev-container/blob/main/products/sandbox/sdk/src/agent-profile.ts#L17-L28
[sdk-readme]: https://github.com/tangle-network/agent-dev-container/blob/main/products/sandbox/sdk/README.md
