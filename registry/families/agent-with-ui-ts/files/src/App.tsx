import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSdkSession, type SdkSessionEvent } from '@tangle-network/sandbox-ui/hooks'
import { AgentComposer } from '@tangle-network/sandbox-ui/chat'
import {
  SandboxWorkbench,
  type SandboxWorkbenchArtifact,
} from '@tangle-network/sandbox-ui/workspace'
import type { TextPart } from '@tangle-network/sandbox-ui/types'
import { makeArtifactStreamAdapter } from './lib/blocks-to-artifacts'
import { serverAgentInvoker } from './lib/agent-client'

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

const ENV_AGENT_NAME =
  (import.meta.env.VITE_AGENT_NAME as string | undefined) ?? '{{agentName}}'

interface ActiveRun {
  controller: AbortController
  messageId: string
}

export function App({
  agentName = ENV_AGENT_NAME,
  invoker = serverAgentInvoker,
}: AppProps = {}) {
  const {
    messages,
    partMap,
    isStreaming,
    activeAssistantMessageId,
    appendUserMessage,
    beginAssistantMessage,
    applySdkEvent,
    completeAssistantMessage,
    failAssistantMessage,
  } = useSdkSession()

  const [activeArtifactId, setActiveArtifactId] = useState<string | undefined>()
  const [composerText, setComposerText] = useState('')
  const adapter = useMemo(() => makeArtifactStreamAdapter(), [])
  const [artifacts, setArtifacts] = useState<SandboxWorkbenchArtifact[]>([])
  const activeRunRef = useRef<ActiveRun | null>(null)

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

      const previous = activeRunRef.current
      if (previous) {
        activeRunRef.current = null
        previous.controller.abort()
        completeAssistantMessage({ messageId: previous.messageId })
      }

      appendUserMessage({ content: trimmed })
      const assistantId = beginAssistantMessage()

      if (!invoker) {
        failAssistantMessage(
          'No agent invoker configured. Pass an `invoker` prop that streams Sandbox events.',
          { messageId: assistantId },
        )
        return
      }

      const controller = new AbortController()
      activeRunRef.current = { controller, messageId: assistantId }

      try {
        await invoker.invoke({
          userText: trimmed,
          signal: controller.signal,
          onEvent: (event) => {
            if (activeRunRef.current?.controller === controller) {
              applySdkEvent(event, { messageId: assistantId })
            }
          },
        })
      } catch (err) {
        if (controller.signal.aborted) return
        const reason = err instanceof Error ? err.message : String(err)
        failAssistantMessage(reason, { messageId: assistantId })
      } finally {
        if (activeRunRef.current?.controller === controller) {
          activeRunRef.current = null
          completeAssistantMessage({ messageId: assistantId })
        }
      }
    },
    [
      appendUserMessage,
      beginAssistantMessage,
      applySdkEvent,
      completeAssistantMessage,
      failAssistantMessage,
      invoker,
    ],
  )

  const handleCancel = useCallback(() => {
    const active = activeRunRef.current
    if (!active) return
    activeRunRef.current = null
    active.controller.abort()
    completeAssistantMessage({ messageId: active.messageId })
  }, [completeAssistantMessage])

  useEffect(
    () => () => {
      activeRunRef.current?.controller.abort()
      activeRunRef.current = null
    },
    [],
  )

  const handleSubmit = useCallback(() => {
    const text = composerText.trim()
    if (!text) return
    setComposerText('')
    void handleSend(text)
  }, [composerText, handleSend])

  return (
    <SandboxWorkbench
      title={agentName}
      subtitle='Single-agent runtime — chat + artifact pane'
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
            onCancel={handleCancel}
          />
        ),
      }}
      artifacts={artifacts}
      activeArtifactId={activeArtifactId}
      onArtifactChange={setActiveArtifactId}
    />
  )
}
