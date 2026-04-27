// ChatPanel — minimal chat surface that POSTs to /api/chat/:agent.
//
// This component is intentionally thin. For a richer experience (streaming
// tokens, artifact pane, message reducers), swap the body for the
// `SandboxWorkbench` from `@tangle-network/sandbox-ui` and wire its
// invoker prop into postChat() — the same pattern as agent-with-ui-ts.

import { useCallback, useState } from 'react'
import { postChat } from '../lib/api'
import type { ChatResponse } from '../../shared/schema'

interface Message {
  role: 'user' | 'assistant'
  content: string
  blocks?: ChatResponse['blocks']
}

export interface ChatPanelProps {
  agentId: string
}

export function ChatPanel({ agentId }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const text = input.trim()
      if (!text || sending) return
      setError(null)
      setSending(true)

      const next: Message[] = [...messages, { role: 'user', content: text }]
      setMessages(next)
      setInput('')

      const res = await postChat(agentId, {
        message: text,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: false,
      })
      setSending(false)

      if (!res.ok) {
        setError(`chat failed (${res.status ?? 'unknown'}): ${res.error}`)
        return
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.value.content, blocks: res.value.blocks },
      ])
    },
    [agentId, input, messages, sending],
  )

  return (
    <div className='chat-panel'>
      {error ? <div className='error-banner'>{error}</div> : null}
      <div className='chat-log' aria-live='polite'>
        {messages.length === 0 ? (
          <p className='chat-empty'>Send a message to begin.</p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`chat-message ${m.role}`}>
              <div className='role'>{m.role}</div>
              <div className='content'>{m.content}</div>
              {m.blocks && m.blocks.length > 0 ? (
                <details>
                  <summary>{m.blocks.length} block(s)</summary>
                  <pre>{JSON.stringify(m.blocks, null, 2)}</pre>
                </details>
              ) : null}
            </div>
          ))
        )}
      </div>
      <form className='chat-form' onSubmit={handleSend}>
        <input
          aria-label='message input'
          type='text'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          placeholder='Type a message…'
        />
        <button type='submit' disabled={sending || !input.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
