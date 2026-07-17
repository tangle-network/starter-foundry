// MIT — original implementation. Gmail API + Google OAuth 2.0 (installed-app
// refresh-token flow). Default path is pull-based: poll for unread, fetch,
// mark read, normalize. Push-based (Pub/Sub watch) is documented in the
// .env.example but not wired here — the gap is honest: it requires GCP
// project setup beyond what an .env can express.

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'

export interface GmailInbound {
  /** Gmail message id — use as the chat/correlation key for replies. */
  chatId: string
  text: string
  sender: string
  /** RFC 822 Message-Id header, useful for threading replies via In-Reply-To. */
  messageId?: string
  /** Original Subject header — populates Subject on the reply if you choose. */
  subject?: string
  /** Thread id, for sending into the same Gmail thread. */
  threadId?: string
}

interface TokenCache {
  accessToken: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

function creds() {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'gmail channel: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN must all be set',
    )
  }
  return { clientId, clientSecret, refreshToken }
}

/** Exchange the refresh token for an access token. Caches until ~60s before expiry. */
async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.accessToken
  const { clientId, clientSecret, refreshToken } = creds()
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`gmail oauth refresh ${res.status}: ${detail.slice(0, 200)}`)
  }
  const json = (await res.json()) as { access_token: string; expires_in: number }
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  }
  return tokenCache.accessToken
}

interface MessagePayload {
  headers?: Array<{ name: string; value: string }>
  parts?: MessagePayload[]
  body?: { data?: string; size?: number }
  mimeType?: string
}

interface GmailMessage {
  id: string
  threadId: string
  payload?: MessagePayload
  snippet?: string
}

function decodeBase64Url(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  // Buffer is available in Node + Workers (via polyfill); fall back to atob.
  if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64').toString('utf8')
  return atob(b64)
}

function encodeBase64Url(s: string): string {
  const b64 = typeof Buffer !== 'undefined' ? Buffer.from(s, 'utf8').toString('base64') : btoa(s)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function header(payload: MessagePayload | undefined, name: string): string | undefined {
  return payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value
}

function extractText(payload: MessagePayload | undefined): string {
  if (!payload) return ''
  if (payload.mimeType === 'text/plain' && payload.body?.data) return decodeBase64Url(payload.body.data)
  for (const part of payload.parts ?? []) {
    if (part.mimeType === 'text/plain' && part.body?.data) return decodeBase64Url(part.body.data)
  }
  // Fallback: first text/* part, even if html.
  for (const part of payload.parts ?? []) {
    if (part.mimeType?.startsWith('text/') && part.body?.data) return decodeBase64Url(part.body.data)
  }
  return ''
}

async function gmailGet(path: string): Promise<Response> {
  const token = await accessToken()
  return fetch(`${GMAIL_API}${path}`, { headers: { authorization: `Bearer ${token}` } })
}

async function gmailPost(path: string, body: unknown): Promise<Response> {
  const token = await accessToken()
  return fetch(`${GMAIL_API}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Pull-based receive. Polls for the oldest unread message, fetches it,
 *  marks it read, and returns the normalized event. Returns null when the
 *  inbox has no unread mail — caller is expected to retry on a timer. */
export async function receive(_input?: unknown): Promise<GmailInbound | null> {
  const listRes = await gmailGet('/messages?q=is%3Aunread&maxResults=1')
  if (!listRes.ok) {
    const detail = await listRes.text().catch(() => '')
    throw new Error(`gmail messages.list ${listRes.status}: ${detail.slice(0, 200)}`)
  }
  const list = (await listRes.json()) as { messages?: Array<{ id: string }> }
  const head = list.messages?.[0]
  if (!head) return null

  const getRes = await gmailGet(`/messages/${head.id}?format=full`)
  if (!getRes.ok) {
    const detail = await getRes.text().catch(() => '')
    throw new Error(`gmail messages.get ${getRes.status}: ${detail.slice(0, 200)}`)
  }
  const msg = (await getRes.json()) as GmailMessage

  // Mark read by removing the UNREAD label. If this fails we still return
  // the event — but we surface the failure so the caller can de-dupe.
  const modRes = await gmailPost(`/messages/${head.id}/modify`, { removeLabelIds: ['UNREAD'] })
  if (!modRes.ok) {
    const detail = await modRes.text().catch(() => '')
    throw new Error(`gmail messages.modify ${modRes.status}: ${detail.slice(0, 200)}`)
  }

  const from = header(msg.payload, 'From') ?? ''
  return {
    chatId: msg.id,
    text: extractText(msg.payload) || msg.snippet || '',
    sender: from,
    messageId: header(msg.payload, 'Message-Id'),
    subject: header(msg.payload, 'Subject'),
    threadId: msg.threadId,
  }
}

/** Send a plain-text reply. `target` is the original Gmail message id from
 *  receive() — we look up the From + Subject + Message-Id and reply in-thread. */
export async function send(target: string, text: string): Promise<void> {
  const getRes = await gmailGet(`/messages/${target}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-Id`)
  if (!getRes.ok) {
    const detail = await getRes.text().catch(() => '')
    throw new Error(`gmail send: lookup ${getRes.status}: ${detail.slice(0, 200)}`)
  }
  const orig = (await getRes.json()) as GmailMessage
  const to = header(orig.payload, 'From')
  if (!to) throw new Error(`gmail send: original message ${target} has no From header`)
  const origSubject = header(orig.payload, 'Subject') ?? ''
  const subject = origSubject.toLowerCase().startsWith('re:') ? origSubject : `Re: ${origSubject}`
  const inReplyTo = header(orig.payload, 'Message-Id')

  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
  ]
  if (inReplyTo) {
    lines.push(`In-Reply-To: ${inReplyTo}`)
    lines.push(`References: ${inReplyTo}`)
  }
  const rfc5322 = `${lines.join('\r\n')}\r\n\r\n${text}`
  const raw = encodeBase64Url(rfc5322)

  const sendRes = await gmailPost('/messages/send', { raw, threadId: orig.threadId })
  if (!sendRes.ok) {
    const detail = await sendRes.text().catch(() => '')
    throw new Error(`gmail messages.send ${sendRes.status}: ${detail.slice(0, 200)}`)
  }
}

export const channelMeta = {
  id: 'gmail' as const,
  envVars: ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'] as const,
  inbound: 'pull' as const,
  outbound: 'POST' as const,
}
