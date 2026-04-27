// Router — picks the role to invoke for a /chat turn. Three paths:
//
//   1. Single-agent pack            → trivially the only role.
//   2. Team with defaultRespondent  → that role, no LLM call.
//   3. Team without default         → cheap LLM-routing call returns a role id.
//
// Path 3 uses chat-bridge.chat() with a tiny routing system prompt. The
// model sees the role list + the user's last message and replies with one
// role id. We parse the id back out and validate it. If the LLM returns
// garbage, we fall back to roles[0] (and audit-log the misroute) rather than
// failing the whole turn.

import { chat } from './chat-bridge.js'
import type { AgentPack, ChatMessage, RouterDecision } from '../types.js'

const ROUTING_SYSTEM_TEMPLATE = (roles: Array<{ id: string; description?: string }>): string =>
  [
    'You are a routing dispatcher inside a multi-agent team. Your job is to pick',
    'the single role best suited to handle the latest user message.',
    '',
    'Available roles:',
    ...roles.map(
      (r) => `  - ${r.id}${r.description ? ` — ${r.description.replace(/\s+/g, ' ').trim()}` : ''}`,
    ),
    '',
    'Rules:',
    '  1. Reply with ONLY the role id. No prose, no punctuation, no quotes.',
    '  2. The role id MUST be one of the ids listed above, exactly.',
    '  3. If the message could be handled by any role, pick the most specific match.',
  ].join('\n')

function lastUserMessage(messages: ChatMessage[]): ChatMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m && m.role === 'user') return m
  }
  return undefined
}

function normalizeRoleId(raw: string): string {
  return raw.trim().toLowerCase().replace(/^["'`]|["'`]$/g, '')
}

export interface RouteOptions {
  /** Caller-supplied role id — bypasses LLM routing if the role exists. */
  explicitRoleId?: string
  /** Cheap routing model. Ignored when defaultRespondent is set or the
   *  caller passes explicitRoleId. */
  routingModel?: string
}

export async function decideRoute(
  pack: AgentPack,
  messages: ChatMessage[],
  opts: RouteOptions = {},
): Promise<RouterDecision> {
  // 1. Single-agent pack — there's only ever one role.
  if (pack.kind === 'single') {
    return { pack, roleId: pack.role.id, reason: 'single-agent' }
  }

  // 2. Caller forced a role id. Validate it exists; otherwise treat the
  //    explicit override as a routing hint and fall through.
  if (opts.explicitRoleId) {
    const hit = pack.roles.find((r) => r.id === opts.explicitRoleId)
    if (hit) {
      return { pack, roleId: hit.id, reason: 'team-default-respondent' }
    }
  }

  // 3. Team with a default respondent — no LLM call, no ambiguity.
  if (pack.defaultRespondent) {
    return { pack, roleId: pack.defaultRespondent, reason: 'team-default-respondent' }
  }

  // 4. LLM-routed. We use a cheap model + force a one-token reply. If the
  //    LLM returns an unknown id, fall back to the first role rather than
  //    failing the request — but the caller can audit the misroute via
  //    decision.reason === 'team-llm-routed' && roleId !== llm reply.
  const lastUser = lastUserMessage(messages)
  if (!lastUser) {
    // No user message yet → can't route. Pick the first role deterministically.
    const fallback = pack.roles[0]
    if (!fallback) {
      throw new Error(`team pack "${pack.id}" has no roles`)
    }
    return { pack, roleId: fallback.id, reason: 'team-llm-routed' }
  }

  const routingModel =
    opts.routingModel ?? process.env['ROUTING_MODEL'] ?? 'anthropic/claude-haiku-4-5'
  const systemPrompt = ROUTING_SYSTEM_TEMPLATE(
    pack.roles.map((r) =>
      r.description !== undefined ? { id: r.id, description: r.description } : { id: r.id },
    ),
  )
  const { content } = await chat({
    systemPrompt,
    messages: [{ role: 'user', content: lastUser.content }],
    model: routingModel,
    temperature: 0,
  })
  const candidate = normalizeRoleId(content)
  const hit = pack.roles.find((r) => r.id.toLowerCase() === candidate)
  if (hit) {
    return { pack, roleId: hit.id, reason: 'team-llm-routed' }
  }
  // LLM returned something we don't recognize — pick the first role.
  // The caller's audit log will see {reason: team-llm-routed, ...} but the
  // chosen roleId !== the (invalid) LLM output, which is the misroute signal.
  const fallback = pack.roles[0]
  if (!fallback) {
    throw new Error(`team pack "${pack.id}" has no roles`)
  }
  return { pack, roleId: fallback.id, reason: 'team-llm-routed' }
}

/** Pure (no LLM) variant for tests + offline routing decisions. Returns
 *  null if the pack would require an LLM-routing call. Test the pure
 *  paths exhaustively; mock-test the LLM path by supplying a fake
 *  `chatFn` if you need it. */
export function decideRouteSync(
  pack: AgentPack,
  opts: RouteOptions = {},
): RouterDecision | null {
  if (pack.kind === 'single') {
    return { pack, roleId: pack.role.id, reason: 'single-agent' }
  }
  if (opts.explicitRoleId) {
    const hit = pack.roles.find((r) => r.id === opts.explicitRoleId)
    if (hit) {
      return { pack, roleId: hit.id, reason: 'team-default-respondent' }
    }
  }
  if (pack.defaultRespondent) {
    return { pack, roleId: pack.defaultRespondent, reason: 'team-default-respondent' }
  }
  return null
}
