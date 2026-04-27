// Worker-side types & zod schemas. The shared schemas (request/response
// shapes the client also needs) live in src/shared/schema.ts; this file
// holds worker-only types — bindings, audit envelopes, internal context.

import { z } from 'zod'

// Cloudflare Worker bindings — wrangler.jsonc declares these. Keep this
// shape in sync with wrangler.jsonc; a missing binding here means the
// worker reaches for `undefined` at runtime.
export interface Env {
  /** Static assets (Vite-built client) — bound via `assets.binding`. */
  ASSETS: { fetch: (req: Request) => Promise<Response> }
  /** KV namespace for the audit log (default sink — production deploys
   * should forward off-cluster; see docs/SECURITY.md). */
  AUDIT: KVNamespace
  /** KV namespace for rate-limiting state (token-bucket per tenant). */
  RATE_LIMIT: KVNamespace
  /** LLM egress — all chat fans through router.tangle.tools. */
  TANGLE_ROUTER_KEY: string
  /** Tenant session-token HMAC secret. */
  AUTH_SECRET: string
  /** HMAC secret for inbound webhooks. */
  WEBHOOK_HMAC_SECRET?: string
  /** Agent-pack root directory (dev) or R2 prefix (prod). Public. */
  AGENT_PACK_DIR: string
  /** Router URL — defaults to https://router.tangle.tools. */
  LLM_ROUTER_URL?: string
}

// Tenant context — every authenticated request carries this through Hono's
// c.var.tenant. Routes that touch tenant data MUST read from c.var.tenant,
// never from a query string or untrusted body field.
export interface TenantContext {
  tenantId: string
  /** Auth method that resolved this tenant — informational. */
  auth: 'session-token' | 'api-key' | 'webhook'
  /** Per-tenant quota — token-bucket. */
  quota: {
    requestsPerMinute: number
    tokensPerDay: number
  }
  /** Per-tenant pack-dir override (multi-tenancy.md). Falls back to
   * env.AGENT_PACK_DIR when undefined. */
  packDir?: string
}

// Audit envelope — every meaningful action (chat call, auth fail, rate-
// limit trip, webhook accept/reject) emits one of these into env.AUDIT.
export const AuditEntry = z.object({
  ts: z.string(), // ISO8601
  event: z.string(), // 'chat.invoke' | 'auth.reject' | 'rate-limit.exceeded' | 'webhook.in.accept' | ...
  tenantId: z.string().nullable(),
  agentId: z.string().nullable(),
  payload: z.record(z.unknown()).optional(),
  /** Sequential within the day — used for chain ordering. */
  seq: z.number().int().nonnegative(),
})
export type AuditEntry = z.infer<typeof AuditEntry>

// Hono Variables — what we attach to c.var
export interface HonoVariables {
  tenant: TenantContext
}
