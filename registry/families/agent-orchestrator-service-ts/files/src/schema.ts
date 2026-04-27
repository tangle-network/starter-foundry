// Zod schemas for every public request/response shape. These are the
// validation boundary — anything passing into a route handler is parsed
// here first, so handler bodies can assume well-typed input.

import { z } from 'zod'

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1).max(64_000),
})

export const ChatRequestSchema = z.object({
  /** Pack id (directory name in AGENT_PACK_DIR). */
  agent: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'agent id must be alphanumeric with - or _'),
  /** Conversation so far. Latest user message is the last entry. */
  messages: z.array(ChatMessageSchema).min(1).max(200),
  /** Optional explicit role override (skips the router). For team packs only. */
  roleId: z.string().min(1).max(120).optional(),
  /** Stream the response as SSE. Defaults to false (non-stream JSON). */
  stream: z.boolean().optional(),
  /** Model override. Falls back to the role's model, then the global default. */
  model: z.string().min(1).max(200).optional(),
})

export type ChatRequest = z.infer<typeof ChatRequestSchema>

export const WebhookPathSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/i)

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  agents: z.number().int().nonnegative(),
  version: z.string(),
})

export const AgentSummarySchema = z.object({
  id: z.string(),
  kind: z.enum(['single', 'team']),
  description: z.string().optional(),
  roles: z
    .array(
      z.object({
        id: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional(),
  defaultRespondent: z.string().optional(),
})

export const AgentsListResponseSchema = z.object({
  agents: z.array(AgentSummarySchema),
})
