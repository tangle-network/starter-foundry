# Deploying an agent bundle to a Tangle Sandbox

starter-foundry's `agent-runtime-*` and `multi-agent-*` bundles are markdown
packs (a system prompt plus a methodology directory). Earlier prototypes
(PRs #85/#86/#87) tried to wrap them in a custom Vite + Hono server. That was
the wrong layer: every Tangle sandbox already runs an OpenCode/Claude/Hermes
agent loop (see `box.task()` in `@tangle-network/sandbox`), and the harness
itself auto-discovers two well-known files at the workspace root:

- `AGENTS.md` — the orchestrator's system prompt (read by every supported
  harness: OpenCode, Claude Code, Hermes, Codex, Amp, Kimi-Code; see
  `apps/sidecar/src/agents/base-agent.ts`).
- `agents.json` — OpenCode subagent definitions (read by
  `apps/sidecar/src/agents/subagents/load-agents-config.ts`).

The deploy path is therefore:

```
agent.json + AGENTS.md (+ subagents)
   ↓  toAgentProfile     → backend.profile  (full-replacement system prompt)
   ↓  toWorkspaceFiles   → /home/agent/AGENTS.md, /home/agent/agents.json,
                            /home/agent/methodology/*, /home/agent/README.md, …
   ↓  client.create + box.files.write
   ↓  box.task(...)
```

## Bundle layout

A deployable bundle is a directory containing an `agent.json` that conforms to
[`registry/_schemas/agent.schema.json`](../../registry/_schemas/agent.schema.json),
plus the markdown files it references. Minimal single-agent example:

```
my-bundle/
├── agent.json
├── AGENTS.md
├── README.md
└── methodology/
    ├── literature-survey.md
    └── proposal-drafting.md
```

Minimal `agent.json`:

```json
{
  "name": "research-assistant",
  "version": "0.1.0",
  "workspace": { "root": "/home/agent" },
  "prompt": { "systemPromptFile": "AGENTS.md" },
  "model": { "preferred": "anthropic/claude-sonnet-4-7" },
  "tools": { "bash": true, "edit": true },
  "permissions": { "bash": "ask", "edit": "allow", "webfetch": "deny" },
  "resources": {
    "files": [
      { "source": "methodology" },
      { "source": "README.md" }
    ]
  }
}
```

`workspace.root` defaults to `/home/agent` (the harness convention) and can
be omitted. `resources.files[].target` defaults to `<workspace.root>/<source>`,
so most bundles never set it explicitly.

Multi-agent bundles add a `subagents` map. Each entry is emitted into
`<workspace.root>/agents.json` under the OpenCode shape:

```json
{
  "ceo": {
    "mode": "subagent",
    "description": "Routes work between specialists.",
    "prompt": "# CEO\n\n…",
    "temperature": 0.2,
    "tools": { "bash": true, "edit": true },
    "permission": { "edit": "ask" }
  }
}
```

`permission` is **singular** at the harness layer (verified against
`apps/sidecar/agents.json` and `load-agents-config.ts`); the bundle spec uses
plural `permissions` and the deploy script translates at the boundary. See
`tests/fixtures/agent-bundle-multi/` for a working two-role fixture.

## Translation

`src/lib/agent-bundle.ts` exposes:

- `loadAgentBundle(dir)` — reads `agent.json`, validates against the schema,
  throws on missing/invalid input.
- `resolveSystemPrompt(bundle, dir)` — reads the orchestrator AGENTS.md content.
- `resolveWorkspaceRoot(bundle)` — `bundle.workspace.root` or `/home/agent`.
- `toAgentProfile(bundle, dir)` — produces the SDK's portable `AgentProfile`
  (passed as `backend.profile` for the full-replacement system prompt and
  subagent profiles).
- `toWorkspaceFiles(bundle, dir)` — produces the `Array<{ targetPath, content }>`
  the deploy script writes via `box.files.write` at the workspace root:
  - `<workspace.root>/AGENTS.md`
  - `<workspace.root>/agents.json` (multi-agent only)
  - one entry per `resources.files[]` (directories expanded recursively)

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

| flag            | purpose                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `--bundle`      | bundle directory containing `agent.json` (required)                      |
| `--name`        | sandbox name to create (required)                                        |
| `--api-key-env` | env var holding the API key (default `TANGLE_SANDBOX_API_KEY`)           |
| `--base-url`    | sandbox API base URL (or set `TANGLE_SANDBOX_BASE_URL`)                  |
| `--image`       | base image (default `node:20`)                                           |
| `--task`        | optional initial task to run after deploy                                |
| `--dry-run`     | print the AgentProfile + workspace-file plan without calling the SDK     |

The script:

1. Loads + validates the bundle.
2. Builds the `AgentProfile` (consumed by `backend.profile`).
3. Builds the workspace-file list (`AGENTS.md`, optional `agents.json`, resources).
4. Imports `@tangle-network/sandbox` dynamically (clear GAP error if missing).
5. `client.create({ name, image, backend: { profile } })`.
6. `box.files.write` each workspace file at `<workspace.root>`.
7. Optionally runs `box.task(prompt)` and prints the response.

Re-entering the sandbox later:

```ts
const box = await client.get('<sandbox-id>')
await box.task('Draft the proposal block from yesterday\'s findings')
```

## Verification status

| check                                                                                        | result                                                                                                                                         |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| schema validates a hand-written `agent.json` fixture                                         | PROOF (`tests/fixtures/agent-bundle-example/`)                                                                                                 |
| `toAgentProfile` single-agent translation                                                    | PROOF (`tests/agent-bundle.test.ts`)                                                                                                           |
| `toAgentProfile` multi-agent / subagents translation                                         | PROOF (`tests/agent-bundle.test.ts`)                                                                                                           |
| `toWorkspaceFiles` single-agent emits AGENTS.md + resources at `/home/agent`                 | PROOF (`tests/agent-bundle.test.ts`)                                                                                                           |
| `toWorkspaceFiles` multi-agent emits AGENTS.md + agents.json + role assets                   | PROOF (`tests/agent-bundle.test.ts`)                                                                                                           |
| emitted `agents.json` matches OpenCode shape (mode/description/prompt/tools/permission)      | PROOF (`tests/agent-bundle.test.ts` boundary assertion)                                                                                        |
| live `client.create` + `box.files.write` + `box.task` against a real Tangle sandbox API      | **GAP**                                                                                                                                        |
| `agent.json` exists alongside `manifest.json` in `registry/families/agent-runtime-research/` | **GAP** — sister parallel agents are converting the 53 single-agent + 5 multi-agent bundles to the new file convention on top of this foundation |

### Why the live test is a GAP

End-to-end proof requires:

- `@tangle-network/sandbox` installed in the consuming environment (it is not
  yet a `dependencies` entry on starter-foundry's `package.json` — adding it
  would couple this otherwise dependency-light scaffolding package to the
  sandbox SDK release cadence; we leave the install to the deployer).
- A reachable `TANGLE_SANDBOX_BASE_URL` (the current dev environment cannot
  resolve `*.tangle.tools` from this worktree's network).
- A valid `TANGLE_SANDBOX_API_KEY` scoped for sandbox creation.

The unit suite asserts the _exact wire shape_ the live call would receive
(`backend.profile` with inline `systemPrompt`, flattened `subagents[].prompt`,
absolute `<workspace.root>/...` workspace-file paths, OpenCode-shape
`agents.json`). If the SDK or harness contract drifts, the boundary assertions
in `tests/agent-bundle.test.ts` will fail before any runtime call is made.

When a live key + reachable API land, the live-deploy run (`pnpm deploy-agent`
without `--dry-run`) is the one-line confirmation step. No code change needed.
