# AGENTS.md

## Step 0 — Start the dev server (do this FIRST)

Before reading anything else in this file, run this command in `bash` to start the primary project's dev server. The user is waiting for a preview. This is idempotent — safe to call multiple times (returns the same pid). It auto-installs dependencies on first call, so you do NOT need to run `pnpm install` separately. Subsequent edits hot-reload via HMR; do NOT call this again to restart unless the response says you should.

```bash
curl -fsS -X POST "http://localhost:${SIDECAR_PORT:-9000}/process/ensure-dev-server" -H "Content-Type: application/json" -H "Authorization: Bearer ${SIDECAR_AUTH_TOKEN}" -d '{}'
```

The `SIDECAR_PORT` and `SIDECAR_AUTH_TOKEN` env vars are pre-set in your bash environment — you do NOT need to look them up.

CRITICAL: Do NOT run `pnpm install`, `pnpm dev`, `npm install`, `npm run dev`, `next dev`, `vite`, `cargo run`, or any other dev/install command via `bash` directly. The command above handles all of that AND tracks the dev process for the runtime so the user's preview pane wires up automatically. Running them directly bypasses the runtime tracking and the user will not see a preview.

The response is JSON with `{ success, data: { pid, family, command, startedNow, installRan } }` on success or `{ success: false, error: { code, message, log? } }` on failure. Error codes: `WORKSPACE_NOT_FOUND | NO_RUNNABLE_PROJECT | INSTALL_FAILED | DEV_COMMAND_NOT_FOUND | DEV_PROCESS_EXITED | PORT_BIND_FAILED`. Read the `log` field on failure to find what to fix, then call again.

Read `PROJECT.md` first after Step 0.
Primary project is `app`. Start there unless blocked.
Build on top of the prepared workspace. Do not replace architecture from zero without a concrete blocker.
Prefer validated commands and known entrypoints before broad repo exploration.

## app
- path: `app`
- family: `agent-with-ui-ts`
- entrypoints: `src/App.tsx`
- validated commands: `pnpm dev`, `pnpm build`
## agent
- path: `agent`
- family: `agent-runtime-recruiter-ts`
- entrypoints: `AGENTS.md`, `src/lib/tangle.ts`
- validated commands: none
## eval
- path: `eval`
- family: `agent-eval-harness-ts`
- entrypoints: `src/eval/runner.ts`, `src/eval/cli.ts`, `src/lib/tangle.ts`
- validated commands: `pnpm install`, `pnpm eval`, `pnpm eval:compare`, `pnpm typecheck`, `pnpm eval:gate baseline.json head.json`
