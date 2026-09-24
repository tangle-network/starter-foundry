// agent-base:mcp-registry — runtime helpers for MCP server registration.
//
// At deploy time the bundle ships `<workspace.root>/.mcp.json` with the
// templated server set. Most agents only need that static file: Claude Code
// and OpenCode both auto-discover `.mcp.json` from the workspace root.
//
// These helpers exist for the cases where the resident agent must mutate the
// registry at runtime — adding a server after a credential is minted, or
// pruning servers it doesn't need from a starter template. Composes with
// `agent-base:secure` (load credentials via `loadSecret(...)` from
// `src/lib/secure/secrets.ts` rather than embedding them in `.mcp.json`).
//
// File contract verified against:
// - Claude Code: https://docs.claude.com/en/docs/claude-code/mcp
// - OpenCode  : `AgentProfile.mcp` shape in `@tangle-network/sandbox/agent-profile.ts`

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Shape of one MCP server entry. Mirrors the `AgentProfileMcpServer` contract
 * from `@tangle-network/sandbox` (provider-neutral) plus the documented
 * Claude Code / OpenCode native fields.
 */
export interface McpServerConfig {
  transport?: 'stdio' | 'sse' | 'http'
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  url?: string
  headers?: Record<string, string>
  enabled?: boolean
}

/**
 * Top-level shape of `.mcp.json`. Both Claude Code and OpenCode read
 * `mcpServers` as the top-level key.
 */
export interface McpRegistry {
  mcpServers: Record<string, McpServerConfig>
}

/**
 * Default registry path inside the sandbox workspace.
 *
 * The deploy script's `--harness <name>` flag may override this — callers that
 * need the actual path at runtime should read it from the bundle's manifest
 * `defaults.mcpRegistryPath` rather than hardcoding.
 */
export const DEFAULT_REGISTRY_PATH = '/home/agent/.mcp.json'

/**
 * Read the current registry from disk. Returns an empty `mcpServers` map if
 * the file does not exist.
 */
export async function readRegistry(path: string = DEFAULT_REGISTRY_PATH): Promise<McpRegistry> {
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as Partial<McpRegistry>
    return { mcpServers: parsed.mcpServers ?? {} }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code
    if (code === 'ENOENT') return { mcpServers: {} }
    throw err
  }
}

/**
 * Atomically rewrite the registry on disk. Writes to a sibling tempfile and
 * renames into place to avoid the harness reading a half-written file.
 */
export async function writeRegistry(
  registry: McpRegistry,
  path: string = DEFAULT_REGISTRY_PATH,
): Promise<void> {
  const tmp = join(path + '.tmp')
  await writeFile(tmp, JSON.stringify(registry, null, 2) + '\n', 'utf8')
  const { rename } = await import('node:fs/promises')
  await rename(tmp, path)
}

/**
 * Add (or overwrite) a single server entry. Returns the updated registry.
 *
 * This is intentionally an explicit overwrite — the caller must opt out of
 * replacement by checking `name in registry.mcpServers` first if they want
 * a non-destructive add.
 */
export async function addServer(
  name: string,
  config: McpServerConfig,
  path: string = DEFAULT_REGISTRY_PATH,
): Promise<McpRegistry> {
  const registry = await readRegistry(path)
  registry.mcpServers[name] = config
  await writeRegistry(registry, path)
  return registry
}

/**
 * Remove a single server entry by name. No-op when the name is absent.
 */
export async function removeServer(
  name: string,
  path: string = DEFAULT_REGISTRY_PATH,
): Promise<McpRegistry> {
  const registry = await readRegistry(path)
  delete registry.mcpServers[name]
  await writeRegistry(registry, path)
  return registry
}

/**
 * Keep only the named servers; drop everything else. Used at agent startup
 * when the bundle ships a starter template with N servers and the resident
 * agent only needs a subset.
 */
export async function keepServers(
  names: readonly string[],
  path: string = DEFAULT_REGISTRY_PATH,
): Promise<McpRegistry> {
  const registry = await readRegistry(path)
  const keep = new Set(names)
  for (const existing of Object.keys(registry.mcpServers)) {
    if (!keep.has(existing)) delete registry.mcpServers[existing]
  }
  await writeRegistry(registry, path)
  return registry
}
