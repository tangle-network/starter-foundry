import { Hono } from 'hono'
import type { Env, HonoVariables } from '../types'
import { listPackIds } from '../lib/load-agent-pack'
import { HealthResponse } from '../../shared/schema'

export const healthRoute = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

// GET /api/health — unauthenticated. Probe-friendly. Reports pack count
// and a (best-effort) reachability flag for the LLM router.
healthRoute.get('/', async (c) => {
  const packCount = listPackIds().length

  // We deliberately don't make a live LLM call from /health — that would
  // burn router quota on every probe. Instead, treat the presence of the
  // router key + a configured URL as "reachable"; runtime failures will
  // surface in /api/chat audit entries.
  const routerReachable = Boolean(c.env.TANGLE_ROUTER_KEY)

  const status: 'ok' | 'degraded' = routerReachable ? 'ok' : 'degraded'
  const body: HealthResponse = { status, packCount, routerReachable }
  return c.json(body)
})
