// webhook-out — HMAC-signed outbound webhooks with retry + circuit
// breaker + outbound URL whitelist.
//
// Threat: an agent author writes code that beacons to attacker.example.
// The whitelist (driven by manifest.defaults.outboundDomains) blocks
// non-listed hosts. Repeated failures to a target trip the circuit
// breaker, so a single misbehaving target can't burn the agent's
// retry budget.

import { createHmac } from 'node:crypto'
import { audit } from './audit.js'
import { identity } from './identity.js'
import { requireSecret } from './secrets.js'

const MAX_RETRIES = 3
const CIRCUIT_BREAKER_THRESHOLD = 5
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000

interface BreakerState {
  consecutiveFailures: number
  openUntilMs: number
}

const breakers = new Map<string, BreakerState>()

function host(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

function isAllowed(url: string, allowedDomains: string[]): boolean {
  const h = host(url)
  if (!h) return false
  return allowedDomains.some((d) => h === d || h.endsWith(`.${d}`))
}

export interface WebhookOutOptions {
  /** Name of the secret that holds this target's HMAC signing key. */
  secretName: string
  /** Required: the manifest's allowedDomains for this bundle. */
  allowedDomains: string[]
  /** Override max retries. */
  maxRetries?: number
  /** Headers passed through verbatim. */
  headers?: Record<string, string>
}

export interface WebhookOutResult {
  ok: boolean
  status: number
  attempts: number
  error?: string
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function webhookOut(
  target: string,
  payload: unknown,
  opts: WebhookOutOptions,
): Promise<WebhookOutResult> {
  if (!isAllowed(target, opts.allowedDomains)) {
    audit.log({ event: 'webhook.out.reject', target, payload: { reason: 'not-in-allowedDomains' } })
    return { ok: false, status: 0, attempts: 0, error: 'target not in allowedDomains' }
  }

  const breakerKey = host(target)
  const breaker = breakers.get(breakerKey)
  if (breaker && breaker.openUntilMs > Date.now()) {
    audit.log({ event: 'webhook.out.circuit-open', target, payload: { until: breaker.openUntilMs } })
    return { ok: false, status: 0, attempts: 0, error: 'circuit breaker open' }
  }

  const body = JSON.stringify(payload)
  const ts = Date.now().toString()
  const secret = requireSecret(opts.secretName).unsafeReveal('webhook-out HMAC signing')
  const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')
  const id = identity.current()
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-tangle-signature': sig,
    'x-tangle-timestamp': ts,
    'x-tangle-sender': id.agentId,
    ...opts.headers,
  }

  const maxRetries = opts.maxRetries ?? MAX_RETRIES
  let lastStatus = 0
  let lastError = ''
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(target, { method: 'POST', headers, body })
      lastStatus = res.status
      if (res.status < 500) {
        // 2xx/3xx/4xx — terminal. Don't retry on client errors.
        const ok = res.ok
        audit.log({
          event: ok ? 'webhook.out.success' : 'webhook.out.fail',
          target,
          payload: { status: res.status, attempt },
        })
        if (ok) {
          breakers.delete(breakerKey)
          return { ok: true, status: res.status, attempts: attempt }
        }
        recordFailure(breakerKey)
        return { ok: false, status: res.status, attempts: attempt }
      }
      lastError = `5xx (${res.status})`
    } catch (err) {
      lastError = (err as Error).message
      lastStatus = 0
    }
    if (attempt < maxRetries) {
      await delay(2 ** attempt * 250) // 500ms, 1s, 2s
    }
  }

  recordFailure(breakerKey)
  audit.log({ event: 'webhook.out.exhausted', target, payload: { attempts: maxRetries, lastStatus, lastError: lastError.slice(0, 200) } })
  return { ok: false, status: lastStatus, attempts: maxRetries, error: lastError }
}

function recordFailure(key: string): void {
  const cur = breakers.get(key) ?? { consecutiveFailures: 0, openUntilMs: 0 }
  cur.consecutiveFailures += 1
  if (cur.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    cur.openUntilMs = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS
    audit.log({ event: 'webhook.out.circuit-trip', target: key, payload: { failures: cur.consecutiveFailures } })
  }
  breakers.set(key, cur)
}
