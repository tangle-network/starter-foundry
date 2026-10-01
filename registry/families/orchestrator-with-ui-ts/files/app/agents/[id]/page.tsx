'use client'

import Link from 'next/link'
import { notFound, useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { SandboxWorkbench } from '@tangle-network/sandbox-ui/workspace'
import { ChatComposer } from '@tangle-network/agent-app/web-react'
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

  return (
    <div className='h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]'>
      <SandboxWorkbench
        title={agent.displayName}
        subtitle={agent.description}
        status={
          agent.sandboxId ? `Sandbox ${agent.sandboxId}` : 'Unprovisioned'
        }
        session={{
          messages: session.messages,
          partMap: session.partMap,
          isStreaming: session.isStreaming,
          eyebrow: (
            <span aria-label={agent.family} title={agent.family}>
              {agent.icon ?? '\u{1F916}'}
            </span>
          ),
          headerActions: (
            <Link
              href='/'
              className='text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            >
              Back to fleet
            </Link>
          ),
          composerControls: (
            <ChatComposer
              value={composerText}
              onValueChange={setComposerText}
              onSend={handleSend}
              isStreaming={session.isStreaming}
            />
          ),
        }}
        artifacts={artifacts}
        activeArtifactId={activeArtifactId}
        onArtifactChange={setActiveArtifactId}
      />
    </div>
  )
}