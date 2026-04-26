/**
 * sandbox-client.ts — typed seam between this scaffold and the
 * `@tangle-network/sandbox-sdk` runtime that owns the box.
 *
 * The scaffold ships with INTENTIONALLY-UNWIRED placeholder hooks. They
 * compile, they expose the right TypeScript shapes for the rest of the
 * app, and they fail LOUDLY rather than silently faking success. Wire
 * each TODO against the sandbox-sdk method named in the comment.
 *
 * Why placeholders and not no-ops? Because a workspace app that boots
 * with `tree: { children: [] }` looks indistinguishable from a real
 * sandbox with an empty workspace — and that's the muffled-gate
 * pattern. The hooks below either return a typed empty state with a
 * surfaced `error`, or throw on calls that mutate.
 */

import { useEffect, useState } from 'react'
import type { FileNode, TerminalLine } from './sandbox-types'

/* eslint-disable @typescript-eslint/no-unused-vars */

export interface SandboxConnectOptions {
  apiUrl: string
  token: string
  /** Sandbox / project id this app is attached to. */
  sandboxId?: string
}

/**
 * Opaque handle returned by `connectToSandbox`. Carries the SDK client
 * instance plus the params it was opened with so hooks can derive
 * sub-resources (files, terminal, etc.) without re-reading env.
 */
export interface SandboxHandle {
  apiUrl: string
  sandboxId: string | undefined
  /** Underlying sandbox-sdk client — typed `unknown` until wired. */
  client: unknown
}

/**
 * Connect to a Tangle sandbox.
 *
 * TODO: replace the body with the real sandbox-sdk constructor. The
 * canonical call shape is something like:
 *
 *   import { Sandbox } from '@tangle-network/sandbox-sdk'
 *   const client = await Sandbox.connect({ baseUrl: apiUrl, token, sandboxId })
 *
 * Until then this throws so callers don't ship a broken bundle that
 * looks alive on boot.
 */
export async function connectToSandbox(
  opts: SandboxConnectOptions,
): Promise<SandboxHandle> {
  if (!opts.apiUrl) throw new Error('connectToSandbox: apiUrl required')
  if (!opts.token) throw new Error('connectToSandbox: token required')

  // TODO(sandbox-sdk): replace with `await Sandbox.connect({ ... })`
  // and assign the resulting client into `client`.
  throw new Error(
    'connectToSandbox is unwired. See src/lib/sandbox-client.ts — replace ' +
      'this stub with the real @tangle-network/sandbox-sdk connect call.',
  )
}

export interface UseSandboxFilesResult {
  tree: FileNode
  /** Refetch the tree from the sandbox. No-op until wired. */
  refresh: () => void
  /** Surfaced rather than thrown so the FileTree can render an empty state. */
  error: Error | null
  loading: boolean
}

/**
 * Subscribe to a sandbox's file tree rooted at `root`.
 *
 * TODO(sandbox-sdk): wire to `sandbox.fs.list(root)` (or whichever
 * directory-listing call the SDK exposes) and call `sandbox.fs.watch`
 * for live updates. Until wired, returns an empty tree and a surfaced
 * "not implemented" error so the FileTree renders honestly.
 */
export function useSandboxFiles(
  sandbox: SandboxHandle | null,
  root: string,
): UseSandboxFilesResult {
  const [tree, setTree] = useState<FileNode>(() => emptyRoot(root))
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sandbox) {
      setTree(emptyRoot(root))
      setError(null)
      return
    }
    setLoading(true)
    // TODO(sandbox-sdk): replace with
    //   sandbox.client.fs.list(root).then(setTree).catch(setError)
    setError(
      new Error(
        'useSandboxFiles is unwired. Replace the stub in sandbox-client.ts ' +
          'with sandbox.fs.list / sandbox.fs.watch.',
      ),
    )
    setTree(emptyRoot(root))
    setLoading(false)
  }, [sandbox, root])

  function refresh() {
    // TODO(sandbox-sdk): re-call sandbox.fs.list(root).
  }

  return { tree, refresh, error, loading }
}

export interface UseSandboxTerminalResult {
  lines: TerminalLine[]
  /**
   * Submit a command to the sandbox PTY. Throws until wired — the read-only
   * `TerminalPanel` doesn't call this by default; it's here for apps that
   * want to upgrade to an interactive terminal.
   */
  write: (command: string) => Promise<void>
  error: Error | null
}

/**
 * Subscribe to a sandbox's terminal output stream.
 *
 * TODO(sandbox-sdk): wire to `sandbox.terminal.subscribe()` (read-side)
 * and `sandbox.terminal.exec(command)` (write-side). Until wired, returns
 * a single placeholder `system` line so the TerminalPanel renders something
 * intelligible instead of "No output yet" with no explanation.
 */
export function useSandboxTerminal(
  sandbox: SandboxHandle | null,
): UseSandboxTerminalResult {
  const [lines, setLines] = useState<TerminalLine[]>(() =>
    sandbox
      ? [
          {
            id: 'boot',
            type: 'system',
            text: 'Terminal stream unwired — wire useSandboxTerminal in sandbox-client.ts.',
          },
        ]
      : [],
  )
  const [error] = useState<Error | null>(null)

  useEffect(() => {
    if (!sandbox) {
      setLines([])
      return
    }
    // TODO(sandbox-sdk): replace with
    //   const sub = sandbox.client.terminal.subscribe((line) =>
    //     setLines((prev) => [...prev, line]),
    //   )
    //   return () => sub.unsubscribe()
  }, [sandbox])

  async function write(_command: string): Promise<void> {
    // TODO(sandbox-sdk): replace with sandbox.client.terminal.exec(command)
    throw new Error(
      'useSandboxTerminal.write is unwired. See src/lib/sandbox-client.ts.',
    )
  }

  return { lines, write, error }
}

function emptyRoot(path: string): FileNode {
  return {
    name: path.split('/').filter(Boolean).pop() ?? '/',
    path,
    type: 'directory',
    children: [],
  }
}
