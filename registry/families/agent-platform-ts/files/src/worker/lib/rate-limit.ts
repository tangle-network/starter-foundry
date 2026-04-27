// rate-limit — KV-backed token bucket per tenant.
//
// LIMITATIONS (be honest):
//   - KV is eventually consistent. Two concurrent requests in different
//     PoPs can both read "9 tokens left" and both decrement to 8. For
//     LLM-cost-bounded workloads this slop is acceptable; for monetary
//     metering it is NOT — use Durable Objects (or external Redis) when
//     atomicity matters.
//   - The window math here is leak-bucket-with-fill, not sliding-window;
//     bursts up to capacity are allowed, then refill at `rate/sec`.
//
// The function below is deliberately small so a Durable-Objects swap-in
// is a one-file change.

import type { Env, TenantContext } from '../types'

interface BucketState {
  tokens: number
  /** ms timestamp of last refill */
  ts: number
}

function bucketKey(tenantId: string): string {
  return `bucket:${tenantId}`
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** ms until the next request would be allowed, when blocked */
  retryAfterMs?: number
}

/** Decrement-or-reject for one request. Capacity = quota.requestsPerMinute,
 * refill rate = capacity/60 per second. */
export async function consumeRequest(
  env: Env,
  tenant: TenantContext,
): Promise<RateLimitResult> {
  const capacity = tenant.quota.requestsPerMinute
  const refillPerMs = capacity / 60_000

  const now = Date.now()
  const key = bucketKey(tenant.tenantId)
  const raw = await env.RATE_LIMIT.get(key)
  let state: BucketState
  if (raw) {
    try {
      state = JSON.parse(raw) as BucketState
    } catch {
      state = { tokens: capacity, ts: now }
    }
  } else {
    state = { tokens: capacity, ts: now }
  }

  // Refill — proportional to elapsed time, capped at capacity.
  const elapsed = Math.max(0, now - state.ts)
  state.tokens = Math.min(capacity, state.tokens + elapsed * refillPerMs)
  state.ts = now

  if (state.tokens < 1) {
    const deficit = 1 - state.tokens
    const retryAfterMs = Math.ceil(deficit / refillPerMs)
    // Persist the unchanged state so refill timer keeps advancing.
    await env.RATE_LIMIT.put(key, JSON.stringify(state), { expirationTtl: 600 })
    return { allowed: false, remaining: 0, retryAfterMs }
  }

  state.tokens -= 1
  await env.RATE_LIMIT.put(key, JSON.stringify(state), { expirationTtl: 600 })
  return { allowed: true, remaining: Math.floor(state.tokens) }
}
