// api.ts — typed fetch wrappers for /api/*. Every helper returns a
// `Result<T>` rather than throwing — the UI displays a banner on failure
// instead of letting an uncaught reject crash the route.
//
// Auth: the bearer token lives in localStorage under 'platform-auth-token'.
// Replace this with your real auth provider's session-cookie integration
// when you wire NextAuth / Better-Auth / Clerk / etc.

import {
  ListAgentsResponse,
  ChatRequest,
  ChatResponse,
  HealthResponse,
} from '../../shared/schema'

const TOKEN_KEY = 'platform-auth-token'

export type Result<T> = { ok: true; value: T } | { ok: false; error: string; status?: number }

function authHeaders(): HeadersInit {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
  return token ? { authorization: `Bearer ${token}` } : {}
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

async function jsonOrError<T>(res: Response, parse: (raw: unknown) => T): Promise<Result<T>> {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as { error?: string }
      if (typeof body.error === 'string') detail = body.error
    } catch {
      /* ignore */
    }
    return { ok: false, error: detail, status: res.status }
  }
  try {
    const raw = await res.json()
    return { ok: true, value: parse(raw) }
  } catch (err) {
    return { ok: false, error: (err as Error).message, status: res.status }
  }
}

export async function fetchHealth(): Promise<Result<HealthResponse>> {
  const res = await fetch('/api/health')
  return jsonOrError(res, (raw) => HealthResponse.parse(raw))
}

export async function fetchAgents(): Promise<Result<ListAgentsResponse>> {
  const res = await fetch('/api/agents', { headers: { ...authHeaders() } })
  return jsonOrError(res, (raw) => ListAgentsResponse.parse(raw))
}

export async function postChat(
  agentId: string,
  body: ChatRequest,
): Promise<Result<ChatResponse>> {
  const res = await fetch(`/api/chat/${encodeURIComponent(agentId)}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  })
  return jsonOrError(res, (raw) => ChatResponse.parse(raw))
}
