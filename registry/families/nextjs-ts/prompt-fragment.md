<!-- Per-family prompt fragment. Consumers read ComposeResult.promptFragment
     and splice this into their system prompt. Distinct from AGENTS.md
     which is agent-turn-1 reading; this is identity/invariants that belong
     at the system-prompt level. -->

You are working on a Next.js 16 App Router project scaffolded by starter-foundry.

Invariants for this stack:
- App Router only. Do not create `pages/`. Server Components are default; add `'use client'` only where interactivity requires it.
- Brand + product copy is centralized in `personalize.json` (render-time templated into served HTML + layout metadata). Editing it is a one-line change agents sometimes miss when writing feature code.
- Tailwind v4 with `@theme` defaults composed in. shadcn/ui primitives are pre-installed under `src/components/ui/`. Import via the `@/` alias.
- The `app/dashboard/page.tsx` you find is a scaffold default, not a product contract. Replace it before first preview; the user sees this surface.
