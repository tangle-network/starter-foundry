// POST /webhooks/:event — HMAC-SHA256 verified inbound webhooks.
//
// Mirrors the pattern from registry/layers/agent-base/secure/files/lib/secure/webhook-in.ts:
//   - Case-insensitive header lookup (Hono lowercases; passthroughs may not).
//   - 5-minute replay window via X-Tangle-Timestamp.
//   - Timing-safe HMAC compare.
//   - Loud rejection on every failure mode; nothing silent.
//
// What this file does NOT have:
//   - Per-webhook secret rotation (one shared HMAC secret in env).
//   - A nonce/replay table — the 5-minute window is the only replay defense.
//   - Async dispatch (handlers run inline in the request).
//
// Caveats are documented in docs/SECURITY.md. Reuse the agent-base/secure
// layer if you need the full feature set; this is the orchestrator's
// minimal honest implementation.

import { Hono } from 'hono'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { audit } from '../lib/audit.js'
import { WebhookPathSchema } from '../schema.js'

const SIGNATURE_HEADER = 'x-tangle-signature'
const TIMESTAMP_HEADER = 'x-tangle-timestamp'
const SENDER_HEADER = 'x-tangle-sender'
const REPLAY_WINDOW_MS = 5 * 60_000

function lowercaseHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value
  })
  return out
}

export type WebhookHandler = (
  body: unknown,
  ctx: { sender: string; receivedAt: number; event: string },
) => Promise<void> | void

export interface WebhooksDeps {
  /** HMAC-SHA256 secret. Required. The /webhooks/* routes refuse to fire
   *  without it — silent acceptance of unsigned webhooks is the bug we
   *  are explicitly designing against. */
  hmacSecret: string
  /** Optional event-name → handler map. Webhooks for events without a
   *  handler still verify HMAC + return 200 (so upstream doesn't retry),
   *  but only audit-log the receipt. */
  handlers?: Record<string, WebhookHandler>
}

export function buildWebhookRoute(deps: WebhooksDeps): Hono {
  const app = new Hono()

  app.post('/:event', async (c) => {
    const eventParam = c.req.param('event')
    const eventParse = WebhookPathSchema.safeParse(eventParam)
    if (!eventParse.success) {
      await audit.log({
        event: 'webhook.in.reject',
        target: eventParam,
        payload: { reason: 'invalid-event-name' },
      })
      return c.json({ error: 'invalid event name' }, 400)
    }
    const event = eventParse.data

    if (!deps.hmacSecret) {
      await audit.log({
        event: 'webhook.in.reject',
        target: event,
        payload: { reason: 'no-hmac-secret-configured' },
      })
      return c.json({ error: 'webhooks not configured (no HMAC secret)' }, 503)
    }

    const headers = lowercaseHeaders(c.req.raw.headers)
    const sig = headers[SIGNATURE_HEADER]
    const tsHeader = headers[TIMESTAMP_HEADER]
    if (!sig || !tsHeader) {
      await audit.log({
        event: 'webhook.in.reject',
        target: event,
        payload: { reason: 'missing-headers' },
      })
      return c.json({ error: 'missing signature/timestamp' }, 401)
    }

    const ts = Number(tsHeader)
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
      await audit.log({
        event: 'webhook.in.reject',
        target: event,
        payload: { reason: 'replay-window', tsHeader },
      })
      return c.json({ error: 'timestamp outside replay window' }, 401)
    }

    const rawBody = await c.req.text()
    const expected = createHmac('sha256', deps.hmacSecret).update(`${tsHeader}.${rawBody}`).digest('hex')
    let sigBuf: Buffer
    let expBuf: Buffer
    try {
      sigBuf = Buffer.from(sig, 'hex')
      expBuf = Buffer.from(expected, 'hex')
    } catch {
      await audit.log({
        event: 'webhook.in.reject',
        target: event,
        payload: { reason: 'malformed-signature' },
      })
      return c.json({ error: 'malformed signature' }, 401)
    }
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      await audit.log({
        event: 'webhook.in.reject',
        target: event,
        payload: { reason: 'signature-mismatch' },
      })
      return c.json({ error: 'signature mismatch' }, 401)
    }

    let body: unknown
    try {
      body = rawBody.length > 0 ? JSON.parse(rawBody) : null
    } catch {
      await audit.log({
        event: 'webhook.in.reject',
        target: event,
        payload: { reason: 'invalid-json' },
      })
      return c.json({ error: 'invalid JSON' }, 400)
    }

    const sender = headers[SENDER_HEADER] ?? 'unknown'
    await audit.log({
      event: 'webhook.in.accept',
      target: event,
      payload: { sender, bytes: rawBody.length },
    })

    const handler = deps.handlers?.[event]
    if (handler) {
      try {
        await handler(body, { sender, receivedAt: Date.now(), event })
      } catch (err) {
        await audit.log({
          event: 'webhook.in.handler-error',
          target: event,
          payload: { error: (err as Error).message.slice(0, 200) },
        })
        return c.json({ error: 'handler error' }, 500)
      }
    }

    return c.json({ status: 'ok', event })
  })

  return app
}
