# Deployment runbook

## One-time setup

```bash
# Create KV namespaces — paste IDs into wrangler.jsonc
wrangler kv:namespace create AUDIT
wrangler kv:namespace create RATE_LIMIT

# Required secrets
wrangler secret put TANGLE_ROUTER_KEY      # router.tangle.tools API key
wrangler secret put AUTH_SECRET             # 32-byte random hex
wrangler secret put WEBHOOK_HMAC_SECRET     # only if /api/webhooks/* is enabled
```

## Per-deploy

```bash
pnpm install
pnpm build           # tsc -b && vite build → dist/client/
wrangler deploy      # uploads worker + dist/client/ assets in one bundle
```

A successful deploy serves `https://<worker-name>.<account>.workers.dev/`
with the React admin UI, and `/api/*` routes off the same origin.

## Adding agent packs

Packs are statically registered in `src/worker/lib/load-agent-pack.ts`.
There is no runtime auto-discovery — Cloudflare Workers don't have a
filesystem, and explicit registration is part of the auditable bundle.

To add `support-bot`:

1. `mkdir -p agents/support-bot/methodology`
2. Write `agents/support-bot/system-prompt.md` with frontmatter:
   ```
   ---
   name: "Support Bot"
   description: "Tier-1 customer support."
   tags: [support, tier-1]
   model: gpt-4o-mini
   ---
   You are a tier-1 support agent...
   ```
3. Write `agents/support-bot/methodology/index.json`:
   ```json
   {
     "version": 1,
     "guides": [
       { "slug": "escalation", "title": "Escalation rules", "summary": "...", "path": "escalation.md" }
     ]
   }
   ```
4. Wire it in `src/worker/lib/load-agent-pack.ts`:
   ```ts
   import sysPrompt from '../../../agents/support-bot/system-prompt.md?raw'
   import method from '../../../agents/support-bot/methodology/index.json'
   registerPack('support-bot', {
     systemPrompt: sysPrompt,
     methodology: method,
     meta: {},
   })
   ```
5. `pnpm build && wrangler deploy`

## Custom domain

```bash
wrangler route add 'platform.example.com/*' <worker-name>
```

Or wire via the dashboard: Workers & Pages → Settings → Triggers → Custom Domains.

## Rolling back

```bash
wrangler deployments list
wrangler rollback <deployment-id>
```

## Observability

- `console.log` from the worker streams to `wrangler tail`
- Audit entries land in the `AUDIT` KV namespace under `audit:YYYY-MM-DD:<seq>:<ts>`
- Cloudflare Analytics surfaces request counts, error rates, p50/p95/p99
- For production retention, **forward audit entries off Cloudflare KV** —
  see [docs/SECURITY.md](./SECURITY.md). KV's eventual consistency +
  expiration TTL makes it unsuitable as a system-of-record sink.
