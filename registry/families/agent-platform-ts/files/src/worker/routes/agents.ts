import { Hono } from 'hono'
import type { Env, HonoVariables } from '../types'
import { requireTenant } from '../lib/auth'
import { listAgentPacks } from '../lib/load-agent-pack'
import type { ListAgentsResponse } from '../../shared/schema'

export const agentsRoute = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

// GET /api/agents — list packs visible to the calling tenant.
//
// The placeholder implementation returns ALL packs to every tenant. Real
// multi-tenant deploys filter by `tenant.packDir` or by an ACL stored
// alongside the tenant record (see docs/MULTI-TENANCY.md).
agentsRoute.get('/', requireTenant(), (c) => {
  const tenant = c.get('tenant')
  const packs = listAgentPacks()
  const body: ListAgentsResponse = {
    agents: packs.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      tags: p.tags,
    })),
  }
  c.header('x-tenant-id', tenant.tenantId)
  return c.json(body)
})
