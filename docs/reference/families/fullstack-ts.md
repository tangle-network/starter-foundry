# Family: `fullstack-ts`

Lean fullstack TypeScript starter with live preview and API path.

**Taxonomy**: language=typescript · runtime=node · surface=fullstack

**Tags**: fullstack, typescript, preview, api

## When to use

Node-backed fullstack with a React frontend bundled together. Use when the product needs tight frontend/backend coupling but NOT a framework like Next or Remix.

## First moves

- Install: `pnpm install` then `pnpm dev` — starts the Node server (src/server.ts) with experimental TS strip + watch.
- Brand strings: `src/personalize.json`. Palette: `src/personalize.css`.
- API handlers extend `src/server.ts`. Client components under `src/components/`.

## Placeholders (agent MUST replace)

- `src/App.tsx` — Default React landing with generic hero + KPI cards. Replace with the product's primary view.
- `src/server.ts` — Default Node server with `/health` + a stub API route. Add the product's real endpoints; keep /health for the preview liveness check.
- `src/personalize.json` — Brand strings — edit but also rewrite App.tsx content.

## Slots

- `database` — options: database:sqlite, database:postgres, database:mongodb, database:convex (default: `database:sqlite`)
- `sdk` — options: sdk:none, sdk:coinbase-cdp, sdk:solana-web3, sdk:evm-wallet (default: `sdk:none`)
- `auth` — options: auth:none, auth:better-auth, auth:clerk, auth:supabase-auth (default: `auth:none`)
- `payments` — options: payments:none, payments:stripe, payments:coinbase-commerce (default: `payments:none`)
- `queue` — options: queue:none, queue:bullmq, queue:trigger-dev (default: `queue:none`)

## Routing keywords

- **tier1**: invite members
- **tier2**: fullstack, full stack, dashboard with api, app with api, admin app, database-backed, dashboard and api, saas, saas app, saas platform, internal tool, admin panel, back office, crud app, agent dashboard, agent monitoring, monitoring dashboard, sign up, create teams, user accounts +6 more
- **archetypes**: twitter, x clone, social network, social media, mastodon, threads clone, social app, reddit, forum, community platform, discussion board, hacker news, linear, jira, project management, issue tracker, task manager, kanban, slack clone, discord clone +197 more
