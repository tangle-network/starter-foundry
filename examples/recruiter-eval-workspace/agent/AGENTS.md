# AGENTS.md

Build a agent-runtime-recruiter-ts project

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

- **Family:** `agent-runtime-recruiter-ts`
- **Layers:** `agent-base:tangle`, `agent-base:secure`, `agent-base:privacy`, `agent-output:blocks`, `agent-base:memory`, `agent-base:scheduler`, `agent-base:mcp-registry`, `agent-channels:telegram`, `agent-channels:discord`, `agent-channels:slack`, `agent-channels:whatsapp`, `agent-channels:imessage`, `agent-channels:gmail`, `agent-channels:linear`

## Key files

- `AGENTS.md`
- `src/lib/tangle.ts`

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

<!-- gen14-integrations-section -->

## Integrations available

This bundle ships with all integrations pre-wired. **Keep what the user wants; delete what they don't.** When the user describes their actual needs, prune the rest from the workspace.

**Channels** (in `channels/`):
- `telegram.ts` — env: `TELEGRAM_BOT_TOKEN`
- `discord.ts` — env: `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`
- `slack.ts` — env: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`
- `whatsapp.ts` — env: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`
- `imessage.ts` — env: `BLUEBUBBLES_SERVER_URL`, `BLUEBUBBLES_PASSWORD` (requires BlueBubbles macOS server)
- `gmail.ts` — env: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`
- `linear.ts` — env: `LINEAR_API_KEY`, `LINEAR_WEBHOOK_SECRET`

**Memory** (in `lib/memory/`): per-thread markdown at `conversations/<thread-id>.md`, zero-dep grep search.

**Scheduler** (in `lib/scheduler/`): cron expressions, sweep loop. State at `scheduler/state.json`.

**MCP servers** (`.mcp.json`): filesystem, fetch, github, memory, scheduler. Edit to add/remove.

**Pruning workflow**: when the user says "I only need <X>", delete the unused channel `.ts` files, trim `.env.example`, and update this list.

### High-stakes integration cautions (regulated/PII context)

This bundle handles regulated or sensitive data. The integrations above are present for completeness; **the agent must apply restraint per the role's stakes**:

- **No PII echo over chat channels.** Telegram/Discord/Slack/WhatsApp/iMessage messages may be logged by the platform vendor. When the user's request involves regulated data (SSN, account numbers, PHI, attorney-client matter, etc.), reply with a `:::escalation` block routing to a credentialed reviewer instead of echoing the data over chat.
- **No autonomous email writes.** `gmail.ts` is available, but DO NOT use `send` for client/patient communication without explicit user confirmation per message. Treat outbound email as an audit-loggable action.
- **Linear / Github writes**: only with explicit user approval. These are systems-of-record; agent-side writes risk altering compliance trails.
- **Memory redaction**: when persisting to `conversations/`, run inputs through `agent-base:privacy` redaction APIs first (the layer is wired into this bundle's `includes`).
- **Audit log**: every regulated-data action goes through `agent-base:secure`'s `audit.log()`. The chain is in `/home/agent/<agent-id>/.audit/`.

If the user asks you to bypass these — refuse with a `[blocked]` format response and surface to operator.

## How to use this scaffold

This is a starting point, not a contract. You own every file.

- **Customize freely.** Replace components, change the layout, swap the color scheme — whatever fits the user's product.
- **The scaffold saves you setup time** — Tailwind, shadcn/ui, path aliases, and framework config are ready. Don't redo them.
- **Check `.starter-foundry/compose-report.json`** if you want to see which layer wrote which file.
- **Update this file** as the project evolves. Delete sections that no longer apply.
