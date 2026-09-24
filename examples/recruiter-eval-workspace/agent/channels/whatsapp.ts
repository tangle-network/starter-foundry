// MIT — adapted from nanoclaw (https://github.com/qwibitai/nanoclaw)
//
// WhatsApp Cloud API channel adapter.
// Meta's official path: graph.facebook.com/v18.0/<PHONE_NUMBER_ID>/messages.
// We deliberately do NOT use Twilio; Meta's first-party API is the canonical
// surface for WhatsApp Business messaging.
//
// Inbound:  POST <your-server>/webhooks/whatsapp
//           — Meta signs the raw body with HMAC-SHA256(WHATSAPP_APP_SECRET)
//             and sets `X-Hub-Signature-256: sha256=<hex>`.
//           — receive() must be called with a Request whose body has NOT been
//             reparsed/reserialized (signature verification needs the exact
//             raw bytes Meta sent).
// Inbound verification handshake:
//           GET <your-server>/webhooks/whatsapp?hub.mode=subscribe&
//               hub.verify_token=<token>&hub.challenge=<value>
//           — handled by `verifyWebhook(req)`.
// Outbound: POST graph.facebook.com/v<version>/<PHONE_NUMBER_ID>/messages
//           with bearer auth.
//
// Env required: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
//               WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN.

import { createHmac, timingSafeEqual } from 'node:crypto'

const GRAPH_API_BASE = 'https://graph.facebook.com'
const GRAPH_API_VERSION = 'v18.0'
const SIGNATURE_HEADER = 'x-hub-signature-256'

interface MetaTextMessage {
  from: string
  id: string
  type: string
  text?: { body: string }
}

interface MetaWebhookEntry {
  changes?: Array<{
    value?: {
      messages?: MetaTextMessage[]
    }
  }>
}

interface MetaWebhookPayload {
  object?: string
  entry?: MetaWebhookEntry[]
}

function readEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`whatsapp: missing required env var ${name}`)
  return v
}

function verifySignature(rawBody: string, headerValue: string | null): boolean {
  if (!headerValue) return false
  // Meta sends "sha256=<hex>" — extract the hex digest.
  const eq = headerValue.indexOf('=')
  if (eq === -1) return false
  const algo = headerValue.slice(0, eq)
  const hex = headerValue.slice(eq + 1)
  if (algo !== 'sha256' || !/^[0-9a-f]+$/i.test(hex)) return false

  const secret = readEnv('WHATSAPP_APP_SECRET')
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const sigBuf = Buffer.from(hex, 'hex')
  const expBuf = Buffer.from(expected, 'hex')
  if (sigBuf.length !== expBuf.length) return false
  return timingSafeEqual(sigBuf, expBuf)
}

/** Handle Meta's GET-challenge handshake. Call this from your HTTP server's
 * GET handler at the same path as the POST webhook. Returns the challenge
 * string to echo back (200) or null if the verify_token didn't match (403). */
export function verifyWebhook(req: Request): string | null {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  if (mode !== 'subscribe' || !challenge) return null
  const expected = readEnv('WHATSAPP_VERIFY_TOKEN')
  // Constant-time comparison on the verify token.
  const a = Buffer.from(token ?? '', 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return challenge
}

/** Parse an inbound Meta webhook POST. Returns null if the request is
 * unsigned, signature-mismatched, or contains no text message. The first
 * text message in the payload is returned; multi-message payloads need a
 * fan-out at the HTTP-server layer. */
export async function receive(
  req: Request,
): Promise<{ chatId: string; text: string; sender: string } | null> {
  const rawBody = await req.text()
  const sig = req.headers.get(SIGNATURE_HEADER)
  if (!verifySignature(rawBody, sig)) return null

  let payload: MetaWebhookPayload
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload
  } catch {
    return null
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        if (msg.type === 'text' && msg.text?.body) {
          return { chatId: msg.from, text: msg.text.body, sender: msg.from }
        }
      }
    }
  }
  return null
}

/** Send a text message back to a WhatsApp user. `chatId` is the user's
 * E.164 phone number (no `+`), as provided by Meta in the inbound payload. */
export async function send(chatId: string, text: string): Promise<void> {
  const accessToken = readEnv('WHATSAPP_ACCESS_TOKEN')
  const phoneNumberId = readEnv('WHATSAPP_PHONE_NUMBER_ID')
  const url = `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: chatId,
      type: 'text',
      text: { body: text, preview_url: false },
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`whatsapp send failed: ${res.status} ${res.statusText} — ${detail.slice(0, 500)}`)
  }
}

export const channelMeta = {
  id: 'whatsapp' as const,
  envVars: [
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_APP_SECRET',
    'WHATSAPP_VERIFY_TOKEN',
  ] as const,
  inbound: 'webhook' as const,
  outbound: 'POST' as const,
}
