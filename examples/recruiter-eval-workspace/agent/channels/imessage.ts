// MIT — adapted from nanoclaw (https://github.com/qwibitai/nanoclaw)
//
// iMessage channel adapter via the BlueBubbles HTTP relay.
//
// HONEST GAP: Apple does not expose a server-side iMessage API. There is no
// pure-cloud path. BlueBubbles (https://bluebubbles.app) is the standard
// community workaround: it runs as a process on a Mac you control and exposes
// the local iMessage database + send queue as an HTTP API.
//
// Set up:
//   1. Install + run BlueBubbles Server on a Mac that's signed into iMessage.
//   2. Open a port (or use ngrok / a tunnel) so this process can reach it.
//   3. Configure a Server Password in the BlueBubbles UI.
//   4. (Optional) Enable webhooks in the BlueBubbles UI to receive new-message
//      pushes to <your-server>/webhooks/imessage instead of polling.
//
// Auth pattern:
//   BlueBubbles uses ?password=<password> as a query-string credential on
//   every request. We use timingSafeEqual on the inbound webhook signature
//   (a SHA256 of the raw body, key=BLUEBUBBLES_PASSWORD) when validating
//   pushes — BlueBubbles signs payloads via the `bb-signature` header on
//   builds that have webhook signing enabled.
//
// Env required: BLUEBUBBLES_SERVER_URL, BLUEBUBBLES_PASSWORD.

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const SIGNATURE_HEADER = 'bb-signature'

interface BlueBubblesMessage {
  guid?: string
  text?: string
  handle?: { address?: string }
  chats?: Array<{ guid?: string }>
  isFromMe?: boolean
}

interface BlueBubblesWebhookEnvelope {
  // BlueBubbles wraps pushed events as { type, data }, e.g.
  // { type: 'new-message', data: <Message> }.
  type?: string
  data?: BlueBubblesMessage
}

function readEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`imessage: missing required env var ${name}`)
  return v
}

function trimTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s
}

function verifySignature(rawBody: string, headerValue: string | null): boolean {
  // If BlueBubbles webhook signing isn't enabled, the header is absent — in
  // that case, signature verification is impossible and the caller should
  // either keep BlueBubbles on a private network or enable signing. We only
  // accept signed payloads here; refusing unsigned traffic is the safer
  // default given this is iMessage, not a public API.
  if (!headerValue) return false
  const password = readEnv('BLUEBUBBLES_PASSWORD')
  const expected = createHmac('sha256', password).update(rawBody, 'utf8').digest('hex')
  if (!/^[0-9a-f]+$/i.test(headerValue) || headerValue.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(headerValue, 'hex'), Buffer.from(expected, 'hex'))
}

/** Parse an inbound BlueBubbles webhook push (`new-message` event). Returns
 * null when the body is unsigned, mismatched, not a `new-message`, sent by
 * us, or missing chat/handle metadata. */
export async function receive(
  req: Request,
): Promise<{ chatId: string; text: string; sender: string } | null> {
  const rawBody = await req.text()
  if (!verifySignature(rawBody, req.headers.get(SIGNATURE_HEADER))) return null

  let payload: BlueBubblesWebhookEnvelope
  try {
    payload = JSON.parse(rawBody) as BlueBubblesWebhookEnvelope
  } catch {
    return null
  }

  if (payload.type !== 'new-message') return null
  const msg = payload.data
  if (!msg || msg.isFromMe) return null
  const text = msg.text
  const chatGuid = msg.chats?.[0]?.guid
  const sender = msg.handle?.address
  if (!text || !chatGuid || !sender) return null
  return { chatId: chatGuid, text, sender }
}

/** Send a text iMessage via BlueBubbles. `chatId` is the BlueBubbles chat
 * GUID (e.g. `iMessage;-;+15555550123` for a 1:1, or a group GUID). */
export async function send(chatId: string, text: string): Promise<void> {
  const base = trimTrailingSlash(readEnv('BLUEBUBBLES_SERVER_URL'))
  const password = readEnv('BLUEBUBBLES_PASSWORD')
  const url = `${base}/api/v1/message/text?password=${encodeURIComponent(password)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chatGuid: chatId,
      tempGuid: randomUUID(),
      message: text,
      method: 'apple-script',
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`imessage send failed: ${res.status} ${res.statusText} — ${detail.slice(0, 500)}`)
  }
}

export const channelMeta = {
  id: 'imessage' as const,
  envVars: ['BLUEBUBBLES_SERVER_URL', 'BLUEBUBBLES_PASSWORD'] as const,
  inbound: 'webhook' as const,
  outbound: 'POST' as const,
}
