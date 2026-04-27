# Harness-aware deploys

The `deploy-agent-bundle` script targets one of three harnesses. The
bundle ships its files once; the deploy translates filenames per target.

## `--harness <name>` flag

```
pnpm deploy-agent --bundle ./my-bundle --name my-agent \
  --base-url https://sandbox-api.example.com \
  --harness claude-code
```

Resolution order (highest wins):

1. `--harness <name>` CLI flag
2. `bundle.harness` in `agent.json`
3. Default: `opencode`

## Per-harness emit table

| Harness       | System prompt                  | Subagents     | MCP registry          | Notes                                                                                                                          |
| ------------- | ------------------------------ | ------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `opencode`    | `AGENTS.md`                    | `agents.json` | `.mcp.json`           | Default.                                                                                                                       |
| `claude-code` | `CLAUDE.md` + `AGENTS.md` copy | `agents.json` | `.mcp.json`           | The AGENTS.md copy keeps the workspace portable when the operator flips backends post-deploy.                                  |
| `hermes`      | `AGENTS.md`                    | `agents.json` | `.mcp.json` (partial) | Hermes uses a different MCP convention; the deploy emits `.mcp.json` and warns. See `docs/issues/sandbox-sdk-deploy-hooks.md`. |

The `mcp-registry` layer (`registry/layers/agent-base/mcp-registry`) ships
a starter `.mcp.json` template; the deploy translates the path per
harness above.

## Pre/post hooks

`agent.json` may declare deploy-time hooks:

```json
{
  "hooks": {
    "pre": "hooks/pre.sh",
    "post": "hooks/post.sh"
  }
}
```

### Contract

| Hook   | Where it runs      | When                                       | Use cases                                                |
| ------ | ------------------ | ------------------------------------------ | -------------------------------------------------------- |
| `pre`  | LOCAL (user's CWD) | Before `client.create()`                   | Mint a credential, write `.env`, prompt the user.        |
| `post` | INSIDE THE SANDBOX | After `files.write()`, before any `task()` | `npm install`, one-time setup, prune unused MCP servers. |

### Pre-hook environment

The pre-hook receives the parent env plus:

- `AGENT_BUNDLE_DIR` — absolute bundle directory
- `AGENT_BUNDLE_NAME` — `bundle.name`
- `AGENT_HARNESS` — resolved harness id

Stdio is inherited (`stdio: 'inherit'`); the user sees hook output
directly. Non-zero exit aborts the deploy.

### Post-hook execution

The deploy:

1. `box.files.write(<workspace>/.deploy-hooks/post.sh, content)`
2. `box.exec(['chmod', '+x', sandboxPath])`
3. `box.exec(['bash', sandboxPath], { cwd: workspaceRoot })`

stdout / stderr from the hook are streamed back. Non-zero exit aborts.

### Skipping hooks

`--skip-hooks` opts out for one deploy without editing `agent.json`.
Useful for CI dry runs or when re-deploying after a credential is already
present.

### Path safety

Hook paths are validated against the bundle root. Absolute paths and `..`
traversal are refused — a hostile bundle cannot ask the deploy script to
run `/etc/passwd`.

## Why this lives in the deploy script (for now)

The Tangle sandbox SDK does not currently expose a pre/post-create hook
surface. Until it does, every consumer that needs workspace shaping
re-implements the same orchestration. starter-foundry implements it once
and tracks the upstream gap in `docs/issues/sandbox-sdk-deploy-hooks.md`.

When the SDK ships `CreateSandboxOptions.hooks`, the deploy script will
delegate to it and the bundle-side `hooks` field will become a thin
adapter — the contract from the bundle's POV stays unchanged.
