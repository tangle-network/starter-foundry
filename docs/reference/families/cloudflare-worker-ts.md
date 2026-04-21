# Family: `cloudflare-worker-ts`

Minimal Cloudflare Worker TypeScript starter.

**Taxonomy**: language=typescript · runtime=workerd · surface=edge-api

**Tags**: edge, cloudflare, typescript

## Slots

- `database` — options: database:sqlite, database:postgres, database:mongodb, database:convex (default: `database:sqlite`)
- `sdk` — options: sdk:none, sdk:coinbase-cdp, sdk:solana-web3, sdk:evm-wallet (default: `sdk:none`)
- `auth` — options: auth:none, auth:better-auth, auth:clerk, auth:supabase-auth (default: `auth:none`)
- `payments` — options: payments:none, payments:stripe, payments:coinbase-commerce (default: `payments:none`)
- `queue` — options: queue:none, queue:bullmq, queue:trigger-dev (default: `queue:none`)

## Routing keywords

- **tier1**: cloudflare, hono edge
- **tier2**: durable object, edge api, edge function, workerd
