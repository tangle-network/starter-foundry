# AGENTS.md

Build a agent-with-ui-ts project

## Step 0 — Start the dev server (do this FIRST)

Before reading anything else in this file, run this command in `bash` to start the dev server. The user is waiting for a preview. This is idempotent — safe to call multiple times (returns the same pid). It auto-installs dependencies on first call, so you do NOT need to run `pnpm install` separately. Subsequent edits hot-reload via HMR; do NOT call this again to restart unless the response says you should.

```bash
curl -fsS -X POST "http://localhost:${SIDECAR_PORT:-9000}/process/ensure-dev-server" -H "Content-Type: application/json" -H "Authorization: Bearer ${SIDECAR_AUTH_TOKEN}" -d '{}'
```

The `SIDECAR_PORT` and `SIDECAR_AUTH_TOKEN` env vars are pre-set in your bash environment — you do NOT need to look them up.

CRITICAL: Do NOT run `pnpm install`, `pnpm dev`, `npm install`, `npm run dev`, `next dev`, `vite`, `cargo run`, or any other dev/install command via `bash` directly. The command above handles all of that AND tracks the dev process for the runtime so the user's preview pane wires up automatically. Running them directly bypasses the runtime tracking and the user will not see a preview.

The response is JSON: `{ "success": true, "data": { "pid": ..., "family": "node-pnpm", "command": "...", "startedNow": true|false, "installRan": true|false } }`. On error: `{ "success": false, "error": { "code": "...", "message": "..." } }` with codes `WORKSPACE_NOT_FOUND | NO_RUNNABLE_PROJECT | INSTALL_FAILED | DEV_COMMAND_NOT_FOUND | DEV_PROCESS_EXITED | PORT_BIND_FAILED`. React to each: `INSTALL_FAILED` → read the `log` field, fix `package.json`, call again; `DEV_COMMAND_NOT_FOUND` → add a `dev` script to `package.json`, call again; `DEV_PROCESS_EXITED` → read `log`, fix the bug in `src/`, call again.

## What's here

This project was scaffolded by starter-foundry. The choices below were made deterministically from the user's brief.

- **Family:** `agent-with-ui-ts`
- **Layers:** `ui-adapter:blocks-renderer`

## Key files

- `src/App.tsx`

## Pre-installed packages — do NOT re-install

These are already in `package.json` (the sidecar's ensure-dev-server auto-installed them on first call). If you need any of these, **import them** — do not run `pnpm add`, `pnpm install <name>`, `npm install <name>`, or equivalent. Re-installing a present package burns turns and tokens for zero gain.

- `@tangle-network/sandbox-sdk`
- `@tangle-network/sandbox-ui`
- `@types/react`
- `@types/react-dom`
- `@vitejs/plugin-react`
- `autoprefixer`
- `postcss`
- `react`
- `react-dom`
- `tailwindcss`
- `typescript`
- `vite`

If you need a package that is NOT on this list, THEN you may add it — but check this list first.

## Turn 1 (do these before writing features)

1. Call the dev-server route from Step 0 (above). Wait for success.
2. Read the user's brief (above) and the Placeholders section.
3. Rewrite `personalize.json` + `personalize.css` (brand strings + palette). These are render-time — preview updates on next refresh, no rebuild.
4. Delete or rewrite EVERY file in the Placeholders list. Not optional.
5. Only after (3) + (4) do you start feature work.

## Before first preview screenshot

- Confirm the landing surface renders the user's product (no default KPI cards from a dashboard template).
- Brand strings in `personalize.json` are product-specific, not the scaffold default.
- Any placeholder file in the list above has been replaced or deleted.

## Before shipping

- Run the family's validate script (see Key files above).
- Re-check Gotchas (above) against what you built — those traps bite most at ship time.
- If you added deps, they're in `package.json`; if you added routes/pages, they're reachable.

## How to use this scaffold

This is a starting point, not a contract. You own every file.

- **Customize freely.** Replace components, change the layout, swap the color scheme — whatever fits the user's product.
- **The scaffold saves you setup time** — Tailwind, shadcn/ui, path aliases, and framework config are ready. Don't redo them.
- **Check `.starter-foundry/compose-report.json`** if you want to see which layer wrote which file.
- **Update this file** as the project evolves. Delete sections that no longer apply.
