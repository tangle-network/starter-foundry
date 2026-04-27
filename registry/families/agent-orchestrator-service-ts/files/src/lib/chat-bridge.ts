// SINGLE EGRESS — this file is the ONLY place outbound LLM traffic leaves
// the orchestrator. The /chat handler, the team-routing LLM call, and any
// future agent-tool that needs an LLM all funnel through `chat()` below.
//
// Why a chokepoint: a deployable backend that calls multiple LLM URLs from
// scattered modules is impossible to audit, rate-limit, or migrate. With one
// chokepoint, you can swap router URLs, add per-tenant accounting, or insert
// a circuit breaker in one place. See docs/SECURITY.md.
//
// Operator's job: keep this invariant. Any new `fetch()` call to an LLM
// endpoint anywhere else in this codebase is a bug. Add a lint rule if you
// want it mechanically enforced.

import type { ChatBridgeOptions, ChatMessage } from '../types.js'

export const LLM_ROUTER_URL =
  process.env['LLM_ROUTER_URL'] ?? 'https://router.tangle.tools'

function requireRouterKey(): string {
  const key = process.env['TANGLE_ROUTER_KEY']
  if (!key) {
    throw new Error(
      'TANGLE_ROUTER_KEY not set — orchestrator refuses to start without ' +
        'a valid router.tangle.tools API key. See .env.example.',
    )
  }
  return key
}

/** Build the OpenAI-compatible message array — system prompt prepended,
 *  followed by the conversation history. */
function buildMessages(systemPrompt: string, history: ChatMessage[]): ChatMessage[] {
  return [{ role: 'system', content: systemPrompt }, ...history]
}

/** Non-streaming chat — returns the assistant string. Used by the
 *  team-routing LLM call (we want a single token decision, not a stream). */
export async function chat(opts: ChatBridgeOptions): Promise<{ content: string; raw: unknown }> {
  const apiKey = requireRouterKey()
  const res = await fetch(`${LLM_ROUTER_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      messages: buildMessages(opts.systemPrompt, opts.messages),
      stream: false,
      temperature: opts.temperature ?? 0.2,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '<unreadable>')
    throw new Error(`router.tangle.tools ${res.status}: ${body.slice(0, 500)}`)
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = json.choices?.[0]?.message?.content ?? ''
  return { content, raw: json }
}

/** Streaming chat — returns the upstream SSE Response so callers can pipe
 *  it directly to the client. Caller is responsible for content-type
 *  + cancellation; chat-bridge stays unopinionated about transport. */
export async function chatStream(opts: ChatBridgeOptions): Promise<Response> {
  const apiKey = requireRouterKey()
  const res = await fetch(`${LLM_ROUTER_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      messages: buildMessages(opts.systemPrompt, opts.messages),
      stream: true,
      temperature: opts.temperature ?? 0.2,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '<unreadable>')
    throw new Error(`router.tangle.tools ${res.status}: ${body.slice(0, 500)}`)
  }
  return res
}
