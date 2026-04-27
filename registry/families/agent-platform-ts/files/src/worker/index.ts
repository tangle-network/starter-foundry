// Hono entrypoint for the Cloudflare Worker. ONE worker serves:
//   - /api/*   — Hono routes (chat, agents, health, webhooks)
//   - everything else — Vite-built client assets via env.ASSETS (assets binding)
//
// Hard constraint: no Next.js. No edge runtime imports from a framework
// router. Vite + React + Hono only. The only egress to LLMs goes through
// src/worker/lib/chat-bridge.ts (router.tangle.tools).

import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import type { Env, HonoVariables } from './types'
import { agentsRoute } from './routes/agents'
import { chatRoute } from './routes/chat'
import { healthRoute } from './routes/health'
import { webhooksRoute } from './routes/webhooks'

type App = Hono<{ Bindings: Env; Variables: HonoVariables }>

const app: App = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

app.use('*', logger())
app.use('*', secureHeaders())

// Surface a consistent JSON error envelope. Hono's default is text/plain;
// the React client expects JSON for everything under /api.
app.onError((err, c) => {
  const status = (err as { status?: number }).status ?? 500
  return c.json(
    {
      error: err.message || 'internal_error',
      // Stack only in non-production. Cloudflare doesn't set NODE_ENV;
      // we use the presence of a wrangler dev sentinel instead.
      stack: c.env.AUTH_SECRET === 'dev' ? err.stack : undefined,
    },
    status as 400 | 401 | 403 | 404 | 422 | 500,
  )
})

// Mount /api/*
app.route('/api/health', healthRoute)
app.route('/api/agents', agentsRoute)
app.route('/api/chat', chatRoute)
app.route('/api/webhooks', webhooksRoute)

// SPA fallback — every non-/api path goes to the Vite-built static assets.
// The Cloudflare assets binding handles 404 → index.html via
// `not_found_handling: "single-page-application"` in wrangler.jsonc, so we
// just delegate the raw request.
app.get('*', async (c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'not_found' }, 404)
  }
  return c.env.ASSETS.fetch(c.req.raw)
})

export default app
