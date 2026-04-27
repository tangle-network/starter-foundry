// Roster parser — turns an `agent-roster.json` file into a TeamAgentPack.
//
// Schema (agent-roster.json):
//   {
//     "description": "...",            // optional team description
//     "defaultRespondent": "role-id",  // optional — skips LLM routing
//     "roles": [
//       { "id": "support",     "systemPrompt": "support.md",     "description": "...", "model": "..." },
//       { "id": "engineering", "systemPrompt": "engineering.md", "description": "..." }
//     ]
//   }
//
// `systemPrompt` paths are resolved relative to the pack directory. They
// must exist; the loader fails loud rather than degrading silently when
// a referenced prompt is missing.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AgentRole, TeamAgentPack } from '../types.js'

interface RawRole {
  id: unknown
  systemPrompt: unknown
  description?: unknown
  model?: unknown
}

interface RawRoster {
  description?: unknown
  defaultRespondent?: unknown
  roles?: unknown
}

function isString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function parseRole(raw: unknown, packDir: string): AgentRole {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('agent-roster.json: every role must be an object')
  }
  const r = raw as RawRole
  if (!isString(r.id)) {
    throw new Error('agent-roster.json: role.id must be a non-empty string')
  }
  if (!isString(r.systemPrompt)) {
    throw new Error(`agent-roster.json: role "${r.id}".systemPrompt must be a non-empty string`)
  }
  const role: AgentRole = {
    id: r.id,
    systemPromptPath: join(packDir, r.systemPrompt),
  }
  if (isString(r.description)) role.description = r.description
  if (isString(r.model)) role.model = r.model
  return role
}

export async function parseRoster(packDir: string, packId: string): Promise<TeamAgentPack> {
  const rosterPath = join(packDir, 'agent-roster.json')
  const buf = await readFile(rosterPath, 'utf8')
  let parsed: unknown
  try {
    parsed = JSON.parse(buf)
  } catch (err) {
    throw new Error(`agent-roster.json: invalid JSON — ${(err as Error).message}`)
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('agent-roster.json: top-level must be an object')
  }
  const r = parsed as RawRoster
  if (!Array.isArray(r.roles) || r.roles.length === 0) {
    throw new Error('agent-roster.json: `roles` must be a non-empty array')
  }
  const roles = r.roles.map((raw) => parseRole(raw, packDir))
  const ids = new Set<string>()
  for (const role of roles) {
    if (ids.has(role.id)) {
      throw new Error(`agent-roster.json: duplicate role id "${role.id}"`)
    }
    ids.add(role.id)
  }
  let defaultRespondent: string | undefined
  if (r.defaultRespondent !== undefined) {
    if (!isString(r.defaultRespondent)) {
      throw new Error('agent-roster.json: defaultRespondent must be a string')
    }
    if (!ids.has(r.defaultRespondent)) {
      throw new Error(
        `agent-roster.json: defaultRespondent "${r.defaultRespondent}" not in roles[]`,
      )
    }
    defaultRespondent = r.defaultRespondent
  }
  const pack: TeamAgentPack = {
    kind: 'team',
    id: packId,
    roles,
  }
  if (defaultRespondent !== undefined) pack.defaultRespondent = defaultRespondent
  if (isString(r.description)) pack.description = r.description
  return pack
}
