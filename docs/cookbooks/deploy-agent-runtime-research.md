# Deploying `agent-runtime-research` end-to-end

End-to-end walkthrough: take the `agent-runtime-research` family, compose it
with `composeStarter`, deploy it into a Tangle sandbox via
`scripts/deploy-agent-bundle.ts`, and call `box.task(...)` for a real LLM
response.

> This file replaces the v0.10.x version of itself, which documented a
> "compose → run a Worker" path that never worked. The runtime substrate
> the old version was trying to scaffold (`src/worker.ts`,
> `wrangler.jsonc`, `chatViaRouter()` callers) is not the right
> abstraction — see [`docs/architecture/agent-bundles.md`](../architecture/agent-bundles.md)
> for why. A bundle is content; the sandbox is the runtime.

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
├── system-prompt.md                 # the agent's role + output blocks
├── methodology/
│   ├── index.json
│   ├── literature-survey.md
│   └── proposal-drafting.md
├── README.md
├── TOOLS.md
├── AGENTS.md / CLAUDE.md / llms.txt
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
    "systemPrompt": "@file:system-prompt.md",
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
        "path": "system-prompt.md",
        "resource": {
          "kind": "inline",
          "name": "system-prompt",
          "content": "@file:system-prompt.md"
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
4. Optionally calls `box.files.write(...)` for any bundle file not
   already inlined into `resources.files` (e.g. `README.md`,
   `TOOLS.md` — not used by the agent loop directly, but useful for
   `box.exec("cat README.md")` style introspection).
5. Prints the sandbox id and a sample `box.task(...)` invocation.

Output (shape):

```
✓ validated agent.json
✓ inlined 3 resource files
✓ sandbox created: sandbox_01HZQ…
✓ files written: 6
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
agent loop reads `system-prompt.md`, picks the
`literature-survey` capability from the methodology index, calls the
model, and returns the final response.

## Time-to-first-response

**Live deploy is gated on `TANGLE_SANDBOX_API_KEY`.** This worktree does
not export the key; the dogfood verdict for the runtime path is
therefore **GAP, not PROOF**, and we mark it as such honestly. What we
_can_ assert with current evidence:

- **Compose latency** (verified, deterministic): **~0.6 s** from a cold
  process, **~5 ms** with a warm cache.
- **Validate latency** (verified): `pnpm exec tsx
scripts/validate-registry.ts` runs the schema check across all 163
  families in **~250 ms**.
- **Sandbox create p50** (per
  [`agent-dev-container` SDK README][sdk-readme]): typically a few
  seconds, dominated by container provisioning.
- **`box.task()` first-response latency**: dominated by the LLM call;
  for `claude-sonnet-4-20250514` against `router.tangle.tools`, prior
  in-repo measurements landed in the 3–6 s range for a ~1k-token prompt
  (the v0.10.x dogfood report: 4568 ms HTTP 200 with 1416 total tokens —
  that path was a custom Worker, but the LLM call itself is the same in
  this corrected path).

When `TANGLE_SANDBOX_API_KEY` is exported and the deploy succeeds, this
file should be re-run and the actual end-to-end timing recorded here.
That update is tracked in [`docs/ROADMAP.md`](../ROADMAP.md) under
"Live deploy proof".

## What works in this worktree without a key

- `composeStarter` end-to-end on this family: **PASS** (~0.6 s, 22 files,
  deterministic).
- `pnpm exec tsx scripts/validate-registry.ts`: **PASS** (163 families).
- `pnpm typecheck`: **PASS**.
- `pnpm test`: **PASS** on the last green run; this PR adds no new
  tests because the schema/deploy-script work lives on the sister-agent
  track.

## What is gated on `TANGLE_SANDBOX_API_KEY`

- Step 3 — `client.create(...)` requires real credentials.
- Step 4 — `box.task(...)` requires a running sandbox.
- The end-to-end timing measurement in this file.

There is no mock fallback. Operators run this with a real key, or they
get a typed auth error and stop. That is deliberate — see
[`docs/DESIGN-INVARIANTS.md`](../DESIGN-INVARIANTS.md) on fail-loud.

## What changed from the v0.10.x version of this file

The previous version of this cookbook documented eight gaps — no
`src/worker.ts`, no `wrangler.jsonc`, no `package.json`, throwing
`spawnAgentSandbox()` / `searchPapers()` stubs, etc. **Six of those
eight gaps were gaps in the wrong premise**, not in the family. The
bundle does not need a Worker, a wrangler config, a package.json, or
local fetch wrappers, because the bundle is not a deployable webapp; it
is content for an in-sandbox agent.

The two real gaps that survive the rewrite:

1. The `methodology/index.json` shape (`{ entries: [...] }`) needs to
   match whatever `registry/_schemas/agent.schema.json` declares — the
   sister-agent track is aligning these.
2. `scripts/agent-runtime-bundle-check.ts` is stale (it asks for
   `templates/index.json` instead of `methodology/index.json`).
   Tracked separately.

## Related

- [`docs/architecture/agent-bundles.md`](../architecture/agent-bundles.md) — why this works the way it does.
- [`docs/cookbooks/deploy-multi-agent-startup-team.md`](./deploy-multi-agent-startup-team.md) — the multi-agent variant of this same flow.
- [`docs/specs/agent-base-secure.md`](../specs/agent-base-secure.md) — the in-process security helpers a bundle author can use; v0.11.0 correction at the bottom.

[resource-ref]: https://github.com/tangle-network/agent-dev-container/blob/main/products/sandbox/sdk/src/agent-profile.ts#L17-L28
[sdk-readme]: https://github.com/tangle-network/agent-dev-container/blob/main/products/sandbox/sdk/README.md
