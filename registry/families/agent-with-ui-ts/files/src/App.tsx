import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSdkSession, type SdkSessionEvent } from '@tangle-network/sandbox-ui/hooks'
import {
  SandboxWorkbench,
  type SandboxWorkbenchArtifact,
} from '@tangle-network/sandbox-ui/workspace'
import type { TextPart } from '@tangle-network/sandbox-ui/types'
import {
  makeArtifactStreamAdapter,
} from './lib/blocks-to-artifacts'

// AgentInvoker is the seam between this UI scaffold and whichever
// agent-runtime bundle the operator is driving. The scaffold has zero
// per-bundle knowledge — the operator wires the actual transport
// (sandbox-sdk client, fetch to /api/chat, websocket, etc.) here.
//
// Contract: invoke is given the full message history + the new user text;
// it must stream `SdkSessionEvent`s back via onEvent until the run is done.
// Returning ends the streaming state.
export interface AgentInvoker {
  invoke: (args: {
    userText: string
    onEvent: (event: SdkSessionEvent) => void
    signal: AbortSignal
  }) => Promise<void>
}

export interface AppProps {
  agentName?: string
  invoker?: AgentInvoker
}

const ENV_AGENT_NAME =
  (import.meta.env.VITE_AGENT_NAME as string | undefined) ?? '{{agentName}}'

export function App({ agentName = ENV_AGENT_NAME, invoker }: AppProps = {}) {
  const {
    messages,
    partMap,
    isStreaming,
    activeAssistantMessageId,
    appendUserMessage,
    beginAssistantMessage,
    applySdkEvent,
    failAssistantMessage,
  } = useSdkSession()

  const [activeArtifactId, setActiveArtifactId] = useState<string | undefined>()
  const adapter = useMemo(() => makeArtifactStreamAdapter(), [])
  const [artifacts, setArtifacts] = useState<SandboxWorkbenchArtifact[]>([])
  const abortRef = useRef<AbortController | null>(null)

  // Re-parse the active assistant message text on every part update and
  // hand the rebuilt SandboxWorkbenchArtifact[] to the workbench. The
  // adapter is idempotent on identical text so this is cheap.
  useEffect(() => {
    if (!activeAssistantMessageId) return
    const parts = partMap[activeAssistantMessageId] ?? []
    const assistantText = parts
      .filter((p): p is TextPart => p.type === 'text')
      .map((p) => p.text)
      .join('\n')
    const next = adapter.feed(assistantText)
    setArtifacts(next)
    if (next.length > 0 && !activeArtifactId) {
      setActiveArtifactId(next[0]!.id)
    }
  }, [activeAssistantMessageId, partMap, adapter, activeArtifactId])

  // Also re-feed on completed assistant messages so the artifact pane
  // keeps the final state once streaming ends. Walks history newest-first
  // and grabs the first assistant message with text.
  useEffect(() => {
    if (activeAssistantMessageId || isStreaming) return
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!
      if (m.role !== 'assistant') continue
      const parts = partMap[m.id] ?? []
      const text = parts
        .filter((p): p is TextPart => p.type === 'text')
        .map((p) => p.text)
        .join('\n')
      if (!text) continue
      const next = adapter.feed(text)
      setArtifacts(next)
      if (next.length > 0 && !activeArtifactId) {
        setActiveArtifactId(next[0]!.id)
      }
      break
    }
  }, [messages, partMap, isStreaming, activeAssistantMessageId, adapter, activeArtifactId])

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      appendUserMessage({ content: trimmed })
      const assistantId = beginAssistantMessage()

      // No invoker wired? Surface a helpful failure rather than a silent
      // stuck-streaming spinner.
      if (!invoker) {
        failAssistantMessage(
          'No agent invoker wired. See README — pass an `invoker` prop that ' +
            'streams SdkSessionEvents from your sandbox-sdk client.',
          { messageId: assistantId },
        )
        return
      }

      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac

      try {
        await invoker.invoke({
          userText: trimmed,
          signal: ac.signal,
          onEvent: (event) => applySdkEvent(event, { messageId: assistantId }),
        })
      } catch (err) {
        if (ac.signal.aborted) return
        const reason = err instanceof Error ? err.message : String(err)
        failAssistantMessage(reason, { messageId: assistantId })
      }
    },
    [appendUserMessage, beginAssistantMessage, applySdkEvent, failAssistantMessage, invoker],
  )

  useEffect(() => () => abortRef.current?.abort(), [])

  return (
    <SandboxWorkbench
      title={agentName}
      subtitle='Single-agent runtime — chat + artifact pane'
      session={{
        messages,
        partMap,
        isStreaming,
        onSend: handleSend,
      }}
      artifacts={artifacts}
      activeArtifactId={activeArtifactId}
      onArtifactChange={setActiveArtifactId}
    />
  )
}
