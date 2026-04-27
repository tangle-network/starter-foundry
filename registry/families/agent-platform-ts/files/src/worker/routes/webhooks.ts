// POST /api/webhooks/:event — HMAC-verified inbound webhooks.
//
// Pattern lifted from agent-base:secure (webhook-in.ts):
//   - 5-min replay window via signed timestamp
//   - case-insensitive header lookup (Hono normalizes; explicit anyway)
//   - timing-safe HMAC compare via Web Crypto subtle
//   - schema validation runs AFTER MAC verify (don't waste cycles on
//     unauthenticated payloads)
//
// Operators register handlers by editing the WEBHOOK_HANDLERS map below.
// The default registry is empty — every webhook needs an explicit handler
// so the route can't accept traffic the operator didn't opt into.

import { Hono } from 'hono'
import type { Env, HonoVariables } from '../types'
import { audit } from '../lib/audit'

export const webhooksRoute = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

const SIGNATURE_HEADER = 'x-tangle-signature'
const TIMESTAMP_HEADER = 'x-tangle-timestamp'
const SENDER_HEADER = 'x-tangle-sender'
const REPLAY_WINDOW_MS = 5 * 60_000

interface WebhookHandler {
  schema?: (body: unknown) => string | null
  handle: (
    body: unknown,
    ctx: { sender: string; receivedAt: number; env: Env },
  ) => Promise<void> | void
}

// Operator-edited registry. Empty by default; the route returns 404
// for any event with no registered handler.
const WEBHOOK_HANDLERS = new Map<string, WebhookHandler>()

export function defineWebhook(event: string, handler: WebhookHandler): void {
  if (WEBHOOK_HANDLERS.has(event)) {
    throw new Error(`webhook already defined: ${event}`)
  }
  WEBHOOK_HANDLERS.set(event, handler)
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

webhooksRoute.post('/:event', async (c) => {
  const env = c.env
  const event = c.req.param('event')
  const handler = WEBHOOK_HANDLERS.get(event)
  if (!handler) {
    return c.json({ error: 'no_handler' }, 404)
  }
  if (!env.WEBHOOK_HMAC_SECRET) {
    await audit(env, {
      event: 'webhook.in.reject',
      tenantId: null,
      agentId: null,
      payload: { event, reason: 'no-secret-configured' },
    })
    return c.json({ error: 'webhook_secret_not_configured' }, 503)
  }

  const sig = c.req.header(SIGNATURE_HEADER) ?? ''
  const tsHeader = c.req.header(TIMESTAMP_HEADER) ?? ''
  const sender = c.req.header(SENDER_HEADER) ?? 'unknown'

  if (!sig || !tsHeader) {
    await audit(env, {
      event: 'webhook.in.reject',
      tenantId: null,
      agentId: null,
      payload: { event, reason: 'missing-headers' },
    })
    return c.json({ error: 'missing_signature' }, 401)
  }
  const ts = Number(tsHeader)
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
    await audit(env, {
      event: 'webhook.in.reject',
      tenantId: null,
      agentId: null,
      payload: { event, reason: 'replay-window', tsHeader },
    })
    return c.json({ error: 'timestamp_outside_window' }, 401)
  }

  const rawBody = await c.req.text()
  const expected = await hmacHex(env.WEBHOOK_HMAC_SECRET, `${tsHeader}.${rawBody}`)
  if (!timingSafeEqualHex(sig, expected)) {
    await audit(env, {
      event: 'webhook.in.reject',
      tenantId: null,
      agentId: null,
      payload: { event, reason: 'signature-mismatch', sender },
    })
    return c.json({ error: 'signature_mismatch' }, 401)
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    await audit(env, {
      event: 'webhook.in.reject',
      tenantId: null,
      agentId: null,
      payload: { event, reason: 'invalid-json' },
    })
    return c.json({ error: 'invalid_json' }, 400)
  }

  if (handler.schema) {
    const schemaErr = handler.schema(body)
    if (schemaErr) {
      await audit(env, {
        event: 'webhook.in.reject',
        tenantId: null,
        agentId: null,
        payload: { event, reason: 'schema', error: schemaErr.slice(0, 200) },
      })
      return c.json({ error: 'schema_error', detail: schemaErr }, 422)
    }
  }

  await audit(env, {
    event: 'webhook.in.accept',
    tenantId: null,
    agentId: null,
    payload: { event, sender, bytes: rawBody.length },
  })
  try {
    await handler.handle(body, { sender, receivedAt: Date.now(), env })
    return c.json({ ok: true })
  } catch (err) {
    await audit(env, {
      event: 'webhook.in.handler-error',
      tenantId: null,
      agentId: null,
      payload: { event, error: (err as Error).message.slice(0, 200) },
    })
    return c.json({ error: 'handler_error' }, 500)
  }
})
