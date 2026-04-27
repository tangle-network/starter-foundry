// chat-bridge — THE single egress to router.tangle.tools.
//
// INVARIANT: this is the ONLY place in the worker bundle that calls
// `fetch()` against an LLM endpoint. Any other code that needs LLM access
// MUST import from this module. The single-egress claim in
// docs/SECURITY.md is contingent on operators keeping it that way; a
// bundle-check validator (registry-side) flags any direct fetch to
// router.tangle.tools or an OpenAI-shaped chat-completions URL outside
// this file.
//
// The wrapper below mirrors `chatViaRouter()` from src/lib/tangle.ts (the
// agent-base:tangle layer composes that file in). chatViaRouter reads its
// API key from `process.env` which doesn't exist in Workers — so this
// platform-level wrapper takes the key from the Hono env binding instead.

import type { Env } from '../types'

const DEFAULT_ROUTER_URL = 'https://router.tangle.tools'

export interface RouterChatOptions {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  stream?: boolean
  temperature?: number
}

export interface RouterChatResult {
  /** OpenAI chat-completions response shape — usage, choices, etc. */
  ok: boolean
  status: number
  body: unknown
}

/** Single egress. Operators: do not bypass. */
export async function chatViaRouter(env: Env, opts: RouterChatOptions): Promise<RouterChatResult> {
  if (!env.TANGLE_ROUTER_KEY) {
    throw new Error('TANGLE_ROUTER_KEY not set — bundles must route LLM calls through router.tangle.tools')
  }
  const baseUrl = env.LLM_ROUTER_URL ?? DEFAULT_ROUTER_URL
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.TANGLE_ROUTER_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream: opts.stream ?? false,
      temperature: opts.temperature ?? 0.2,
    }),
  })

  // For streaming, return the raw Response so the route handler can pipe
  // SSE bytes back to the client. JSON-mode parses eagerly.
  if (opts.stream) {
    return { ok: res.ok, status: res.status, body: res.body }
  }
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = { error: 'router returned non-JSON response' }
  }
  return { ok: res.ok, status: res.status, body }
}

/** Streaming-mode handle — the route handler awaits this and pipes the
 * underlying ReadableStream to the client. Centralizing the call here so
 * the egress invariant survives stream paths. */
export async function chatViaRouterStream(
  env: Env,
  opts: Omit<RouterChatOptions, 'stream'>,
): Promise<Response> {
  if (!env.TANGLE_ROUTER_KEY) {
    throw new Error('TANGLE_ROUTER_KEY not set — bundles must route LLM calls through router.tangle.tools')
  }
  const baseUrl = env.LLM_ROUTER_URL ?? DEFAULT_ROUTER_URL
  return fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.TANGLE_ROUTER_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream: true,
      temperature: opts.temperature ?? 0.2,
    }),
  })
}
