import { useMemo } from 'react'
import type { NormalizedEvent } from '../lib/event-types'

interface ChatPairProps {
  userPrompt: string
  events: NormalizedEvent[]
  // When false, hide the streaming spinner (used during replay).
  isStreaming: boolean
}

interface AccumulatedText {
  text: string
  reasoning: string
  finalText?: string
}

// Walks the event log and reconstructs the assistant response state at the
// far end of the buffer. Streaming `delta`s are already accumulated in
// part.text by sandbox-stream's normalizer, so we just take the latest
// snapshot per part type.
export function accumulateAssistantText(events: NormalizedEvent[]): AccumulatedText {
  let text = ''
  let reasoning = ''
  let finalText: string | undefined
  for (const evt of events) {
    const e = evt.event
    if (e.type === 'message.part.updated') {
      const data = e.data as { part: { type: string; text: string } }
      if (data.part.type === 'text') text = data.part.text
      else if (data.part.type === 'reasoning') reasoning = data.part.text
    } else if (e.type === 'result') {
      const data = e.data as { finalText?: string }
      if (data.finalText) finalText = data.finalText
    }
  }
  return { text, reasoning, finalText }
}

export function ChatPair({ userPrompt, events, isStreaming }: ChatPairProps) {
  const acc = useMemo(() => accumulateAssistantText(events), [events])
  const displayText = acc.finalText ?? acc.text

  return (
    <div className='chat-pair'>
      <article className='chat-pair__msg chat-pair__msg--user'>
        <header>You</header>
        <pre>{userPrompt || '(no prompt yet)'}</pre>
      </article>
      <article className='chat-pair__msg chat-pair__msg--assistant'>
        <header>
          Agent
          {isStreaming ? (
            <span className='chat-pair__streaming'> streaming…</span>
          ) : null}
          {acc.finalText ? (
            <span className='chat-pair__locked'> final</span>
          ) : null}
        </header>
        {acc.reasoning ? (
          <details className='chat-pair__reasoning'>
            <summary>reasoning ({acc.reasoning.length} chars)</summary>
            <pre>{acc.reasoning}</pre>
          </details>
        ) : null}
        <pre>{displayText || (isStreaming ? '…' : '(no response yet)')}</pre>
      </article>
    </div>
  )
}
