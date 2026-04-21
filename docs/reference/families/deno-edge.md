# Family: `deno-edge`

Deno runtime HTTP API starter using Deno.serve — zero-transpile TS, secure-by-default permissions, Deno Deploy-compatible.

**Taxonomy**: language=typescript · runtime=deno · surface=api

**Tags**: deno, api, backend, typescript, edge

## When to use

Deno runtime HTTP server. Secure-by-default (explicit permissions), zero-transpile TS, Deno Deploy-compatible. Use when the prompt calls for Deno specifically or for edge-runtime compatibility.

## First moves

- Run the dev server with `deno task dev` — NOT `pnpm dev` (no package.json here). Tasks live in deno.json.
- Install deps by importing from URLs (https://deno.land/x/...) OR npm: specifiers (`import express from "npm:express"`). There is NO `node_modules` unless you opt in.
- Tests: `deno task test`. Use the built-in `Deno.test` API. Do NOT add vitest/jest.
- Extend `src/handlers.ts` — add routes to the `routes` map.
- Env vars: `Deno.env.get('FOO')`, NOT `process.env.FOO`. Requires `--allow-env` permission.

## Gotchas

- Deno runs with deny-by-default permissions. `--allow-net --allow-env --allow-read` are already in deno.json tasks — add more only if the handler needs them.
- npm: specifiers work but some Node libs assume `process.env` / `Buffer` / `__dirname`. Use Deno's `std/` modules first.
- Deno Deploy has a 50MB deployment limit + no filesystem writes. Use Deno KV for state, not SQLite.

## Placeholders (agent MUST replace)

- `src/handlers.ts` — Default routes map with just `/health`. Add the product's endpoints here — handlers are `(Request) => Response`.

## Slots

- `database` — options: database:sqlite, database:postgres, database:mongodb, database:convex (default: `database:sqlite`)
- `auth` — options: auth:none, auth:better-auth, auth:clerk (default: `auth:none`)
- `payments` — options: payments:none, payments:stripe (default: `payments:none`)
- `queue` — options: queue:none, queue:bullmq, queue:trigger-dev (default: `queue:none`)

## Routing keywords

- **tier1**: deno, deno.serve, deno runtime, deno deploy
- **tier2**: deno edge, deno api
