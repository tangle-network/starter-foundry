# Upstream issue: sandbox SDK lacks pre/post deploy hook surface

**Severity:** HIGH
**Repo:** `tangle-network/agent-dev-container`
**Component:** `products/sandbox/sdk`
**Filed by:** starter-foundry / `feat/agent-base-mcp-registry-and-harness-aware-deploy`
**Recommended action:** operator files this issue post-merge.

## Summary

`@tangle-network/sandbox` exposes no pre/post-create hook surface. Callers
that need workspace shaping (rename `CLAUDE.md` <-> `AGENTS.md`, swap MCP file
paths, run `npm install` in the workspace, mint a credential before
`sandbox.create`) must implement that orchestration in their own deploy
script — duplicating the same scaffold across every consumer (`gtm-agent`,
`starter-foundry`, `agent-factory`, `tax-filler-filer`, ...).

starter-foundry's `scripts/deploy-agent-bundle.ts` ships the workaround on
the consumer side, but the right home is the SDK.

## Investigation

Audit of `~/webb/agent-dev-container/products/sandbox/sdk/src/`:

- `sandbox.ts` — only `onProgress` callback exists, scoped to `box.waitFor`
  state polling (a UI affordance, not a deploy hook).
- `types.ts` `CreateSandboxOptions` — backend / image / driver knobs only.
  No callback fields. No pre/post phases.
- `INTEGRATION.md` — documents the wire shape but does not surface a hook
  contract.

There is no `beforeCreate` / `onCreate` / `afterCreate` / `lifecycle` /
`hooks` field in any public type.

## Use cases starter-foundry hit

1. **Harness translation post-create.** When a deploy targets `claude-code`,
   the workspace needs `CLAUDE.md` instead of `AGENTS.md`. We currently
   compute the right filename in `toWorkspaceFiles` and `box.files.write`
   it ourselves. An SDK hook would let the SDK do this once.

2. **Pre-create credential mint.** A bundle's pre-deploy script may want to
   prompt the user for a credential, mint a token, write it to `.env` in
   the user's CWD, and only THEN call `sandbox.create` so the env is
   available when `backend.profile` resolves.

3. **Post-create workspace bootstrap.** After `box.files.write`, run
   `npm install` / `pip install` / one-time setup in the workspace before
   handing off to `box.task()`. Today this is a chain of `box.exec` calls
   the consumer manages.

4. **MCP registry mutation.** The bundle ships `.mcp.json` with N starter
   servers; the resident agent only needs a subset. A post-create hook
   can prune in one place rather than every agent re-implementing it.

## Proposed API

Add an optional `hooks` field to `CreateSandboxOptions`:

```ts
export interface CreateSandboxOptions {
  // ... existing fields ...
  hooks?: {
    /**
     * Runs on the deploying machine BEFORE the SDK calls /v1/sandboxes.
     * Receives the resolved options. May mutate them or throw to abort.
     */
    beforeCreate?: (opts: Readonly<CreateSandboxOptions>) => void | Promise<void>

    /**
     * Runs after the sandbox transitions to running but BEFORE the
     * Sandbox handle is returned to the caller. Receives the live box
     * for early bootstrap (file writes, exec, etc).
     */
    afterCreate?: (box: Sandbox) => void | Promise<void>
  }
}
```

Both hooks are optional and run in-process. Errors surface as the
`sandbox.create()` rejection (no swallowing, no muffled-gate).

## Workaround in starter-foundry

Until the SDK adds first-class hooks, `scripts/deploy-agent-bundle.ts`
implements:

- `bundle.hooks.pre` — script path; runs LOCALLY in the user's CWD before
  `client.create`. Inherited stdio. Non-zero exit aborts deploy.
- `bundle.hooks.post` — script path; pushed into the sandbox via
  `box.files.write`, then `box.exec(['bash', sandboxPath])`.

CLI flag `--skip-hooks` opts out. See `tests/deploy-agent-bundle-harness.test.ts`
for the integration coverage.

## When to retire the workaround

Once `CreateSandboxOptions.hooks` ships, starter-foundry's deploy script
should delegate to it and delete the local hook implementation. The
bundle-side `hooks` field stays — it's the bundle's contract; only the
plumbing changes.
