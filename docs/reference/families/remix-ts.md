# Family: `remix-ts`

Remix TypeScript starter with nested routing, loaders, and actions.

**Taxonomy**: language=typescript · runtime=node · surface=frontend

**Tags**: frontend, typescript, remix, preview

## When to use

Remix for full-stack React with nested routes, loader/action pattern, and progressive enhancement. Prefer when the product has deeply nested route trees or strong form-submission + server-mutation flows.

## First moves

- Install: `pnpm install` then `pnpm dev`. Remix uses file-based routing under `app/routes/` — dot-delimited filenames map to URL segments.
- Loaders (server-only) run before render, actions handle form submits. Do not import server-only libraries into components directly — put them in `.server.ts` files.
- Color palette + brand strings in `app/personalize.css` + `app/personalize.json`.

## Gotchas

- Remix 2.x is the current line; React Router v7 is the next major. Check the remix-run docs version for guide alignment.
- Loaders throw Response objects for redirects/errors, NOT raw throws — `throw redirect(...)` / `throw json(...)` are the patterns.

## Placeholders (agent MUST replace)

- `app/routes/_index.tsx` — Landing page with placeholder hero. Rewrite for the product.
- `app/routes/dashboard.tsx` — Default dashboard route — generic KPI cards. Replace with the product's primary view.
- `app/root.tsx` — Root document shell + meta. Update `<Meta />` generation for SEO.
- `app/personalize.json` — Brand + copy strings. Edit but also rewrite the routes above.

## Slots

- `auth` — options: auth:none, auth:better-auth, auth:clerk, auth:supabase-auth (default: `auth:none`)
- `payments` — options: payments:none, payments:stripe, payments:coinbase-commerce (default: `payments:none`)
- `sdk` — options: sdk:none, sdk:coinbase-cdp, sdk:solana-web3, sdk:evm-wallet (default: `sdk:none`)

## Routing keywords

- **tier1**: remix, remix run, remix app
- **tier2**: loader, action
