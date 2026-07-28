'use client'

import Link from 'next/link'
import { notFound, useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { SandboxWorkbench } from '@tangle-network/sandbox-ui/workspace'
import { AgentComposer } from '@tangle-network/sandbox-ui/chat'
import type { SandboxWorkbenchArtifact } from '@tangle-network/sandbox-ui/workspace'
import { useSdkSession } from '@tangle-network/sandbox-ui/sdk-hooks'
import { findAgent } from '../../../src/lib/agent-roster'
import { makeArtifactStreamAdapter } from '../../../src/lib/blocks-to-artifacts'

// === Session lifecycle =====================================================
//
// `useSdkSession()` is mounted INSIDE this route component. Next.js App
// Router unmounts the component when the user navigates away (e.g. back to
// /agents/<other> or /), so the in-memory session is dropped. Each visit to
// /agents/[id] starts fresh.
//
// This is the right default for a scaffold:
//   • zero coupling — no global session registry to debug
//   • cheap memory — N agents idle in the sidebar consume nothing
//   • obvious semantics — closing a tab clears the conversation
//
// If you need persistence across navigation, lift the session map into a
// context provider in app/layout.tsx (one useSdkSession() per AgentEntry,
// keyed by id) and read from it here. See README.md → 'Session lifecycle'.
//
// To resume across reloads, persist session messages in your application and
// hydrate them with `replaceHistory` on mount.

export default function AgentChatPage() {
  const params = useParams<{ id: string }>()
  const agent = findAgent(params.id)

  // App Router signals 404 via notFound(); call BEFORE any hooks that depend
  // on `agent` to keep the hooks-order rule happy.
  if (!agent) {
    notFound()
  }

  const session = useSdkSession()
  const [artifacts, setArtifacts] = useState<SandboxWorkbenchArtifact[]>([])
  const [activeArtifactId, setActiveArtifactId] = useState<string | undefined>()
  const [composerText, setComposerText] = useState('')

  // One adapter per route mount — the closure preserves last-text/last-artifacts
  // across re-renders so partial streams don't cause flicker.
  const adapter = useMemo(() => makeArtifactStreamAdapter(), [])

  // Re-feed the adapter whenever the active assistant message's text changes.
  useEffect(() => {
    const id = session.activeAssistantMessageId
    if (!id) return
    const parts = session.partMap[id] ?? []
    const text = parts
      .filter((part) => part.type === 'text')
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join('')
    const next = adapter.feed(text)
    setArtifacts(next)
    if (!activeArtifactId && next.length > 0) {
      setActiveArtifactId(next[0].id)
    }
  }, [session.partMap, session.activeAssistantMessageId, adapter, activeArtifactId])

  // TODO(operator): wire onSend to your sandbox transport. The agent's
  // sandboxId lives on `agent.sandboxId` once provisioned (see
  // lib/agent-roster.ts → 'Wiring sandboxId').
  const handleSend = (text: string) => {
    session.appendUserMessage({ content: text })
    session.beginAssistantMessage()
    session.applySdkEvent({
      type: 'message.part.updated',
      data: {
        part: {
          type: 'text',
          text: `[stub] Wire app/agents/[id]/page.tsx → onSend to your sandbox transport. Received: ${text}`,
        },
      },
    })
    session.completeAssistantMessage()
  }

  const handleSubmit = () => {
    const text = composerText.trim()
    if (!text) return
    setComposerText('')
    handleSend(text)
  }

  return (
    <div className='flex min-h-screen flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]'>
      <header className='flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4'>
        <div className='flex items-center gap-3'>
          <Link
            href='/'
            className='text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
          >
            ← Back to fleet
          </Link>
          <span className='text-2xl' aria-hidden>
            {agent.icon ?? '🤖'}
          </span>
          <div>
            <h1 className='text-lg font-semibold'>{agent.displayName}</h1>
            <p className='font-mono text-xs text-[hsl(var(--muted-foreground))]'>
              {agent.family}
              {agent.sandboxId ? ` · ${agent.sandboxId}` : ' · unprovisioned'}
            </p>
          </div>
        </div>
      </header>

      <div className='flex-1'>
        <SandboxWorkbench
          title={agent.displayName}
          subtitle={agent.description}
          session={{
            messages: session.messages,
            partMap: session.partMap,
            isStreaming: session.isStreaming,
            composerControls: (
              <AgentComposer
                value={composerText}
                onChange={setComposerText}
                onSubmit={handleSubmit}
                busy={session.isStreaming}
              />
            ),
          }}
          artifacts={artifacts}
          activeArtifactId={activeArtifactId}
          onArtifactChange={setActiveArtifactId}
        />
      </div>
    </div>
  )
}
