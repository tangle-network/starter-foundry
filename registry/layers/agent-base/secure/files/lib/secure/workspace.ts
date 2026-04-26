// workspace — sandboxed filesystem per agent. All paths are resolved
// under /workspace/<agent-id>/. Path-traversal rejected. /sensitive/
// requires a read capability; other paths are agent-local read/write.
//
// Threat: an agent author writes `workspace.read('../../etc/passwd')`.
// The path canonicalizer rejects any resolved path that escapes the
// agent root, with an audit-logged event.

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, normalize, relative, resolve } from 'node:path'
import { audit } from './audit.js'
import { identity } from './identity.js'

const WORKSPACE_ROOT = process.env.AGENT_WORKSPACE_ROOT ?? '/workspace'
const SENSITIVE_PREFIX = 'sensitive/'

function agentRoot(): string {
  const id = identity.current().agentId
  const root = resolve(WORKSPACE_ROOT, id)
  mkdirSync(root, { recursive: true })
  return root
}

function resolveSafe(rel: string): string {
  const root = agentRoot()
  const normalized = normalize(rel.replace(/^\/+/, ''))
  const target = resolve(root, normalized)
  // Path-traversal check: target must remain inside agentRoot.
  const between = relative(root, target)
  if (between.startsWith('..') || between === '..' || between.startsWith('/')) {
    audit.log({ event: 'workspace.escape-attempt', target: rel })
    throw new Error(`path-traversal rejected: ${rel}`)
  }
  return target
}

function isSensitive(rel: string): boolean {
  return normalize(rel.replace(/^\/+/, '')).startsWith(SENSITIVE_PREFIX)
}

function checkSensitiveCapability(rel: string, op: 'read' | 'write'): void {
  if (!isSensitive(rel)) return
  // Sensitive zone requires the agent to have the 'sensitive-fs' capability.
  // We check the current identity's claims; in production this comes from
  // the signed identity's capability list.
  const id = identity.current()
  const caps = id.capabilities ?? []
  if (!caps.includes('sensitive-fs')) {
    audit.log({ event: 'workspace.sensitive-denied', target: rel, payload: { op } })
    throw new Error(`sensitive zone access denied: ${rel} (agent lacks 'sensitive-fs' capability)`)
  }
}

function hashContent(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

export const workspace = {
  read(rel: string): string {
    checkSensitiveCapability(rel, 'read')
    const abs = resolveSafe(rel)
    const content = readFileSync(abs, 'utf8')
    audit.log({ event: 'workspace.read', target: rel, payload: { hash: hashContent(content), bytes: content.length } })
    return content
  },

  write(rel: string, content: string): void {
    checkSensitiveCapability(rel, 'write')
    const abs = resolveSafe(rel)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, content)
    audit.log({ event: 'workspace.write', target: rel, payload: { hash: hashContent(content), bytes: content.length } })
  },

  list(prefix: string = ''): string[] {
    checkSensitiveCapability(prefix, 'read')
    const base = prefix ? resolveSafe(prefix) : agentRoot()
    if (!statSync(base, { throwIfNoEntry: false })?.isDirectory()) return []
    const out: string[] = []
    function walk(dir: string, relPath: string): void {
      for (const name of readdirSync(dir)) {
        const abs = join(dir, name)
        const rel = relPath ? `${relPath}/${name}` : name
        const st = statSync(abs)
        if (st.isDirectory()) walk(abs, rel)
        else out.push(rel)
      }
    }
    walk(base, prefix.replace(/\/$/, ''))
    audit.log({ event: 'workspace.list', target: prefix || '/', payload: { count: out.length } })
    return out
  },

  /** Internal — used by audit module to write its own log without recursing. */
  _rawWrite(rel: string, content: string): void {
    const abs = resolveSafe(rel)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, content)
  },
}
