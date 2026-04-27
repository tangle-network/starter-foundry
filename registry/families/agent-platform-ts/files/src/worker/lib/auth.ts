// auth — tenant resolution.
//
// THIS IS A PLACEHOLDER. Treat it as a working scaffold, not a finished
// implementation. The platform's identity boundary lives HERE (we are the
// gateway — no upstream is going to verify tenancy for us). Operators
// MUST replace the placeholder with a real provider before anything
// touches production. Real options (drop in any one):
//
//   1. NextAuth-style JWT — verify a signed JWT in the `Authorization`
//      header against a JWKS. The `jose` package works fine on workerd.
//   2. Better-Auth / Clerk / Supabase-Auth — exchange their session
//      cookie for a tenantId via their introspection endpoint.
//   3. Per-tenant API keys — issue keys tagged `sk-plat-<tenantId>-...`,
//      look up + validate against KV / D1 with a constant-time compare.
//
// The current implementation accepts ANY non-empty bearer token whose
// HMAC matches AUTH_SECRET — useful for `wrangler dev` smoke tests but
// trivially bypassable in production.

import type { Context } from 'hono'
import type { Env, HonoVariables, TenantContext } from '../types'
import { audit } from './audit'

const SESSION_HEADER = 'authorization'
const API_KEY_HEADER = 'x-platform-api-key'

interface SignedToken {
  tenantId: string
  exp: number
  /** Per-tenant overrides — quota & pack-dir. Optional. */
  quota?: { requestsPerMinute?: number; tokensPerDay?: number }
  packDir?: string
}

const DEFAULT_QUOTA = { requestsPerMinute: 30, tokensPerDay: 200_000 }

/** Constant-time string compare — prevents timing-leak when comparing
 * HMAC digests. Built on Web Crypto's timingSafeEqual analog. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Verify a signed token. Format: base64url(JSON).signatureHex */
async function verifySessionToken(token: string, secret: string): Promise<SignedToken | null> {
  const dot = token.lastIndexOf('.')
  if (dot < 0) return null
  const payloadB64 = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = await hmacSha256Hex(secret, payloadB64)
  if (!timingSafeEqual(sig, expected)) return null
  let payload: SignedToken
  try {
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    payload = JSON.parse(json) as SignedToken
  } catch {
    return null
  }
  if (typeof payload.tenantId !== 'string' || !payload.tenantId) return null
  if (typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) return null
  return payload
}

/** Issue a session token — used by tests / a future /api/auth/login route. */
export async function issueSessionToken(
  secret: string,
  tenantId: string,
  ttlSec: number,
  extras: Pick<SignedToken, 'quota' | 'packDir'> = {},
): Promise<string> {
  const payload: SignedToken = {
    tenantId,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
    ...extras,
  }
  const json = JSON.stringify(payload)
  const b64 =
    btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const sig = await hmacSha256Hex(secret, b64)
  return `${b64}.${sig}`
}

/** Resolve a tenant from request headers. Returns null when the request
 * is unauthenticated; the caller decides whether to 401 or fall through
 * to a public path. */
export async function resolveTenant(
  c: Context<{ Bindings: Env; Variables: HonoVariables }>,
): Promise<TenantContext | null> {
  const env = c.env

  // 1. Bearer session token
  const auth = c.req.header(SESSION_HEADER)
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim()
    const payload = await verifySessionToken(token, env.AUTH_SECRET)
    if (payload) {
      return {
        tenantId: payload.tenantId,
        auth: 'session-token',
        quota: {
          requestsPerMinute: payload.quota?.requestsPerMinute ?? DEFAULT_QUOTA.requestsPerMinute,
          tokensPerDay: payload.quota?.tokensPerDay ?? DEFAULT_QUOTA.tokensPerDay,
        },
        packDir: payload.packDir,
      }
    }
  }

  // 2. API key — placeholder. Real impl looks up KV by hash.
  const apiKey = c.req.header(API_KEY_HEADER)
  if (apiKey) {
    // TODO(operator): replace with KV/D1 lookup.
    //   const record = await env.PLATFORM_KEYS.get(`hash:${await sha256(apiKey)}`, 'json')
    //   if (!record) return null
    //   return record.tenantContext
    const m = /^sk-plat-([a-z0-9-]+)-[a-z0-9]{8,}$/.exec(apiKey)
    if (m) {
      return {
        tenantId: m[1]!,
        auth: 'api-key',
        quota: DEFAULT_QUOTA,
      }
    }
  }

  return null
}

/** Hono middleware factory — guards a route group with tenant auth. */
export function requireTenant() {
  return async (
    c: Context<{ Bindings: Env; Variables: HonoVariables }>,
    next: () => Promise<void>,
  ): Promise<Response | void> => {
    const tenant = await resolveTenant(c)
    if (!tenant) {
      await audit(c.env, {
        event: 'auth.reject',
        tenantId: null,
        agentId: null,
        payload: { path: c.req.path, reason: 'missing-or-invalid-credentials' },
      })
      return c.json({ error: 'unauthorized' }, 401)
    }
    c.set('tenant', tenant)
    await next()
  }
}
