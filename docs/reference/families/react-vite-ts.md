# Family: `react-vite-ts`

React and Vite ready TypeScript starter with instant preview shell.

**Taxonomy**: language=typescript · runtime=node · surface=frontend

**Tags**: frontend, typescript, react, vite, preview

## When to use

React single-page app with Vite. Use for client-rich apps without a server surface — dashboards, tools, games, interactive demos.

## First moves

- Install: `pnpm install` then `pnpm dev` (Vite dev server with HMR).
- Brand strings + copy: `src/personalize.json`. Palette: `src/personalize.css`. Both render-time templated; preview updates on next refresh.
- shadcn/ui components under `src/components/ui/`. Import via `@/components/ui/button`. Path alias `@/` → `src/` is configured.
- Build: `pnpm build` outputs to `dist/` — static assets ready for any CDN.

## Gotchas

- No SSR — SEO content must live in `index.html` <head> or be injected post-hydration. Use `nextjs-ts` if SEO is a hard requirement.
- Vite dev server is separate from prod build. Some imports (e.g. CSS-in-JS) work in dev but need explicit config for prod.

## Placeholders (agent MUST replace)

- `src/App.tsx` — Minimal skeleton shell (header + empty main). Replace the main content with the product's primary view — shadcn components + path alias are ready.
- `index.html` — Root HTML with `<div id="app">` and title templated from personalize. Title + meta tags live here; favicon and fonts too if the product needs them.
- `src/personalize.json` — Brand strings — edit for the product but also rewrite src/App.tsx main content.
- `src/personalize.css` — HSL design tokens on :root + .dark. Edit the palette to match the product; Tailwind v4 @theme defaults already compose in.

## Slots

- `auth` — options: auth:none, auth:better-auth, auth:clerk, auth:supabase-auth (default: `auth:none`)
- `payments` — options: payments:none, payments:stripe, payments:coinbase-commerce (default: `payments:none`)
- `sdk` — options: sdk:none, sdk:coinbase-cdp, sdk:solana-web3, sdk:evm-wallet (default: `sdk:none`)

## Routing keywords

- **tier1**: react, vite
- **tier2**: spa, component, single page, client app
- **archetypes**: figma, design tool, collaborative editor, whiteboard, d3 dashboard, d3.js, data visualization, chart app, visualization tool, interactive charts, game, game app, multiplayer game, browser game, trivia app, quiz game, word game, puzzle game, miro, mural +23 more
