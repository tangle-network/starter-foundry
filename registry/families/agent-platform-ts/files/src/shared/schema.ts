// Shared schemas — types both the React client and the Hono worker need.
// Anything specific to the worker (Env bindings, audit envelopes) lives in
// src/worker/types.ts; anything specific to the client lives in
// src/client/lib/api.ts. THIS file is the wire-format contract.

import { z } from 'zod'

// /api/agents — list of pack ids the platform is hosting
export const AgentSummary = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string(),
  /** Slugged tags from the pack frontmatter — used for filtering in admin UI. */
  tags: z.array(z.string()).default([]),
})
export type AgentSummary = z.infer<typeof AgentSummary>

export const ListAgentsResponse = z.object({
  agents: z.array(AgentSummary),
})
export type ListAgentsResponse = z.infer<typeof ListAgentsResponse>

// /api/chat/:agent — request body
export const ChatRequest = z.object({
  message: z.string().min(1).max(32_000),
  /** Optional prior history — caller manages the rolling window. */
  history: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      }),
    )
    .max(64)
    .default([]),
  /** Override default model. Falls back to the pack's recommended model. */
  model: z.string().optional(),
  /** Stream tokens via SSE rather than wait for the full response. */
  stream: z.boolean().default(false),
})
export type ChatRequest = z.infer<typeof ChatRequest>

// /api/chat/:agent — non-streaming response
export const ChatResponse = z.object({
  agentId: z.string(),
  content: z.string(),
  /** Parsed `:::block` artifacts (artifact, escalation, suggestion, ...). */
  blocks: z
    .array(
      z.object({
        kind: z.string(),
        attrs: z.record(z.string()),
        body: z.string(),
      }),
    )
    .default([]),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
      total_tokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
})
export type ChatResponse = z.infer<typeof ChatResponse>

// /api/health
export const HealthResponse = z.object({
  status: z.enum(['ok', 'degraded']),
  packCount: z.number().int().nonnegative(),
  routerReachable: z.boolean(),
})
export type HealthResponse = z.infer<typeof HealthResponse>
