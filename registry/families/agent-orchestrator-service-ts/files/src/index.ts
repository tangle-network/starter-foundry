// Hono entrypoint. Same module runs on Bun, Node, and Cloudflare Workers
// — we export the `app` object for Workers (default export contract) and
// boot a Node server when run directly.

import { Hono } from 'hono'
import { buildAgentsRoute } from './routes/agents.js'
import { buildChatRoute } from './routes/chat.js'
import { buildHealthRoute } from './routes/health.js'
import { buildWebhookRoute } from './routes/webhooks.js'
import { audit, fingerprintKey } from './lib/audit.js'
import { rateLimitFor } from './lib/rate-limit.js'

const SERVICE_NAME = process.env['SERVICE_NAME'] ?? '{{serviceName}}'
const VERSION = process.env['SERVICE_VERSION'] ?? '0.1.0'
const PACK_DIR = process.env['AGENT_PACK_DIR'] ?? './agent-packs'
const DEFAULT_MODEL = process.env['ORCHESTRATOR_DEFAULT_MODEL'] ?? 'anthropic/claude-sonnet-4-7'
const HMAC_SECRET = process.env['WEBHOOK_HMAC_SECRET'] ?? ''

function parseApiKeys(): Set<string> {
  const raw = process.env['ORCHESTRATOR_API_KEYS'] ?? ''
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  )
}

const apiKeys = parseApiKeys()

export const app = new Hono()

// --- Auth + rate-limit middleware. Order matters: auth first (so an
// unauthenticated caller can't burn a rate-limit slot), THEN rate-limit
// (so authenticated callers get their own bucket). /health bypasses both.
app.use('*', async (c, next) => {
  const path = c.req.path
  if (path === '/health' || path.startsWith('/health/')) {
    return next()
  }

  const apiKey = c.req.header('x-api-key') ?? ''
  if (apiKeys.size === 0) {
    await audit.log({
      event: 'auth.misconfigured',
      payload: { reason: 'no-api-keys-configured', path },
    })
    return c.json(
      { error: 'orchestrator misconfigured: ORCHESTRATOR_API_KEYS empty' },
      503,
    )
  }
  if (!apiKey || !apiKeys.has(apiKey)) {
    await audit.log({
      event: 'auth.reject',
      payload: { reason: apiKey ? 'unknown-key' : 'missing-key', path },
    })
    return c.json({ error: 'unauthorized' }, 401)
  }
  const tenantFingerprint = await fingerprintKey(apiKey)
  c.set('tenantFingerprint', tenantFingerprint)

  // Webhooks have their own auth (HMAC) so we exempt them from API-key
  // rate-limit — but we still require the API-key check above so the
  // webhook is double-gated (HMAC + tenant key).
  if (path.startsWith('/webhooks')) {
    return next()
  }

  const rl = rateLimitFor(tenantFingerprint)
  c.header('x-rate-limit-remaining', String(rl.remaining))
  if (!rl.allowed) {
    c.header('retry-after', String(rl.retryAfterSec))
    await audit.log({
      event: 'rate-limit.exceeded',
      tenantFingerprint,
      payload: { path, retryAfterSec: rl.retryAfterSec },
    })
    return c.json({ error: 'rate limit exceeded', retryAfterSec: rl.retryAfterSec }, 429)
  }
  return next()
})

app.route('/health', buildHealthRoute({ packDir: PACK_DIR, serviceName: SERVICE_NAME, version: VERSION }))
app.route('/agents', buildAgentsRoute({ packDir: PACK_DIR }))
app.route('/chat', buildChatRoute({ packDir: PACK_DIR, defaultModel: DEFAULT_MODEL }))
app.route('/webhooks', buildWebhookRoute({ hmacSecret: HMAC_SECRET }))

app.notFound((c) => c.json({ error: 'not found', path: c.req.path }, 404))
app.onError(async (err, c) => {
  await audit.log({
    event: 'unhandled.error',
    payload: { path: c.req.path, error: err.message.slice(0, 500) },
  })
  return c.json({ error: 'internal error' }, 500)
})

export default app

// --- Node entrypoint. CF Workers ignores everything below — it only
// imports the `app` default export. Detect "is this Node and was this
// file run directly" before booting the HTTP server.
const isNodeRuntime =
  typeof process !== 'undefined' &&
  typeof process.versions?.node === 'string' &&
  // Workers also exposes process.versions.node via nodejs_compat — but it
  // won't have import.meta.url === process.argv[1].
  process.argv?.[1] !== undefined

if (isNodeRuntime) {
  const isMain = (() => {
    try {
      const mainUrl = new URL(`file://${process.argv[1]}`).href
      return import.meta.url === mainUrl
    } catch {
      return false
    }
  })()
  if (isMain) {
    const port = Number(process.env['PORT'] ?? 4196)
    // Lazy import so the default export above stays Workers-compatible.
    const { serve } = await import('@hono/node-server')
    serve({ fetch: app.fetch, port }, (info) => {
      // eslint-disable-next-line no-console
      console.log(`[${SERVICE_NAME}] listening on :${info.port} (packs=${PACK_DIR})`)
    })
  }
}
