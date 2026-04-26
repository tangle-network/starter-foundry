import { useState } from 'react'
import { WorkspaceLayout, TerminalPanel } from '@tangle-network/sandbox-ui/workspace'
import { FileTree, FilePreview } from '@tangle-network/sandbox-ui/files'
import { DocumentEditorPane } from '@tangle-network/sandbox-ui/editor'
import {
  connectToSandbox,
  useSandboxFiles,
  useSandboxTerminal,
  type SandboxHandle,
} from './lib/sandbox-client'

const APP_KIND = (import.meta.env.VITE_APP_KIND ?? 'editor') as
  | 'editor'
  | 'audit-tool'
  | 'repl'
  | 'file-browser'

const SANDBOX_API_URL = import.meta.env.VITE_SANDBOX_API_URL ?? 'https://api.tangle.tools'
const SANDBOX_API_TOKEN = import.meta.env.VITE_SANDBOX_API_TOKEN ?? ''

export function App(): JSX.Element {
  const [sandbox, setSandbox] = useState<SandboxHandle | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)

  // Connect on mount. Operator's job to actually wire this end-to-end against
  // their sandbox-sdk transport — `connectToSandbox` returns a typed handle
  // with TODO seams documented in lib/sandbox-client.ts.
  useState(() => {
    if (!SANDBOX_API_TOKEN) {
      setConnectError(
        'VITE_SANDBOX_API_TOKEN is empty — set it in .env.local. ' +
          'See README.md for the wiring guide.',
      )
      return
    }
    connectToSandbox({ apiUrl: SANDBOX_API_URL, token: SANDBOX_API_TOKEN })
      .then(setSandbox)
      .catch((err) => setConnectError(err instanceof Error ? err.message : String(err)))
  })

  const { tree } = useSandboxFiles(sandbox, '/')
  const { lines } = useSandboxTerminal(sandbox)

  if (connectError) {
    return (
      <div className="flex h-screen items-center justify-center p-8">
        <div className="max-w-xl space-y-3">
          <h1 className="text-xl font-semibold">Sandbox not connected</h1>
          <pre className="rounded bg-red-50 p-3 text-sm text-red-900">{connectError}</pre>
          <p className="text-sm text-neutral-600">
            See README.md → "Required env vars" for setup.
          </p>
        </div>
      </div>
    )
  }

  const directoryPane = (
    <FileTree
      tree={tree}
      selectedPath={selectedPath}
      onSelect={(node) => setSelectedPath(node.path)}
    />
  )

  const centerPane =
    APP_KIND === 'editor' || APP_KIND === 'audit-tool' ? (
      <DocumentEditorPane backend="local" initialContent="" />
    ) : selectedPath ? (
      <FilePreview path={selectedPath} sandbox={sandbox} />
    ) : (
      <div className="flex h-full items-center justify-center text-sm text-neutral-500">
        Select a file from the tree
      </div>
    )

  const bottomPane = (
    <TerminalPanel
      lines={lines.length > 0 ? lines : [{ id: 'init', text: '$ sandbox attached', type: 'system' }]}
    />
  )

  return (
    <WorkspaceLayout
      title={`sandbox-app · ${APP_KIND}`}
      directoryPane={directoryPane}
      centerPane={centerPane}
      bottomPane={bottomPane}
    />
  )
}
