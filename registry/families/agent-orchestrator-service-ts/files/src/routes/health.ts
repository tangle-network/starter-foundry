// GET /health — unauthenticated liveness + readiness check.
//
// Returns 200 + {status: ok, agents: <count>} when the orchestrator can
// list packs from AGENT_PACK_DIR. Returns 503 if AGENT_PACK_DIR is missing
// or unreadable — better to surface "broken config" loudly than to claim
// healthy while serving 500s on every /chat.

import { Hono } from 'hono'
import { listPackIds } from '../lib/agent-loader.js'
import { HealthResponseSchema } from '../schema.js'

export interface HealthDeps {
  packDir: string
  serviceName: string
  version: string
}

export function buildHealthRoute(deps: HealthDeps): Hono {
  const app = new Hono()
  app.get('/', async (c) => {
    try {
      const ids = await listPackIds(deps.packDir)
      const body = HealthResponseSchema.parse({
        status: 'ok',
        service: deps.serviceName,
        agents: ids.length,
        version: deps.version,
      })
      return c.json(body)
    } catch (err) {
      return c.json(
        {
          status: 'error',
          error: (err as Error).message,
          service: deps.serviceName,
        },
        503,
      )
    }
  })
  return app
}
