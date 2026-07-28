import { useCallback, useEffect, useState } from 'react'
import {
  createSandboxRuntimeClient,
  type FileTreeResult,
  type SandboxRuntimeClient,
} from '@tangle-network/sandbox/runtime'
import type { FileNode } from '@tangle-network/ui/files'
import type { TerminalLine } from '@tangle-network/sandbox-ui/workspace'

export interface SandboxConnectOptions {
  runtimeUrl: string
  runtimeToken: string
  sandboxId: string
}

export interface SandboxHandle {
  sandboxId: string
  runtime: SandboxRuntimeClient
}

export function connectToSandbox(opts: SandboxConnectOptions): SandboxHandle {
  if (!opts.runtimeUrl) throw new Error('connectToSandbox: runtimeUrl required')
  if (!opts.runtimeToken) throw new Error('connectToSandbox: runtimeToken required')
  if (!opts.sandboxId) throw new Error('connectToSandbox: sandboxId required')
  return {
    sandboxId: opts.sandboxId,
    runtime: createSandboxRuntimeClient({
      baseUrl: opts.runtimeUrl,
      token: opts.runtimeToken,
    }),
  }
}

export interface UseSandboxFilesResult {
  tree: FileNode
  refresh: () => void
  read: (path: string) => Promise<string>
  write: (path: string, content: string) => Promise<void>
  error: Error | null
  loading: boolean
}

export function useSandboxFiles(
  sandbox: SandboxHandle | null,
  root: string,
): UseSandboxFilesResult {
  const [tree, setTree] = useState<FileNode>(() => emptyRoot(root))
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!sandbox) {
      setTree(emptyRoot(root))
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    sandbox.runtime
      .fileTree(root)
      .then((result) => {
        if (!cancelled) setTree(toFileNode(result))
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(asError(cause))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sandbox, root, refreshVersion])

  const refresh = useCallback(() => setRefreshVersion((version) => version + 1), [])
  const read = useCallback(
    async (path: string) => {
      if (!sandbox) throw new Error('Sandbox not connected')
      const result = await sandbox.runtime.readFiles([path], { encoding: 'utf8' })
      const file = result.files[0]
      if (!file) {
        const detail = result.errors[0]?.error ?? 'file was not returned'
        throw new Error(`Failed to read ${path}: ${detail}`)
      }
      return file.content
    },
    [sandbox],
  )
  const write = useCallback(
    async (path: string, content: string) => {
      if (!sandbox) throw new Error('Sandbox not connected')
      await sandbox.runtime.writeFile(path, content)
      refresh()
    },
    [sandbox, refresh],
  )

  return { tree, refresh, read, write, error, loading }
}

export function useSandboxTerminal(sandbox: SandboxHandle | null): { lines: TerminalLine[] } {
  const [lines, setLines] = useState<TerminalLine[]>([])
  useEffect(() => {
    setLines(
      sandbox
        ? [{ id: 'connected', type: 'system', text: `Connected to ${sandbox.sandboxId}` }]
        : [],
    )
  }, [sandbox])
  return { lines }
}

function toFileNode(result: FileTreeResult): FileNode {
  const rootPath = normalizeRoot(result.root)
  const root = emptyRoot(rootPath)
  const nodes = new Map<string, FileNode>([[rootPath, root]])
  const resolvePath = (path: string): string => {
    const normalized = path.replace(/\/+/g, '/').replace(/\/$/, '')
    if (!normalized || normalized === '.') return rootPath
    if (normalized.startsWith('/')) return normalized
    return rootPath === '/' ? `/${normalized}` : `${rootPath}/${normalized}`
  }
  const ensureDirectory = (inputPath: string): FileNode => {
    const path = resolvePath(inputPath)
    const existing = nodes.get(path)
    if (existing) return existing
    const node: FileNode = {
      name: basename(path),
      path,
      type: 'directory',
      children: [],
    }
    nodes.set(path, node)
    const parentPath = dirname(path)
    const parent = parentPath === path ? root : ensureDirectory(parentPath)
    parent.children ??= []
    parent.children.push(node)
    return node
  }

  for (const path of [...result.directories].sort()) ensureDirectory(path)
  for (const file of result.files) {
    const path = resolvePath(file.path)
    const parent = ensureDirectory(dirname(path))
    parent.children ??= []
    parent.children.push({ name: basename(path), path, type: 'file', size: file.size })
  }
  sortTree(root)
  return root
}

function normalizeRoot(path: string): string {
  const normalized = path.replace(/\/+/g, '/').replace(/\/$/, '')
  if (!normalized || normalized === '.') return '/'
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

function emptyRoot(path: string): FileNode {
  return { name: basename(path) || '/', path, type: 'directory', children: [] }
}

function basename(path: string): string {
  return path.replace(/\/+$/, '').split('/').pop() ?? '/'
}

function dirname(path: string): string {
  const normalized = path.replace(/\/+$/, '')
  const index = normalized.lastIndexOf('/')
  return index <= 0 ? '/' : normalized.slice(0, index)
}

function sortTree(node: FileNode): void {
  node.children?.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  node.children?.forEach(sortTree)
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}
