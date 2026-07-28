import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSdkSession, type SdkSessionEvent } from '@tangle-network/sandbox-ui/hooks'
import { AgentComposer } from '@tangle-network/sandbox-ui/chat'
import {
  SandboxWorkbench,
  type SandboxWorkbenchArtifact,
} from '@tangle-network/sandbox-ui/workspace'
import type { TextPart } from '@tangle-network/sandbox-ui/types'
import { makeArtifactStreamAdapter } from './lib/blocks-to-artifacts'

// Connect this UI to Sandbox.streamPrompt(), an HTTP route, or another
// transport by implementing AgentInvoker.
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

const ENV_AGENT_NAME = (import.meta.env.VITE_AGENT_NAME as string | undefined) ?? 'my-agent'

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
  const [composerText, setComposerText] = useState('')
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

      if (!invoker) {
        failAssistantMessage(
          'No agent invoker configured. Pass an `invoker` prop that streams Sandbox events.',
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

  const handleSubmit = useCallback(() => {
    const text = composerText.trim()
    if (!text) return
    setComposerText('')
    void handleSend(text)
  }, [composerText, handleSend])

  return (
    <SandboxWorkbench
      title={agentName}
      subtitle="Single-agent runtime — chat + artifact pane"
      session={{
        messages,
        partMap,
        isStreaming,
        composerControls: (
          <AgentComposer
            value={composerText}
            onChange={setComposerText}
            onSubmit={handleSubmit}
            busy={isStreaming}
            onCancel={() => abortRef.current?.abort()}
          />
        ),
      }}
      artifacts={artifacts}
      activeArtifactId={activeArtifactId}
      onArtifactChange={setActiveArtifactId}
    />
  )
}
