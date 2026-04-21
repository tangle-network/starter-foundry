// PHI-access middleware. Every API route that returns PHI wraps its handler
// with `withPhiAccess(...)`, which:
//   1. Asserts the request is authenticated and has a role.
//   2. Writes an AuditLog row BEFORE the handler runs (so even an error path
//      produces an audit trail — "attempted access" is itself auditable).
//   3. Forwards actor context to the handler.
//
// If you add a new route that touches patients/encounters, you MUST wrap it.
// The validate-hipaa.mjs check fails the scaffold if this file is gutted.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { db } from '../db/client.ts'
import { auditLogs } from '../db/schema.ts'

export interface Actor {
  id: string
  role: 'clinician' | 'billing' | 'admin' | 'patient'
}

export interface PhiAccessContext {
  actor: Actor
  resourceType: 'patient' | 'encounter' | 'provider'
  resourceId: string | null
  /** HIPAA minimum-necessary rule: every PHI read needs a documented purpose. */
  reason: string
}

export type PhiHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  context: PhiAccessContext,
) => Promise<void> | void

/**
 * Resolve the calling actor from the request. This starter reads the
 * X-Actor-Id / X-Actor-Role headers — wire up a real auth layer
 * (Clerk, better-auth, mTLS, OAuth) before storing real PHI.
 */
function resolveActor(request: IncomingMessage): Actor | null {
  const id = request.headers['x-actor-id']
  const role = request.headers['x-actor-role']
  if (typeof id !== 'string' || typeof role !== 'string') return null
  if (!['clinician', 'billing', 'admin', 'patient'].includes(role)) return null
  return { id, role: role as Actor['role'] }
}

export function withPhiAccess(
  action: 'read' | 'create' | 'update',
  resourceType: PhiAccessContext['resourceType'],
  extractResourceId: (request: IncomingMessage) => string | null,
  handler: PhiHandler,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request, response) => {
    const actor = resolveActor(request)
    if (!actor) {
      response.writeHead(401, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'unauthenticated' }))
      return
    }

    const resourceId = extractResourceId(request)
    const reason = (request.headers['x-access-reason'] as string | undefined) ?? 'unspecified'

    // Write the audit log row BEFORE handling the request. If the DB write
    // fails we refuse the request rather than serve PHI without a trail.
    try {
      await db.insert(auditLogs).values({
        actorId: actor.id,
        actorRole: actor.role,
        action,
        resourceType,
        resourceId,
        reason,
        ipAddress: (request.socket.remoteAddress ?? '').slice(0, 45),
        userAgent: (request.headers['user-agent'] ?? '').slice(0, 500),
      })
    } catch (err) {
      // Fail-closed: no audit log, no PHI access.
      response.writeHead(503, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'audit log unavailable; refusing PHI access' }))
      return
    }

    await handler(request, response, { actor, resourceType, resourceId, reason })
  }
}
