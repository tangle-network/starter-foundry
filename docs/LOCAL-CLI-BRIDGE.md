# Local cli-bridge — wiring starter-foundry's self-heal loop end-to-end

The self-heal proposer (`scripts/self-heal.mjs --dispatch`) and the
DSPy-RLM pr-reviewer both dispatch agentic work through `tcloud.bridge`
on top of `@tangle-network/tcloud`. By default that goes through the
shared cli-bridge inside `router.tangle.tools`. For local development
— or whenever the prod bridge isn't deployed with the latest code —
you can run cli-bridge on `localhost` and have tcloud's BYOB headers
route the request to your box instead.

## TL;DR

```bash
# 1. one-shot setup (generates .env.local, prints next steps)
node scripts/setup-local-cli-bridge.mjs

# 2. start the server in its own terminal/tmux pane
cd ~/code/cli-bridge && export $(grep -v '^#' .env.local | xargs) && pnpm exec tsx src/server.ts

# 3. in your starter-foundry shell:
export CLI_BRIDGE_URL=http://127.0.0.1:8787
export CLI_BRIDGE_BEARER=<value from .env.local>
export TCLOUD_API_KEY=sk-tan-...   # for the tcloud SDK envelope
export BRIDGE_UNLOCK=...            # router-side unlock token
node scripts/self-heal.mjs --dispatch --top 1
```

## Architecture

```
   self-heal.mjs / pr-reviewer
                 │
                 ▼
       tcloud.bridge({...})           ← @tangle-network/tcloud@^0.4.0
                 │
                 ▼
   router.tangle.tools/api/chat       ← gates on BRIDGE_UNLOCK
                 │
                 ▼
        cli-bridge                    ← SHARED (prod) or LOCAL (BYOB)
                 │
                 ▼
   claude / kimi / codex CLI          ← uses your auth on this box
```

`CLI_BRIDGE_URL` + `CLI_BRIDGE_BEARER` env vars in starter-foundry
(read by `src/lib/bridge.ts`) get forwarded as `X-Bridge-Url` +
`X-Bridge-Bearer` headers via tcloud, telling the router to forward
to your local cli-bridge instead of the shared one. The router still
applies billing/observability on the way through — only execution
location changes.

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
  http://127.0.0.1:8787/v1/models | python3 -m json.tool | head -30

# Should return a working chat completion (needs Moonshot API key)
curl -sS -H "Authorization: Bearer $CLI_BRIDGE_BEARER" \
     -H "Content-Type: application/json" \
     -X POST http://127.0.0.1:8787/v1/chat/completions \
     -d '{"model":"moonshot/kimi-k2-0905-preview","messages":[{"role":"user","content":"OK"}]}'
```
