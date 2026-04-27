// POST /chat — main entry point. Validate body → load pack → route to role
// → invoke chat-bridge → return JSON or stream SSE.
//
// The handler is the only orchestration glue: it does NOT contain LLM
// logic, routing logic, or agent-loading logic — those all live in lib/.
// If you find yourself adding domain logic here, push it down a layer.

import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import { ChatRequestSchema } from '../schema.js'
import { findRole, loadPack, PackNotFoundError, readSystemPrompt } from '../lib/agent-loader.js'
import { decideRoute } from '../lib/router.js'
import { chat, chatStream } from '../lib/chat-bridge.js'
import { audit } from '../lib/audit.js'

export interface ChatDeps {
  packDir: string
  defaultModel: string
}

export function buildChatRoute(deps: ChatDeps): Hono {
  const app = new Hono()

  app.post('/', async (c) => {
    const tenantFingerprint = c.get('tenantFingerprint') as string | undefined
    const raw = await c.req.json().catch(() => null)
    const parsed = ChatRequestSchema.safeParse(raw)
    if (!parsed.success) {
      await audit.log({
        event: 'chat.reject',
        payload: { reason: 'schema', issues: parsed.error.issues.slice(0, 5) },
        ...(tenantFingerprint !== undefined ? { tenantFingerprint } : {}),
      })
      return c.json(
        { error: 'invalid request body', issues: parsed.error.issues.slice(0, 5) },
        400,
      )
    }

    const body = parsed.data

    // Load the pack. Missing pack → 404, not 500.
    let pack
    try {
      pack = await loadPack(deps.packDir, body.agent)
    } catch (err) {
      if (err instanceof PackNotFoundError) {
        await audit.log({
          event: 'chat.reject',
          target: body.agent,
          payload: { reason: 'pack-not-found' },
          ...(tenantFingerprint !== undefined ? { tenantFingerprint } : {}),
        })
        return c.json({ error: 'agent pack not found', agent: body.agent }, 404)
      }
      await audit.log({
        event: 'chat.reject',
        target: body.agent,
        payload: { reason: 'pack-load-error', error: (err as Error).message.slice(0, 200) },
        ...(tenantFingerprint !== undefined ? { tenantFingerprint } : {}),
      })
      return c.json({ error: 'failed to load agent pack', agent: body.agent }, 500)
    }

    // Decide which role handles this turn.
    let decision
    try {
      decision = await decideRoute(pack, body.messages, {
        ...(body.roleId !== undefined ? { explicitRoleId: body.roleId } : {}),
      })
    } catch (err) {
      await audit.log({
        event: 'chat.reject',
        target: body.agent,
        payload: { reason: 'route-error', error: (err as Error).message.slice(0, 200) },
        ...(tenantFingerprint !== undefined ? { tenantFingerprint } : {}),
      })
      return c.json({ error: 'routing failed', agent: body.agent }, 500)
    }

    const role = findRole(decision.pack, decision.roleId)
    if (!role) {
      // Should be impossible — decideRoute only returns existing role ids.
      await audit.log({
        event: 'chat.reject',
        target: body.agent,
        payload: { reason: 'role-not-found', roleId: decision.roleId },
        ...(tenantFingerprint !== undefined ? { tenantFingerprint } : {}),
      })
      return c.json(
        { error: 'role not found', agent: body.agent, roleId: decision.roleId },
        500,
      )
    }

    // Resolve model: explicit body override → role default → orchestrator default.
    const model = body.model ?? role.model ?? deps.defaultModel

    let systemPrompt: string
    try {
      systemPrompt = await readSystemPrompt(role)
    } catch (err) {
      await audit.log({
        event: 'chat.reject',
        target: body.agent,
        payload: {
          reason: 'system-prompt-missing',
          path: role.systemPromptPath,
          error: (err as Error).message.slice(0, 200),
        },
        ...(tenantFingerprint !== undefined ? { tenantFingerprint } : {}),
      })
      return c.json(
        { error: 'system prompt missing for role', agent: body.agent, roleId: decision.roleId },
        500,
      )
    }

    await audit.log({
      event: 'chat.accept',
      target: body.agent,
      payload: { roleId: decision.roleId, reason: decision.reason, model, stream: body.stream === true },
      ...(tenantFingerprint !== undefined ? { tenantFingerprint } : {}),
    })

    if (body.stream === true) {
      // SSE pass-through. We deliberately don't transcode the upstream
      // chunks — the client can speak OpenAI-style SSE directly.
      const upstream = await chatStream({
        systemPrompt,
        messages: body.messages,
        model,
        stream: true,
      })
      const upstreamBody = upstream.body
      if (!upstreamBody) {
        return c.json({ error: 'upstream returned empty stream' }, 502)
      }
      c.header('content-type', 'text/event-stream')
      c.header('cache-control', 'no-cache')
      c.header('connection', 'keep-alive')
      c.header('x-orchestrator-route', `${body.agent}:${decision.roleId}`)
      return stream(c, async (writer) => {
        const reader = upstreamBody.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            await writer.write(value)
          }
        } finally {
          reader.releaseLock()
        }
      })
    }

    const result = await chat({
      systemPrompt,
      messages: body.messages,
      model,
    })
    return c.json({
      agent: body.agent,
      roleId: decision.roleId,
      routeReason: decision.reason,
      model,
      message: { role: 'assistant', content: result.content },
    })
  })

  return app
}
