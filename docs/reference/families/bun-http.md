# Family: `bun-http`

Bun HTTP API starter using Bun.serve() — zero-transpile TS, native Bun runtime, instant cold start.

**Taxonomy**: language=typescript · runtime=bun · surface=api

**Tags**: bun, api, backend, typescript

## When to use

Bun-native HTTP server. Measurably faster cold-start + throughput than Node for small APIs.

## First moves

- Install deps with `bun install` — NOT `pnpm install`. Bun has its own lockfile (bun.lockb) and resolution.
- Run the dev server with `bun run dev` (hot-reload via --watch). Don't use nodemon / tsx / ts-node — Bun runs TypeScript directly.
- Tests use Bun's built-in runner: `bun test`. Do NOT add vitest/jest — Bun's runner is Jest-API-compatible and ships zero-config.
- Extend `src/handlers.ts` — add new routes to the `routes` map. Handlers are Request → Response; Bun.serve invokes them per request.
- Env vars: `process.env` OR `Bun.env` (both work). `.env` files auto-load under `bun run`.

## Gotchas

- Do NOT run `pnpm add` / `npm install` to add deps. Use `bun add <pkg>`. Mixing package managers corrupts node_modules symlink resolution.
- TypeScript types are auto-stripped — no tsc step. If CI needs real type-checking, add `bun tsc --noEmit` explicitly.
- Bun's Node compat layer is not 100% — cluster/worker_threads/fs-native APIs that wrap libuv primitives may differ.

## Placeholders (agent MUST replace)

- `src/handlers.ts` — Default routes map with just `/health`. Add the product's endpoints here — each route is `(Request) => Response | Promise<Response>`.

## Slots

- `database` — options: database:sqlite, database:postgres, database:mongodb, database:convex (default: `database:sqlite`)
- `auth` — options: auth:none, auth:better-auth, auth:clerk (default: `auth:none`)
- `payments` — options: payments:none, payments:stripe (default: `payments:none`)
- `queue` — options: queue:none, queue:bullmq, queue:trigger-dev (default: `queue:none`)

## Routing keywords

- **tier1**: bun, bun.serve, bun runtime
- **tier2**: bun api, bun http, bun.js
