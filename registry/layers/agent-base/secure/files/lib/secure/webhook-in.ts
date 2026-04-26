// webhook-in — HMAC-SHA256 signed inbound webhooks with replay-window
// + schema validation. Reject-loud on any failure; never silently
// accept unsigned/malformed traffic.
//
// Threat: attacker tries to inject a fake "PT session ingested"
// payload to corrupt the doctor agent's record. They lack the shared
// secret so HMAC fails; signature mismatch is audit-logged with the
// claimed sender id.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { audit } from './audit.js'
import { requireSecret } from './secrets.js'

const SIGNATURE_HEADER = 'x-tangle-signature'
const TIMESTAMP_HEADER = 'x-tangle-timestamp'
const REPLAY_WINDOW_MS = 5 * 60_000

export interface WebhookSpec<TBody = unknown> {
  path: string
  /** Optional schema validator. Receives parsed JSON body, returns null on
   * success or an error string on failure. Bundles can plug zod / typebox /
   * hand-written checks in here. */
  schema?: (body: unknown) => null | string
  /** Hard-required: the env var that holds the HMAC secret for THIS
   * webhook. Different webhooks should NOT share secrets. */
  secretName: string
  handler: (body: TBody, ctx: { sender: string; receivedAt: number }) => Promise<void> | void
}

const registry = new Map<string, WebhookSpec>()

export function defineWebhook<TBody = unknown>(spec: WebhookSpec<TBody>): void {
  if (registry.has(spec.path)) {
    throw new Error(`webhook already defined at ${spec.path}`)
  }
  registry.set(spec.path, spec as WebhookSpec)
  audit.log({ event: 'webhook.in.define', target: spec.path })
}

export interface WebhookRequest {
  path: string
  headers: Record<string, string>
  rawBody: string
}

export interface WebhookResponse {
  status: number
  body: string
}

async function dispatchOne(spec: WebhookSpec, req: WebhookRequest): Promise<WebhookResponse> {
  const sig = req.headers[SIGNATURE_HEADER]
  const tsHeader = req.headers[TIMESTAMP_HEADER]
  if (!sig || !tsHeader) {
    audit.log({ event: 'webhook.in.reject', target: req.path, payload: { reason: 'missing-headers' } })
    return { status: 401, body: 'missing signature/timestamp' }
  }

  const ts = Number(tsHeader)
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
    audit.log({ event: 'webhook.in.reject', target: req.path, payload: { reason: 'replay-window', tsHeader } })
    return { status: 401, body: 'timestamp outside replay window' }
  }

  const secret = requireSecret(spec.secretName).unsafeReveal('webhook-in HMAC verification')
  const expected = createHmac('sha256', secret).update(`${tsHeader}.${req.rawBody}`).digest('hex')
  const sigBuf = Buffer.from(sig, 'hex')
  const expBuf = Buffer.from(expected, 'hex')
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    audit.log({ event: 'webhook.in.reject', target: req.path, payload: { reason: 'signature-mismatch' } })
    return { status: 401, body: 'signature mismatch' }
  }

  let body: unknown
  try {
    body = JSON.parse(req.rawBody)
  } catch {
    audit.log({ event: 'webhook.in.reject', target: req.path, payload: { reason: 'invalid-json' } })
    return { status: 400, body: 'invalid JSON' }
  }

  if (spec.schema) {
    const err = spec.schema(body)
    if (err) {
      audit.log({ event: 'webhook.in.reject', target: req.path, payload: { reason: 'schema', error: err.slice(0, 200) } })
      return { status: 422, body: `schema: ${err}` }
    }
  }

  const sender = req.headers['x-tangle-sender'] ?? 'unknown'
  audit.log({ event: 'webhook.in.accept', target: req.path, payload: { sender, bytes: req.rawBody.length } })
  try {
    await spec.handler(body, { sender, receivedAt: Date.now() })
    return { status: 200, body: 'ok' }
  } catch (err) {
    audit.log({ event: 'webhook.in.handler-error', target: req.path, payload: { error: (err as Error).message.slice(0, 200) } })
    return { status: 500, body: 'handler error' }
  }
}

/** Mount registered webhooks against an HTTP framework. The framework
 * adapter passes WebhookRequest in; this returns a WebhookResponse to
 * serialize to the client. The function does NOT bind to a specific
 * server (Express/Hono/Cloudflare-Workers) — the runtime layer adapts. */
export async function mountWebhooks(req: WebhookRequest): Promise<WebhookResponse> {
  const spec = registry.get(req.path)
  if (!spec) {
    return { status: 404, body: 'no webhook defined' }
  }
  return dispatchOne(spec, req)
}
