// MIT — adapted from nanoclaw (https://github.com/qwibitai/nanoclaw)
//
// Slack channel adapter. Verifies the v0 signing-secret HMAC on every
// inbound Events API POST, parses event_callback for human "message"
// events (skipping bot/edit/subtype noise), and sends replies via
// chat.postMessage with bearer auth.
//
// Setup:
//  1. https://api.slack.com/apps → Create New App.
//  2. OAuth & Permissions → bot scopes: chat:write, channels:history,
//     im:history, app_mentions:read. Install to workspace → SLACK_BOT_TOKEN
//     (xoxb-...).
//  3. Basic Information → Signing Secret → SLACK_SIGNING_SECRET.
//  4. Event Subscriptions → Request URL: <your-https-url>/channels/slack.
//     Subscribe to message.channels and/or app_mention.

import { createHmac, timingSafeEqual } from 'node:crypto'

const API = 'https://slack.com/api'
const SIG_HEADER = 'x-slack-signature'
const TS_HEADER = 'x-slack-request-timestamp'
const REPLAY_WINDOW_SEC = 60 * 5

export interface SlackInbound {
  chatId: string
  text: string
  sender: string
}

interface SlackEventEnvelope {
  type: 'url_verification' | 'event_callback'
  challenge?: string
  event?: SlackEvent
}

interface SlackEvent {
  type: string
  subtype?: string
  channel: string
  user?: string
  bot_id?: string
  text?: string
  ts: string
}

function botToken(): string {
  const t = process.env.SLACK_BOT_TOKEN
  if (!t) throw new Error('SLACK_BOT_TOKEN not set')
  return t
}

function signingSecret(): string {
  const s = process.env.SLACK_SIGNING_SECRET
  if (!s) throw new Error('SLACK_SIGNING_SECRET not set')
  return s
}

/** v0 signing-secret verification per
 *  https://api.slack.com/authentication/verifying-requests-from-slack —
 *  HMAC-SHA256 over `v0:${ts}:${rawBody}`, compared with the v0= header. */
function verifySignature(rawBody: string, sigHeader: string, ts: string, secret: string): boolean {
  const tsNum = Number(ts)
  if (!Number.isFinite(tsNum)) return false
  if (Math.abs(Date.now() / 1000 - tsNum) > REPLAY_WINDOW_SEC) return false
  const expected = `v0=${createHmac('sha256', secret).update(`v0:${ts}:${rawBody}`).digest('hex')}`
  const a = Buffer.from(sigHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Parse a Slack Events API POST. Returns null for url_verification (caller
 *  must echo `challenge` back as plain text), bot-authored messages, edit
 *  subtypes, and non-message events. */
export async function receive(req: Request): Promise<SlackInbound | null> {
  const sig = req.headers.get(SIG_HEADER)
  const ts = req.headers.get(TS_HEADER)
  const raw = await req.text()
  if (!sig || !ts || !verifySignature(raw, sig, ts, signingSecret())) {
    throw new Error('slack: signature verification failed')
  }
  const env = JSON.parse(raw) as SlackEventEnvelope & { challenge?: string }
  if (env.type === 'url_verification') return null
  const ev = env.event
  if (!ev) return null
  if (ev.type !== 'message' && ev.type !== 'app_mention') return null
  if (ev.subtype) return null // skip message_changed, message_deleted, etc.
  if (ev.bot_id) return null // skip bot loops
  if (!ev.text || !ev.user) return null
  return { chatId: ev.channel, text: ev.text, sender: ev.user }
}

/** Send a message to a Slack channel/DM. Slack returns 200 even for logical
 *  failures (auth, channel-not-found) — check `ok` in the response body and
 *  surface `error` so the agent can react. */
export async function send(chatId: string, text: string): Promise<void> {
  const res = await fetch(`${API}/chat.postMessage`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${botToken()}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ channel: chatId, text }),
  })
  if (!res.ok) {
    throw new Error(`slack chat.postMessage ${res.status}`)
  }
  const body = (await res.json()) as { ok: boolean; error?: string }
  if (!body.ok) {
    throw new Error(`slack chat.postMessage error: ${body.error ?? 'unknown'}`)
  }
}

export const channelMeta = {
  id: 'slack' as const,
  envVars: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'] as const,
  inbound: 'webhook' as const,
  outbound: 'POST' as const,
}
