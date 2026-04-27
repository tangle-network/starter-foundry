// Agent loader — discovers and loads agent packs from AGENT_PACK_DIR.
//
// A pack directory is one of two shapes:
//
//   <AGENT_PACK_DIR>/<id>/system-prompt.md   → single agent
//   <AGENT_PACK_DIR>/<id>/agent-roster.json  → multi-agent team
//
// If a directory contains BOTH, the roster wins (a team can have a default
// system prompt for context, but the roster file is the source of truth).
// If neither exists, the directory is ignored — operator can drop notes,
// READMEs, etc. without breaking discovery.
//
// Loader is pull-on-demand: `loadPack(id)` reads from disk every call. The
// system prompt itself is also lazy — `readSystemPrompt(role)` reads only
// when /chat actually invokes the role. This keeps cold start sub-millisecond
// even when AGENT_PACK_DIR holds 100+ packs.

import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { AgentPack, AgentRole, SingleAgentPack, TeamAgentPack } from '../types.js'
import { parseRoster } from './roster.js'

export class PackNotFoundError extends Error {
  constructor(public readonly packId: string) {
    super(`agent pack not found: "${packId}"`)
    this.name = 'PackNotFoundError'
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

function isValidPackId(id: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/i.test(id) && id.length <= 120
}

/** Build a SingleAgentPack from a directory containing system-prompt.md. */
function buildSingle(packDir: string, packId: string): SingleAgentPack {
  const role: AgentRole = {
    id: packId,
    systemPromptPath: join(packDir, 'system-prompt.md'),
  }
  return { kind: 'single', id: packId, role }
}

/** Resolve a pack id to an AgentPack. Throws PackNotFoundError if neither
 *  agent-roster.json nor system-prompt.md is present. */
export async function loadPack(packDir: string, packId: string): Promise<AgentPack> {
  if (!isValidPackId(packId)) {
    throw new PackNotFoundError(packId)
  }
  const dir = join(packDir, packId)
  if (!(await exists(dir))) {
    throw new PackNotFoundError(packId)
  }
  const rosterPath = join(dir, 'agent-roster.json')
  if (await exists(rosterPath)) {
    return parseRoster(dir, packId)
  }
  const promptPath = join(dir, 'system-prompt.md')
  if (await exists(promptPath)) {
    return buildSingle(dir, packId)
  }
  throw new PackNotFoundError(packId)
}

/** List every pack id under AGENT_PACK_DIR. Returns ids sorted lexicographically. */
export async function listPackIds(packDir: string): Promise<string[]> {
  if (!(await exists(packDir))) return []
  const entries = await readdir(packDir, { withFileTypes: true })
  const ids: string[] = []
  for (const e of entries) {
    if (!e.isDirectory()) continue
    if (!isValidPackId(e.name)) continue
    const dir = join(packDir, e.name)
    if (
      (await exists(join(dir, 'agent-roster.json'))) ||
      (await exists(join(dir, 'system-prompt.md')))
    ) {
      ids.push(e.name)
    }
  }
  return ids.sort()
}

/** Read a role's system prompt off disk. Lazy — only called when /chat
 *  actually fires for this role. */
export async function readSystemPrompt(role: AgentRole): Promise<string> {
  return readFile(role.systemPromptPath, 'utf8')
}

/** Resolve a role within a pack by id. Returns undefined if the role is
 *  not present (e.g. caller asked for a role that doesn't exist on the
 *  team). */
export function findRole(pack: AgentPack, roleId: string): AgentRole | undefined {
  if (pack.kind === 'single') {
    return pack.role.id === roleId ? pack.role : undefined
  }
  return pack.roles.find((r) => r.id === roleId)
}

/** Convenience: load a TeamAgentPack guaranteed to be a team, or throw. */
export function asTeam(pack: AgentPack): TeamAgentPack {
  if (pack.kind !== 'team') {
    throw new Error(`expected team pack, got single agent (id="${pack.id}")`)
  }
  return pack
}
