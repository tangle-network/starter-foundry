// POST /api/chat/:agent — the core route.
//
// Pipeline (intentionally explicit — every step is auditable):
//   1. resolve tenant → 401 if absent
//   2. consume rate-limit token → 429 if exhausted
//   3. load pack → 404 if unknown
//   4. zod-validate body → 422 on bad input
//   5. chatViaRouter (single egress) → bubble router error
//   6. parse :::blocks from response text
//   7. audit-log + respond

import { Hono } from 'hono'
import type { Env, HonoVariables } from '../types'
import { requireTenant } from '../lib/auth'
import { audit } from '../lib/audit'
import { consumeRequest } from '../lib/rate-limit'
import { loadAgentPack } from '../lib/load-agent-pack'
import { chatViaRouter, chatViaRouterStream } from '../lib/chat-bridge'
import { parseBlocks } from '../lib/parse-blocks'
import { ChatRequest, type ChatResponse } from '../../shared/schema'

export const chatRoute = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

chatRoute.post('/:agent', requireTenant(), async (c) => {
  const env = c.env
  const tenant = c.get('tenant')
  const agentId = c.req.param('agent')

  // 2. rate-limit BEFORE doing any expensive work
  const rl = await consumeRequest(env, tenant)
  if (!rl.allowed) {
    await audit(env, {
      event: 'rate-limit.exceeded',
      tenantId: tenant.tenantId,
      agentId,
      payload: { retryAfterMs: rl.retryAfterMs },
    })
    return c.json(
      { error: 'rate_limit_exceeded', retryAfterMs: rl.retryAfterMs },
      429,
      { 'retry-after': String(Math.ceil((rl.retryAfterMs ?? 1000) / 1000)) },
    )
  }

  // 4. body validation. Do this BEFORE pack lookup so a malformed body
  // doesn't leak whether an agent id exists (CWE-200, mild).
  let parsedBody: ReturnType<typeof ChatRequest.parse>
  try {
    const raw = await c.req.json()
    parsedBody = ChatRequest.parse(raw)
  } catch (err) {
    await audit(env, {
      event: 'chat.reject',
      tenantId: tenant.tenantId,
      agentId,
      payload: { reason: 'invalid-body', error: (err as Error).message.slice(0, 200) },
    })
    return c.json({ error: 'invalid_body', detail: (err as Error).message }, 422)
  }

  // 3. pack lookup
  let pack: ReturnType<typeof loadAgentPack>
  try {
    pack = loadAgentPack(agentId)
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500
    await audit(env, {
      event: 'chat.reject',
      tenantId: tenant.tenantId,
      agentId,
      payload: { reason: 'pack-not-found' },
    })
    return c.json({ error: 'agent_not_found' }, status as 404)
  }

  const messages = [
    { role: 'system' as const, content: pack.systemPrompt },
    ...parsedBody.history,
    { role: 'user' as const, content: parsedBody.message },
  ]
  const model = parsedBody.model ?? pack.model

  // 5+6+7 — streaming branch
  if (parsedBody.stream) {
    await audit(env, {
      event: 'chat.invoke',
      tenantId: tenant.tenantId,
      agentId,
      payload: { model, stream: true, historyLen: parsedBody.history.length },
    })
    const upstream = await chatViaRouterStream(env, { model, messages })
    if (!upstream.ok || !upstream.body) {
      await audit(env, {
        event: 'chat.router-error',
        tenantId: tenant.tenantId,
        agentId,
        payload: { status: upstream.status },
      })
      return c.json({ error: 'router_error', status: upstream.status }, 502)
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        'x-tenant-id': tenant.tenantId,
        'x-agent-id': agentId,
      },
    })
  }

  // 5+6+7 — JSON branch
  const result = await chatViaRouter(env, { model, messages })
  if (!result.ok) {
    await audit(env, {
      event: 'chat.router-error',
      tenantId: tenant.tenantId,
      agentId,
      payload: { status: result.status, body: summarize(result.body) },
    })
    return c.json({ error: 'router_error', status: result.status }, 502)
  }

  const text = extractAssistantText(result.body)
  const usage = extractUsage(result.body)
  const { blocks, stripped } = parseBlocks(text)

  await audit(env, {
    event: 'chat.invoke',
    tenantId: tenant.tenantId,
    agentId,
    payload: { model, blockKinds: blocks.map((b) => b.kind), usage },
  })

  const body: ChatResponse = {
    agentId,
    content: stripped || text,
    blocks,
    usage,
  }
  c.header('x-tenant-id', tenant.tenantId)
  c.header('x-rate-limit-remaining', String(rl.remaining))
  return c.json(body)
})

// --- response shape extraction (OpenAI chat-completions) ---

function extractAssistantText(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const choices = (body as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return ''
  const first = choices[0] as { message?: { content?: unknown } }
  const content = first.message?.content
  return typeof content === 'string' ? content : ''
}

function extractUsage(body: unknown): ChatResponse['usage'] {
  if (!body || typeof body !== 'object') return undefined
  const u = (body as { usage?: unknown }).usage
  if (!u || typeof u !== 'object') return undefined
  const usage = u as Record<string, unknown>
  const out: ChatResponse['usage'] = {}
  for (const k of ['prompt_tokens', 'completion_tokens', 'total_tokens'] as const) {
    const v = usage[k]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      out[k] = Math.floor(v)
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function summarize(body: unknown): string {
  try {
    return JSON.stringify(body).slice(0, 200)
  } catch {
    return '[unserializable]'
  }
}
