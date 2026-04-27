# {{serviceName}}

Headless backend that orchestrates a fleet of AI agents from markdown packs.
API-only. No dashboard. Built on Hono — runs on Bun, Node, or Cloudflare
Workers without code changes.

## Why this exists

You have a Slack bot, a CLI, or a custom frontend. You want to drop in a
fleet of AI agents — different personas, different system prompts, maybe
even multi-agent teams — without building the orchestration yourself.

This service:

- Loads agent packs from `AGENT_PACK_DIR` (single agents OR multi-agent teams)
- Routes incoming `/chat` requests to the right role
- Streams responses through `router.tangle.tools` (single egress)
- Audits every accept/reject and rate-limits per tenant API key

For the dashboarded sister service, see `agent-platform-ts`. For a
single-agent app with chat UI, see `agent-with-ui-ts`.

## Quickstart

```bash
pnpm install
cp .env.example .env

# Mandatory
export TANGLE_ROUTER_KEY=<your router.tangle.tools key>
export ORCHESTRATOR_API_KEYS=dev-key-rotate-me

# Drop a pack
mkdir -p ./agent-packs/support
cat > ./agent-packs/support/system-prompt.md <<'EOF'
You are a customer support agent. Be concise. Cite docs by URL.
EOF

pnpm dev
```

```bash
curl -s http://localhost:4196/health
# → {"status":"ok","service":"...","agents":1,"version":"0.1.0"}

curl -s http://localhost:4196/agents -H 'x-api-key: dev-key-rotate-me'
# → {"agents":[{"id":"support","kind":"single"}]}

curl -s http://localhost:4196/chat \
  -H 'x-api-key: dev-key-rotate-me' \
  -H 'content-type: application/json' \
  -d '{"agent":"support","messages":[{"role":"user","content":"my deploy is stuck"}]}'
```

## Agent pack shapes

### Single agent

```
agent-packs/<id>/
  system-prompt.md
```

### Multi-agent team

```
agent-packs/<id>/
  agent-roster.json
  frontline.md
  engineering.md
```

`agent-roster.json`:

```json
{
  "description": "Two-tier support team",
  "defaultRespondent": "frontline",
  "roles": [
    { "id": "frontline", "systemPrompt": "frontline.md", "description": "Tier 1 triage" },
    { "id": "engineering", "systemPrompt": "engineering.md", "description": "Tier 2 deep debug" }
  ]
}
```

If `defaultRespondent` is omitted, the orchestrator runs a cheap LLM
routing call to pick the best role for each turn. See `docs/ROUTING.md`.

## Endpoints

| Method | Path             | Auth      | Purpose                             |
| ------ | ---------------- | --------- | ----------------------------------- |
| GET    | `/health`        | none      | Liveness + agent-pack count         |
| GET    | `/agents`        | API key   | List available agents               |
| GET    | `/agents/:id`    | API key   | Inspect one pack                    |
| POST   | `/chat`          | API key   | Run a chat turn (JSON or SSE)       |
| POST   | `/webhooks/:event` | HMAC + API key | Inbound HMAC-signed webhooks |

## Deployment

See `docs/DEPLOYMENT.md` for Bun, Node, and Cloudflare Workers paths.

## Security

See `docs/SECURITY.md`. Skim it before exposing this on the public internet —
the API-key auth is a starter, not a finish line.

## Extending

- Add a route under `src/routes/` and `app.route(...)` it from `src/index.ts`.
- Swap the audit sink in `src/lib/audit.ts` for S3/Postgres in production.
- Swap the rate-limit store in `src/lib/rate-limit.ts` for Redis if you run
  more than one instance.
- DO NOT add `fetch()` calls to LLM endpoints outside `src/lib/chat-bridge.ts`
  — that's the single egress invariant. See `docs/SECURITY.md`.
