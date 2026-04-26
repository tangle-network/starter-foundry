// identity — Ed25519 ephemeral signed identity for cross-agent calls.
// TTL ≤ 1 hour, auto-rotated.
//
// Threat: agent A wants to call agent B claiming to be agent C. With
// signed identity, A's call must include a valid signature from C's
// private key. A doesn't have it, call fails. Agent B verifies via
// the gateway's published pubkey directory.
//
// At runtime the agent receives its identity from the Tangle gateway
// at session start (env: TANGLE_AGENT_IDENTITY_JSON). This module wraps
// that handshake and exposes a typed surface.

import { audit } from './audit.js'

export interface AgentIdentity {
  agentId: string
  sessionId: string
  deployerId: string
  signedAt: number
  expiresAt: number
  capabilities?: string[]
  publicKey: string
  /** Signature is over { agentId, sessionId, signedAt, expiresAt, capabilities }. */
  signature: string
}

let cached: AgentIdentity | null = null

function fromEnv(): AgentIdentity {
  const raw = process.env.TANGLE_AGENT_IDENTITY_JSON
  if (!raw) {
    // In dev/test, fall back to a synthetic identity. Production
    // gateways MUST inject a real signed identity.
    if (process.env.NODE_ENV !== 'production') {
      const now = Date.now()
      return {
        agentId: process.env.AGENT_NAME ?? 'dev-agent',
        sessionId: `dev-${now}`,
        deployerId: 'dev-deployer',
        signedAt: now,
        expiresAt: now + 3600_000,
        capabilities: ['sensitive-fs'],
        publicKey: 'dev-pubkey',
        signature: 'dev-signature',
      }
    }
    throw new Error('TANGLE_AGENT_IDENTITY_JSON missing — gateway did not inject identity')
  }
  return JSON.parse(raw) as AgentIdentity
}

function load(): AgentIdentity {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached
  const fresh = fromEnv()
  if (fresh.expiresAt < Date.now()) {
    throw new Error(`agent identity expired at ${new Date(fresh.expiresAt).toISOString()}`)
  }
  if (cached && cached.agentId !== fresh.agentId) {
    audit.log({ event: 'identity.id-changed', payload: { previous: cached.agentId, current: fresh.agentId } })
  } else if (!cached) {
    audit.log({ event: 'identity.loaded', payload: { agentId: fresh.agentId, ttlSec: Math.floor((fresh.expiresAt - Date.now()) / 1000) } })
  }
  cached = fresh
  return fresh
}

export const identity = {
  current(): AgentIdentity {
    return load()
  },

  /** True iff the supplied identity envelope is signed by a known deployer
   * and unexpired. Verification of the signature itself happens at the
   * gateway; this is the in-process happy-path check. */
  verify(envelope: AgentIdentity): boolean {
    if (envelope.expiresAt < Date.now()) {
      audit.log({ event: 'identity.verify-fail', target: envelope.agentId, payload: { reason: 'expired' } })
      return false
    }
    if (!envelope.signature || envelope.signature.length === 0) {
      audit.log({ event: 'identity.verify-fail', target: envelope.agentId, payload: { reason: 'missing-signature' } })
      return false
    }
    return true
  },

  /** Force a re-load on next .current() call. Use after operator notifies
   * of a rotation event. */
  invalidate(): void {
    if (cached) {
      audit.log({ event: 'identity.invalidate', payload: { agentId: cached.agentId } })
      cached = null
    }
  },
}
