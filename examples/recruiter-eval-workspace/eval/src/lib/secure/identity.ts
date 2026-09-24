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
  if (raw) return JSON.parse(raw) as AgentIdentity

  // Fail-closed: missing identity is a hard error in EVERY environment by
  // default. Dev fallback requires explicit SF_DEV_IDENTITY_OPTIN=1 — that
  // flag is the audit-trail of "yes, I deliberately ran without a real
  // identity." This closes the H3 muffled-gate where misconfigured prod
  // (forgot NODE_ENV=production) silently granted sensitive-fs.
  if (process.env.SF_DEV_IDENTITY_OPTIN !== '1') {
    throw new Error(
      'TANGLE_AGENT_IDENTITY_JSON missing and SF_DEV_IDENTITY_OPTIN!=1 — ' +
        'the gateway must inject a signed identity in any non-dev environment. ' +
        'For local dev/test, set SF_DEV_IDENTITY_OPTIN=1 explicitly.',
    )
  }
  // Explicit dev opt-in. Synthetic identity has NO sensitive-fs capability;
  // tests that need it must set TANGLE_AGENT_IDENTITY_JSON to a synthetic
  // envelope with the capability they need (which is itself an audit signal).
  const now = Date.now()
  return {
    agentId: process.env.AGENT_NAME ?? 'dev-agent',
    sessionId: `dev-${now}`,
    deployerId: 'dev-deployer',
    signedAt: now,
    expiresAt: now + 3600_000,
    capabilities: [],
    publicKey: 'dev-pubkey',
    signature: 'dev-signature',
  }
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

  /** Cryptographic verification of the identity envelope's signature
   * against a deployer pubkey directory.
   *
   * NOT IMPLEMENTED. The pubkey directory + Ed25519 verify path is a
   * separate piece of infrastructure (the Tangle gateway service)
   * that does not yet exist as deployed code. Returning a stubbed
   * boolean here would be worse than missing — callers would assume
   * cryptographic verification happened when it did not.
   *
   * Throws so any caller that depends on real verification fails loud.
   * When the gateway ships, replace this with the real Ed25519 path. */
  verify(_envelope: AgentIdentity): boolean {
    audit.log({ event: 'identity.verify-not-implemented' })
    throw new Error(
      'identity.verify() is not implemented — the Ed25519 deployer-pubkey ' +
        'directory ships with the gateway service in a future release. ' +
        'Do not call this method until that infrastructure is live; a stub ' +
        'that returns true would silently pretend verification happened.',
    )
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
