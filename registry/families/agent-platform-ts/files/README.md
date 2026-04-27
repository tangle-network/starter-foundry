# {{agentName}} — agent-platform-ts

A **multi-tenant single-Cloudflare-Worker platform** for hosting agent
markdown packs. ONE worker serves both the Vite + React admin UI and the
Hono `/api/*` routes. Loads packs from disk, exposes `/api/chat/:agent`,
handles tenant auth, rate-limiting, and an audit log.

**Stack**: Vite + React + Hono + Cloudflare Workers + KV + Tangle SDK +
TCloud + `router.tangle.tools`. **Not Next.js.** No `app/` directory, no
`pages/`, no `next.config.*` — by design.

## Architecture

```
                 ┌────────────────────────────────────────┐
   request ───▶  │   Cloudflare Worker (src/worker/index.ts)  │
                 │                                            │
                 │   Hono router                              │
                 │     /api/health      → routes/health.ts    │
                 │     /api/agents      → routes/agents.ts    │
                 │     /api/chat/:agent → routes/chat.ts      │
                 │     /api/webhooks/*  → routes/webhooks.ts  │
                 │                                            │
                 │   * fallback         → env.ASSETS.fetch()  │
                 │                        (Vite-built client) │
                 └────────────────────────────────────────┘
                           │
                           ▼
                  router.tangle.tools     ← single egress
                  (chat-bridge.ts is the
                  ONLY fetch() to LLMs)
```

## Quickstart

```bash
pnpm install
cp .env.example .env
# edit .env to set TANGLE_ROUTER_KEY + AUTH_SECRET
pnpm dev          # runs vite (5173) + wrangler dev (8787) concurrently
```

Then visit `http://localhost:5173/admin`.

## Deploying

```bash
wrangler kv:namespace create AUDIT
wrangler kv:namespace create RATE_LIMIT
# paste the namespace ids into wrangler.jsonc

wrangler secret put TANGLE_ROUTER_KEY
wrangler secret put AUTH_SECRET
wrangler secret put WEBHOOK_HMAC_SECRET    # only if you enable /api/webhooks

pnpm build       # tsc + vite build → dist/client/
wrangler deploy  # uploads worker + dist/client/ in one bundle
```

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for the full runbook.

## Adding agent packs

Each agent pack is a directory under `./agents/`:

```
agents/
  support-bot/
    system-prompt.md            # frontmatter: name, description, tags, model
    methodology/
      index.json                # ordered guides (validated by zod)
      escalation.md
      tone.md
```

Then register the pack in `src/worker/lib/load-agent-pack.ts`:

```ts
import sysPrompt from '../../../agents/support-bot/system-prompt.md?raw'
import method from '../../../agents/support-bot/methodology/index.json'
registerPack('support-bot', { systemPrompt: sysPrompt, methodology: method, meta: {} })
```

`POST /api/chat/support-bot` is now live. Auto-discovery is intentionally
NOT supported — Cloudflare Workers have no filesystem, and explicit
registration makes the deployed bundle auditable (you know exactly which
packs are reachable).

## Multi-tenancy

The platform IS the gateway. Tenant resolution happens at the auth layer
in `src/worker/lib/auth.ts` — the placeholder verifies an HMAC-signed
session token and stamps `c.var.tenant` with `tenantId`, `quota`, and an
optional `packDir` override. Replace the placeholder with your real auth
provider (NextAuth-style JWT, Better-Auth, Clerk, Supabase-Auth — pick
one and wire it). See [docs/MULTI-TENANCY.md](./docs/MULTI-TENANCY.md).

## Single egress

Every LLM call goes through `src/worker/lib/chat-bridge.ts` →
`router.tangle.tools`. No other file in the worker bundle is permitted to
`fetch()` an LLM endpoint; that invariant is what lets the SECURITY model
make per-tenant cost-tracking, prompt-injection-defense, and observability
claims at all. See [docs/SECURITY.md](./docs/SECURITY.md).

## What's NOT in scope

- **The agent runtimes themselves** — those are separate `agent-runtime-*`
  bundles. The platform hosts their *packs* (system prompts +
  methodology) and orchestrates per-tenant invocations; the runtime code
  ships separately.
- **A general-purpose CMS** — packs are markdown-on-disk, not a database.
  Add D1 + a `pack-registry` table if you need that.
- **Production-grade auth** — `auth.ts` is a placeholder. Wire your real
  provider before going live.
