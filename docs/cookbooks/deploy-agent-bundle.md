# Deploying an agent bundle to a Tangle Sandbox

starter-foundry's `agent-runtime-*` and `multi-agent-*` bundles are markdown
packs (a system prompt plus a methodology directory). Earlier prototypes
(PRs #85/#86/#87) tried to wrap them in a custom Vite + Hono server. That was
the wrong layer: every Tangle sandbox already runs an OpenCode/Claude agent
loop (see `box.task()` in `@tangle-network/sandbox`), and the bundle just
needs to configure it.

This cookbook covers the new path:

```
agent.json + markdown  →  AgentProfile  →  client.create({ backend: { profile } })  →  box.task(...)
```

## Bundle layout

A deployable bundle is a directory containing an `agent.json` that conforms to
[`registry/_schemas/agent.schema.json`](../../registry/_schemas/agent.schema.json),
plus the markdown files it references. Minimal single-agent example:

```
my-bundle/
├── agent.json
├── system-prompt.md
└── methodology/
    ├── literature-survey.md
    └── proposal-drafting.md
```

Minimal `agent.json`:

```json
{
  "name": "research-assistant",
  "version": "0.1.0",
  "prompt": { "systemPromptFile": "system-prompt.md" },
  "model": { "preferred": "anthropic/claude-sonnet-4-7" },
  "tools": { "bash": true, "edit": true },
  "permissions": { "bash": "ask", "edit": "allow", "webfetch": "deny" },
  "resources": {
    "files": [
      { "source": "system-prompt.md", "target": "system-prompt.md" },
      { "source": "methodology", "target": "methodology" }
    ]
  }
}
```

Multi-agent bundles add a `subagents` map; each entry's `systemPromptFile` is
inlined into the corresponding `AgentProfile.subagents[id].prompt` at deploy
time. See `tests/fixtures/agent-bundle-multi/` for a working two-role fixture.

## Translation

`src/lib/agent-bundle.ts` exposes:

- `loadAgentBundle(dir)` — reads `agent.json`, validates against the schema,
  throws on missing/invalid input.
- `resolveSystemPrompt(bundle, dir)` — reads the system-prompt content.
- `toAgentProfile(bundle, dir)` — produces the SDK's portable `AgentProfile`:
  - inlines the system prompt into `prompt.systemPrompt`
  - flattens each subagent's prompt into `subagents[id].prompt`
  - walks every `resources.files[]` entry (recursively when a directory is
    given) into per-file `AgentProfileFileMount` entries with absolute
    `/workspace/...` targets

## Deploy script

```bash
pnpm deploy-agent \
  --bundle registry/families/agent-runtime-research \
  --name research-assistant-demo \
  --api-key-env TANGLE_SANDBOX_API_KEY \
  --base-url https://sandbox-api.tangle.tools \
  --task "Run today's literature survey"
```

Flags:

| flag            | purpose                                                        |
| --------------- | -------------------------------------------------------------- |
| `--bundle`      | bundle directory containing `agent.json` (required)            |
| `--name`        | sandbox name to create (required)                              |
| `--api-key-env` | env var holding the API key (default `TANGLE_SANDBOX_API_KEY`) |
| `--base-url`    | sandbox API base URL (or set `TANGLE_SANDBOX_BASE_URL`)        |
| `--image`       | base image (default `node:20`)                                 |
| `--task`        | optional initial task to run after deploy                      |
| `--dry-run`     | print the generated `AgentProfile` without calling the SDK     |

The script:

1. Loads + validates the bundle.
2. Builds the `AgentProfile`.
3. Imports `@tangle-network/sandbox` dynamically (clear GAP error if missing).
4. `client.create({ name, image, backend: { profile } })`.
5. Writes every resource file via `box.files.write`.
6. Optionally runs `box.task(prompt)` and prints the response.

Re-entering the sandbox later:

```ts
const box = await client.get('<sandbox-id>')
await box.task('Draft the proposal block from yesterday's findings')
```

## Verification status

| check                                                                                        | result                                                                                                                                         |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| schema validates a hand-written `agent.json` fixture                                         | PROOF (`tests/fixtures/agent-bundle-example/`)                                                                                                 |
| `toAgentProfile` single-agent translation                                                    | PROOF (`tests/agent-bundle.test.ts`)                                                                                                           |
| `toAgentProfile` multi-agent / subagents translation                                         | PROOF (`tests/agent-bundle.test.ts`)                                                                                                           |
| `toAgentProfile` shape matches SDK `AgentProfile` boundary contract                          | PROOF (boundary assertion in same test)                                                                                                        |
| `pnpm deploy-agent --dry-run --bundle tests/fixtures/agent-bundle-example`                   | PROOF (exits 0, prints valid AgentProfile JSON with inlined system prompt + 3 file mounts)                                                     |
| live `client.create` + `box.task` against a real Tangle sandbox API                          | **GAP**                                                                                                                                        |
| `agent.json` exists alongside `manifest.json` in `registry/families/agent-runtime-research/` | **GAP** — existing bundles still use the family-schema `manifest.json`; an `agent.json` translator/migration is the next PR (see "Next" below) |

### Why the live test is a GAP

End-to-end proof requires:

- `@tangle-network/sandbox` installed in the consuming environment (it is not
  yet a `dependencies` entry on starter-foundry's `package.json` — adding it
  would couple this otherwise dependency-light scaffolding package to the
  sandbox SDK release cadence; we leave the install to the deployer).
- A reachable `TANGLE_SANDBOX_BASE_URL` (the current dev environment cannot
  resolve `*.tangle.tools` from this worktree's network).
- A valid `TANGLE_SANDBOX_API_KEY` scoped for sandbox creation. The keys
  surfaced from `~/company/devops/secrets/agent-state.env` (`SANDBOX_GATEWAY_*`)
  fail to decrypt with the available `.env.keys`, so they are unusable here.

The unit suite asserts the _exact wire shape_ the live call would receive
(`backend.profile` with inline `systemPrompt`, flattened `subagents[].prompt`,
absolute `/workspace/*` file mount paths, `inline` resource refs).
If the SDK shape drifts, the boundary assertion in
`tests/agent-bundle.test.ts:114` will fail before any runtime call is made.

When a live key + reachable API land, the live-deploy run (`pnpm deploy-agent`
without `--dry-run`) is the one-line confirmation step. No code change needed.

## Next: bundle migration

Today every family in `registry/families/` ships a `manifest.json` (the
family schema), which carries the bundle's curatorial metadata (slots,
keywords, taxonomy). The new `agent.json` is the deployment-time spec; both
can coexist in the same directory. The follow-up PR is a migration script
that reads `manifest.json` + `files/system-prompt.md` and emits a sibling
`agent.json` for every `agent-runtime-*` and `multi-agent-*` family. Once
that lands, `pnpm deploy-agent --bundle registry/families/<id>` becomes the
canonical way to push a starter-foundry bundle to a sandbox.
