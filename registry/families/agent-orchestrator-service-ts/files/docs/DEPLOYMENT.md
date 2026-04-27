# Deployment

The same `src/index.ts` runs on Bun, Node, and Cloudflare Workers. Pick the
runtime that matches your operational shape.

## Node (long-running server)

```bash
pnpm install
pnpm build              # tsc → dist/
NODE_ENV=production node --import tsx dist/index.js
# or for dev:
pnpm dev                # tsx watch
```

Use Node when you want a regular HTTP server, sticky in-memory state, or
local filesystem access for `AGENT_PACK_DIR`.

## Bun

```bash
bun install
bun run src/index.ts
```

Bun is ~3x faster on cold start than Node. Same code, no changes — Hono's
fetch-handler shape works identically.

## Cloudflare Workers

```bash
pnpm install
pnpm deploy:cf          # wraps `wrangler deploy`
```

CF Workers gives you global edge + zero-config TLS but loses two things:

1. **No persistent filesystem.** `AGENT_PACK_DIR` cannot point at local disk.
   You have two options:
   - Bundle packs into the worker at build time (Wrangler `[[rules]]` to
     pull `*.md` and `agent-roster.json` into the Worker bundle).
   - Replace `agent-loader.ts`'s `readFile` with a fetch-from-manifest-URL
     loader. The interface is small — `loadPack(packDir, packId)` and
     `listPackIds(packDir)` are the only seams.

2. **No long-running connections.** Streaming `/chat` works (Workers
   supports response streaming) but the request-bound CPU budget is
   capped. Long generations may hit limits — bump to a paid plan with
   `unbound` if you need >30s wall clock.

### Setting secrets on Workers

```bash
wrangler secret put TANGLE_ROUTER_KEY
wrangler secret put ORCHESTRATOR_API_KEYS
wrangler secret put WEBHOOK_HMAC_SECRET
```

`AGENT_PACK_DIR` and other non-secret config goes in `wrangler.jsonc`'s
`vars` block.

### Multi-region notes

The in-memory rate limiter (`src/lib/rate-limit.ts`) is per-instance. On
Workers you get one instance per region. To enforce a global rate limit,
swap the store for a Durable Object or Redis-backed equivalent. The
upgrade is one file change — see the comment block at the top of
`rate-limit.ts`.

## Audit log

Default sink is `./.audit/orchestrator.ndjson` (newline-delimited JSON).
For production:

- Node/Bun: ship `.audit/` to S3 via a sidecar (Vector, Fluentd, etc.) OR
  swap `audit.ts`'s `appendFile` for an S3 client.
- Workers: filesystem isn't available — replace `audit.ts` with a fetch
  to an external log endpoint (e.g. Logflare, Axiom, your own collector).

## Health checks

Point your load balancer at `GET /health` (unauthenticated). It returns
200 when `AGENT_PACK_DIR` is readable; 503 otherwise. Use the returned
`agents` count to alert if pack discovery degrades.
