// MIT — original implementation. Webhook signature verification follows
// Linear's official pattern (HMAC-SHA256 of the raw request body, compared
// constant-time against the `Linear-Signature` header). Outbound replies use
// the Linear GraphQL API (commentCreate) at api.linear.app/graphql with a
// personal API key in the Authorization header. See linear.env.example.

const GRAPHQL_URL = 'https://api.linear.app/graphql'

export interface LinearInbound {
  /** Linear issue id (UUID). Use as the chat key when calling send(). */
  chatId: string
  text: string
  sender: string
  /** Event type from the webhook payload, useful for filtering. */
  event: 'Issue' | 'Comment'
  /** Action: create | update | remove (Linear delivers all three for both types). */
  action: 'create' | 'update' | 'remove'
}

interface LinearWebhookPayload {
  type: 'Issue' | 'Comment'
  action: 'create' | 'update' | 'remove'
  data: LinearWebhookData
  createdAt?: string
}

interface LinearWebhookData {
  id?: string
  // Comment fields
  body?: string
  issueId?: string
  // Issue fields
  title?: string
  description?: string
  // Both
  user?: { id?: string; email?: string; name?: string }
  // Comment.user is the author; Issue actor lives in top-level payload on some events.
}

function apiKey(): string {
  const k = process.env.LINEAR_API_KEY
  if (!k) throw new Error('linear channel: LINEAR_API_KEY not set')
  return k
}

function webhookSecret(): string {
  const s = process.env.LINEAR_WEBHOOK_SECRET
  if (!s) throw new Error('linear channel: LINEAR_WEBHOOK_SECRET not set')
  return s
}

/** Constant-time hex-string compare. Throws if lengths differ — but only after
 *  doing the full XOR walk on the shorter side, so no length-leak shortcut. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Walk anyway to discourage length-based side channels in the caller.
    let acc = 1
    const n = Math.min(a.length, b.length)
    for (let i = 0; i < n; i++) acc |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return false
  }
  let acc = 0
  for (let i = 0; i < a.length; i++) acc |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return acc === 0
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Parse a Linear webhook POST. Verifies HMAC-SHA256 against the
 *  `Linear-Signature` header. Returns null for events we don't handle
 *  (everything except Issue/create + Comment/create). Throws on bad signature
 *  so the agent's HTTP layer returns 401 — no silent drop. */
export async function receive(req: Request): Promise<LinearInbound | null> {
  const sigHeader = req.headers.get('linear-signature')
  if (!sigHeader) throw new Error('linear webhook: missing Linear-Signature header')
  const raw = await req.text()
  const expected = await hmacSha256Hex(webhookSecret(), raw)
  if (!timingSafeEqualHex(expected, sigHeader.toLowerCase())) {
    throw new Error('linear webhook: signature mismatch')
  }

  const payload = JSON.parse(raw) as LinearWebhookPayload
  if (payload.action !== 'create') return null
  if (payload.type !== 'Issue' && payload.type !== 'Comment') return null

  if (payload.type === 'Comment') {
    const issueId = payload.data.issueId
    const body = payload.data.body
    if (!issueId || !body) return null
    return {
      chatId: issueId,
      text: body,
      sender: payload.data.user?.email ?? payload.data.user?.name ?? 'unknown',
      event: 'Comment',
      action: 'create',
    }
  }

  // Issue/create
  const issueId = payload.data.id
  const title = payload.data.title
  if (!issueId || !title) return null
  const text = payload.data.description ? `${title}\n\n${payload.data.description}` : title
  return {
    chatId: issueId,
    text,
    sender: payload.data.user?.email ?? payload.data.user?.name ?? 'unknown',
    event: 'Issue',
    action: 'create',
  }
}

/** Post a comment on a Linear issue. `target` is the issue id from receive(). */
export async function send(target: string, text: string): Promise<void> {
  const mutation = `
    mutation CommentCreate($issueId: String!, $body: String!) {
      commentCreate(input: { issueId: $issueId, body: $body }) {
        success
        comment { id }
      }
    }
  `
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      authorization: apiKey(),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query: mutation, variables: { issueId: target, body: text } }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`linear commentCreate ${res.status}: ${detail.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    data?: { commentCreate?: { success?: boolean } }
    errors?: Array<{ message: string }>
  }
  if (json.errors?.length) {
    throw new Error(`linear commentCreate graphql: ${json.errors.map((e) => e.message).join('; ')}`)
  }
  if (!json.data?.commentCreate?.success) {
    throw new Error('linear commentCreate: success=false')
  }
}

export const channelMeta = {
  id: 'linear' as const,
  envVars: ['LINEAR_API_KEY', 'LINEAR_WEBHOOK_SECRET'] as const,
  inbound: 'webhook' as const,
  outbound: 'POST' as const,
}
