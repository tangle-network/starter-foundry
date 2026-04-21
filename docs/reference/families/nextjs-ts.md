# Family: `nextjs-ts`

Next.js ready TypeScript starter with instant preview shell.

**Taxonomy**: language=typescript · runtime=node · surface=frontend

**Tags**: frontend, typescript, nextjs, preview

## When to use

Next.js App Router for full-stack React products that need SEO, server-rendered routes, and a Node backend surface in one project. Chooses server-components by default; opt out per-route with `use client`.

## First moves

- Install: `pnpm install` then `pnpm dev`. Next 16.x uses the App Router — files under `app/` are routes, files under `components/` are imported.
- Brand strings live in `personalize.json` (at repo root OR src/). Compose writes it as the single source of truth — edit once, HMR picks up.
- Color palette + Tailwind tokens live in `src/personalize.css` / `app/personalize.css`. Edit HSL custom properties on `:root` + `.dark`; Tailwind v4 `@theme` defaults already compose in.
- shadcn/ui components pre-installed under `src/components/ui/` — import from `@/components/ui/button`, etc. Path alias `@/` → `src/`.

## Gotchas

- App Router is default. If you find yourself writing a pages/ directory, stop — you're in the wrong mental model for this scaffold.
- Server Components are the default — every component is SSR unless marked `'use client'`. If a component uses hooks or browser APIs, add the directive at the top.

## Placeholders (agent MUST replace)

- `app/dashboard/page.tsx` — Default renders generic KPI cards (Total Revenue $45k, Active Users 2,350, etc.). Replace with the product's primary dashboard view — remove KPI cards that don't apply, add ones that do.
- `app/admin/page.tsx` — Default renders a generic user table. Replace with the product's admin/management surface, or delete the route if no admin surface is needed.
- `app/page.tsx` — Landing / root page with placeholder hero copy. Rewrite the hero content for the product; keep layout shell.
- `app/layout.tsx` — Root layout + metadata. Update `metadata.title` and `metadata.description` for SEO — and review whether the default `<body>` structure fits the product.
- `personalize.json` — Brand strings (name, tagline, hero headline/subheadline). Edit for the product — but this is NOT a substitute for rewriting the placeholders above.

## Slots

- `auth` — options: auth:none, auth:better-auth, auth:clerk, auth:supabase-auth (default: `auth:none`)
- `payments` — options: payments:none, payments:stripe, payments:coinbase-commerce (default: `payments:none`)
- `sdk` — options: sdk:none, sdk:coinbase-cdp, sdk:solana-web3, sdk:evm-wallet (default: `sdk:none`)

## Routing keywords

- **tier1**: next.js, nextjs
- **tier2**: next, app router, server action, seo app
- **archetypes**: instagram, pinterest, photo sharing, image sharing, youtube, video platform, streaming platform, twitch, tiktok, short video, reels, notion, note taking, knowledge management, wiki, docs platform, google docs, collaborative document, rich text editor, shopify +107 more
