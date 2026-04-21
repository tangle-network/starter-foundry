# Capability: `capability:date-utils`

date-fns for date parsing, formatting, arithmetic, and relative time. Tree-shakeable, locale-ready. For any product that displays, schedules, or reasons about dates.

**Applies to**: react-vite-ts, nextjs-ts, fullstack-ts, remix-ts, sveltekit-ts, vue-ts, api-service, cloudflare-worker-ts, bun-http, deno-edge

## When to use

Attach when the product renders, schedules, or reasons about dates. Import from 'date-fns' — the tree-shakeable per-function API keeps bundle size down.

## Shipped deps

- `date-fns`: ^4.1.0

## First moves

- import { format, formatDistanceToNow, addDays } from 'date-fns'
- Pick locale on demand via 'date-fns/locale/en-US' (etc.) for i18n
