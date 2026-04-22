# Local cli-bridge — wiring starter-foundry's self-heal loop end-to-end

The self-heal proposer (`scripts/self-heal.mjs --dispatch`) and the
DSPy-RLM pr-reviewer both dispatch agentic work through
`@tangle-network/tcloud`. There are **three** dispatch paths, picked
automatically by `src/lib/bridge.ts` based on which env vars you set.

## Three paths

| # | Path | When | Env required | Router charges per token? |
|---|---|---|---|---|
| 1 | **Direct local** | Most local dev | `CLI_BRIDGE_URL` + `CLI_BRIDGE_BEARER` | n/a (router not in path) |
| 2 | **BYOB-via-router** | Local CLIs + router audit | Path 1 + `TCLOUD_API_KEY` + `BRIDGE_UNLOCK` + **public tunnel** | **No** (your subscription pays — see Billing) |
| 3 | **Production** | Default | `TCLOUD_API_KEY` + `BRIDGE_UNLOCK` | **No** (admin-only passthrough — see Billing) |

## Billing

The router's bridge dispatch path (`tangle-router/app/api/chat/route.ts` ~ line 903–997) returns the cli-bridge response verbatim with **no** `deductCredits` call. The handler comment is explicit: *"Skips operator/provider routing, cost accounting, routing rules, and guardrails — this is an admin-only passthrough meant for subscription-backed coding sessions."*

- **BYOB**: LLM tokens are paid by the subscription on your cli-bridge's box. Router billing them on top would be double-charging — and doesn't happen.
- **Env-bridge (path 3)**: gated by `CLI_BRIDGE_UNLOCK_TOKEN` + `CLI_BRIDGE_ALLOWED_USER_IDS` (admin allowlist), so per-user metering isn't applied.
- **Non-bridge chat** (regular `tcloud.chat()` against `provider/model`, not `bridge/...`): full per-token deduction at `route.ts:1396` / `:1471` — that path uses Tangle-pooled provider keys.

## TL;DR — direct mode (path 1, easiest)

cli-bridge is a real OpenAI-compatible HTTP server (`/v1/chat/completions`).
We point a `TCloudClient` straight at it; no router involvement,
no tunnel, no `TCLOUD_API_KEY`/`BRIDGE_UNLOCK` needed.

```bash
# 1. one-shot setup (probes harness binaries, writes .env.local, prints next steps)
node scripts/setup-local-cli-bridge.mjs

# 2. start the server in its own terminal/tmux pane
cd ~/code/cli-bridge && export $(grep -v '^#' .env.local | xargs) && pnpm exec tsx src/server.ts

# 3. in your starter-foundry shell:
export CLI_BRIDGE_URL=http://127.0.0.1:3344
export CLI_BRIDGE_BEARER=<value from .env.local>
node scripts/self-heal.mjs --dispatch --top 1
```

Verified end-to-end: `createBridge({harness:'claude-code',...}).ask('hi')` → ~150ms → returns the assistant text directly from your local `claude` CLI.

## Architecture

### Path 1 — Direct local (no router)

```
   self-heal.mjs / pr-reviewer
                 │
                 ▼
   TCloudClient(baseURL=http://127.0.0.1:3344/v1)
                 │
                 ▼
        cli-bridge (your box)
                 │
                 ▼
   claude / kimi / codex CLI (your auth on this box)
```

cli-bridge IS an OpenAI-compatible server. The SDK's `chat()` POSTs to
`{baseURL}/chat/completions` — exactly cli-bridge's mounted path. We
just override `baseURL` and use `Authorization: Bearer ${BRIDGE_BEARER}`.
No router envelope, no `bridge/` prefix needed (cli-bridge accepts
`<harness>/<model>` directly).

### Path 2 — BYOB-via-router (tunneled)

```
   self-heal.mjs / pr-reviewer
                 │
                 ▼
       tcloud.bridge({..., bridgeUrl, bridgeBearer})
                 │
                 ▼
   router.tangle.tools/api/chat                ← BRIDGE_UNLOCK gate
                 │
                 ▼ (server-side fetch from router box to your tunnel)
   https://your-ngrok.ngrok.io                 ← public tunnel
                 │
                 ▼
        cli-bridge (your box)
                 │
                 ▼
   claude / kimi / codex CLI
```

**Important**: `CLI_BRIDGE_URL` here must be reachable **from the
router box's network**, not from your laptop. Pure `127.0.0.1` won't
work — the router will fetch its own loopback. Use ngrok / cloudflare
tunnel / tailscale funnel:

```bash
ngrok http 3344
# → use the https://*.ngrok.io URL as CLI_BRIDGE_URL
```

### Path 3 — Production (default)

```
   self-heal.mjs / pr-reviewer
                 │
                 ▼
       tcloud.bridge({...})
                 │
                 ▼
   router.tangle.tools/api/chat                ← BRIDGE_UNLOCK gate
                 │
                 ▼
        cli-bridge inside the router's docker network
                 │
                 ▼
   claude / kimi / codex CLI (router-side auth)
```

## Harness CLI auth

Each subscription-backed harness needs OAuth on the box that runs
cli-bridge:

| harness | install | login |
|---|---|---|
| `claude-code` | (Claude Code CLI bundled with this user's setup) | `claude /login` |
| `kimi-code` | `pipx install kimi-cli` (publishes the `kimi` binary) | `kimi login` |
| `codex` | (OpenAI Codex CLI) | `codex login` |
| `opencode` | `brew install sst/tap/opencode` | `opencode auth login` |

`setup-local-cli-bridge.mjs` probes which binaries are on PATH and
flags the missing ones; routes for missing harnesses 503 until you
install + auth them.

## API-key (non-agentic) Kimi via passthrough

If you only need cheap chat completions (DSPy-RLM analysis, judges,
clusterers), you don't need OAuth — pass a Moonshot API key as
`MOONSHOT_API_KEY` in `~/code/cli-bridge/.env.local` and dispatch via
`passthrough/moonshot/kimi-k2-0905-preview`. cli-bridge's passthrough
backend forwards directly to platform.moonshot.ai with that key.

(Note: keys with `sk-kimi-*` prefix are Tangle-internal aliases, not
Moonshot platform keys. Moonshot platform keys come from
platform.moonshot.ai/console/api-keys and are `sk-*`.)

## Verify

```bash
# Should list claude-code/* and kimi-code/* among others
curl -sS -H "Authorization: Bearer $CLI_BRIDGE_BEARER" \
  http://127.0.0.1:3344/v1/models | python3 -m json.tool | head -30

# Should return a working chat completion (needs Moonshot API key)
curl -sS -H "Authorization: Bearer $CLI_BRIDGE_BEARER" \
     -H "Content-Type: application/json" \
     -X POST http://127.0.0.1:3344/v1/chat/completions \
     -d '{"model":"moonshot/kimi-k2-0905-preview","messages":[{"role":"user","content":"OK"}]}'
```
