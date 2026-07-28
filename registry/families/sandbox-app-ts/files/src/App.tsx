import { useEffect, useState } from 'react'
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

const SANDBOX_API_URL =
  import.meta.env.VITE_SANDBOX_API_URL ?? 'https://sandbox.tangle.tools'
const SANDBOX_API_TOKEN = import.meta.env.VITE_SANDBOX_API_TOKEN ?? ''
const SANDBOX_ID = import.meta.env.VITE_SANDBOX_ID ?? ''

export function App(): JSX.Element {
  const [sandbox, setSandbox] = useState<SandboxHandle | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [selectedContent, setSelectedContent] = useState('')
  const [connectError, setConnectError] = useState<string | null>(null)
  const { tree, read, write, error: fileError } = useSandboxFiles(sandbox, '/')
  const { lines } = useSandboxTerminal(sandbox)

  useEffect(() => {
    if (!SANDBOX_API_TOKEN || !SANDBOX_ID) {
      setConnectError('Set VITE_SANDBOX_API_TOKEN and VITE_SANDBOX_ID in .env.local.')
      return
    }
    let cancelled = false
    connectToSandbox({
      apiUrl: SANDBOX_API_URL,
      token: SANDBOX_API_TOKEN,
      sandboxId: SANDBOX_ID,
    })
      .then((handle) => {
        if (!cancelled) setSandbox(handle)
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setConnectError(cause instanceof Error ? cause.message : String(cause))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedPath) {
      setSelectedContent('')
      return
    }
    let cancelled = false
    read(selectedPath)
      .then((content) => {
        if (!cancelled) setSelectedContent(content)
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setConnectError(cause instanceof Error ? cause.message : String(cause))
        }
      })
    return () => {
      cancelled = true
    }
  }, [read, selectedPath])

  if (connectError || fileError) {
    return (
      <div className='flex h-screen items-center justify-center p-8'>
        <div className='max-w-xl space-y-3'>
          <h1 className='text-xl font-semibold'>Sandbox not connected</h1>
          <pre className='rounded bg-red-50 p-3 text-sm text-red-900'>
            {connectError ?? fileError?.message}
          </pre>
        </div>
      </div>
    )
  }

  const editor =
    APP_KIND === 'editor' || APP_KIND === 'audit-tool' ? (
      <DocumentEditorPane
        title={selectedPath ?? 'Editor'}
        backend='local'
        markdown={selectedContent}
        onChange={setSelectedContent}
        onSave={selectedPath ? (content) => write(selectedPath, content) : undefined}
      />
    ) : selectedPath ? (
      <FilePreview filename={selectedPath} content={selectedContent} />
    ) : (
      <div className='flex h-full items-center justify-center text-sm text-neutral-500'>
        Select a file from the tree
      </div>
    )

  return (
    <WorkspaceLayout
      left={
        <FileTree
          root={tree}
          selectedPath={selectedPath ?? undefined}
          onSelect={(path) => setSelectedPath(path)}
        />
      }
      leftHeader='Files'
      center={editor}
      centerHeader={`sandbox-app: ${APP_KIND}`}
      bottom={<TerminalPanel lines={lines} />}
      bottomHeader='Terminal'
    />
  )
}
