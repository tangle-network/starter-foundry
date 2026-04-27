// GET /agents — list every pack discoverable under AGENT_PACK_DIR.
//
// Authenticated (the auth middleware in src/index.ts gates this). The
// response shape is stable: { agents: [{ id, kind, description?, roles?,
// defaultRespondent? }] }. Consumers (CLIs, Slack bots, custom frontends)
// build their UX on this contract.

import { Hono } from 'hono'
import { AgentsListResponseSchema } from '../schema.js'
import { listPackIds, loadPack } from '../lib/agent-loader.js'

export interface AgentsDeps {
  packDir: string
}

export function buildAgentsRoute(deps: AgentsDeps): Hono {
  const app = new Hono()

  app.get('/', async (c) => {
    const ids = await listPackIds(deps.packDir)
    const summaries = await Promise.all(
      ids.map(async (id) => {
        try {
          const pack = await loadPack(deps.packDir, id)
          if (pack.kind === 'single') {
            return { id: pack.id, kind: 'single' as const }
          }
          const summary: {
            id: string
            kind: 'team'
            description?: string
            roles?: Array<{ id: string; description?: string }>
            defaultRespondent?: string
          } = {
            id: pack.id,
            kind: 'team',
            roles: pack.roles.map((r) =>
              r.description !== undefined
                ? { id: r.id, description: r.description }
                : { id: r.id },
            ),
          }
          if (pack.description !== undefined) summary.description = pack.description
          if (pack.defaultRespondent !== undefined) {
            summary.defaultRespondent = pack.defaultRespondent
          }
          return summary
        } catch {
          // Skip packs we can't load — they're likely malformed. The
          // /agents endpoint must never throw on one bad pack.
          return null
        }
      }),
    )
    const body = AgentsListResponseSchema.parse({
      agents: summaries.filter((s) => s !== null),
    })
    return c.json(body)
  })

  app.get('/:id', async (c) => {
    const id = c.req.param('id')
    try {
      const pack = await loadPack(deps.packDir, id)
      if (pack.kind === 'single') {
        return c.json({ id: pack.id, kind: 'single' })
      }
      return c.json({
        id: pack.id,
        kind: 'team',
        description: pack.description,
        defaultRespondent: pack.defaultRespondent,
        roles: pack.roles.map((r) => ({ id: r.id, description: r.description })),
      })
    } catch {
      return c.json({ error: 'agent pack not found', id }, 404)
    }
  })

  return app
}
