// Token-bucket rate limiter, in-memory by default.
//
// Per-key bucket: each tenant API key gets its own bucket of `capacity`
// tokens, refilling at `capacity / 60s`. Each /chat call costs one token.
// Refusing the request costs zero tokens — we don't penalise a 429.
//
// The in-memory store is correct on a single instance. For multi-instance
// deploys (CF Workers global region, k8s with replicas, etc.) you MUST swap
// the `store` for a Redis-backed equivalent, or the bucket is per-instance
// not per-tenant. The interface is small on purpose — the upgrade is one
// file change.
//
// Redis upgrade sketch:
//   class RedisStore {
//     async take(key: string, capacity: number): Promise<{ allowed: boolean; remaining: number }> {
//       // Lua script: GETSET on a sliding-window key, decrement, return remaining.
//       // See e.g. https://redis.io/learn/develop/dotnet/aspnetcore/rate-limiting/sliding-window
//     }
//   }

interface Bucket {
  tokens: number
  lastRefillMs: number
}

const REFILL_WINDOW_MS = 60_000

export class InMemoryRateLimitStore {
  private buckets = new Map<string, Bucket>()

  take(
    key: string,
    capacity: number,
    nowMs = Date.now(),
  ): { allowed: boolean; remaining: number; retryAfterSec: number } {
    let bucket = this.buckets.get(key)
    if (!bucket) {
      bucket = { tokens: capacity, lastRefillMs: nowMs }
      this.buckets.set(key, bucket)
    }
    // Refill — linear, fractional. Floor on read so we never grant a
    // partial token; the unused fraction stays in lastRefillMs by NOT
    // advancing it past `nowMs - leftover * window`.
    const elapsed = nowMs - bucket.lastRefillMs
    if (elapsed > 0) {
      const refill = (elapsed / REFILL_WINDOW_MS) * capacity
      bucket.tokens = Math.min(capacity, bucket.tokens + refill)
      bucket.lastRefillMs = nowMs
    }
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterSec: 0 }
    }
    // Rejected. Compute when next token will be available.
    const tokensNeeded = 1 - bucket.tokens
    const msUntilRefill = (tokensNeeded / capacity) * REFILL_WINDOW_MS
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil(msUntilRefill / 1000)),
    }
  }

  /** Test helper — clear all buckets. */
  reset(): void {
    this.buckets.clear()
  }
}

export const rateLimitStore = new InMemoryRateLimitStore()

export function rateLimitFor(
  key: string,
  capacityPerMin = Number(process.env['RATE_LIMIT_PER_MIN'] ?? 60),
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  return rateLimitStore.take(key, capacityPerMin)
}
