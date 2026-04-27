import { useEffect, useRef } from 'react'
import type { NormalizedEvent } from '../lib/event-types'

interface EventStreamProps {
  events: NormalizedEvent[]
  // Bound the rendered window — agent runs can emit thousands of events.
  // Fits the "~50 most recent" requirement and keeps DOM cheap.
  windowSize?: number
  selectedIdx?: number
  onSelect?: (idx: number) => void
  autoScroll?: boolean
}

const TYPE_COLORS: Record<string, string> = {
  'message.part.updated': '#7dd3fc', // sky-300
  status: '#fcd34d', // amber-300
  'model-processing': '#c4b5fd', // violet-300
  result: '#86efac', // green-300
  'trace.id': '#94a3b8', // slate-400
  error: '#fca5a5', // red-300
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function summarizeEvent(evt: NormalizedEvent): string {
  const e = evt.event
  switch (e.type) {
    case 'message.part.updated': {
      const data = e.data as { part: { type: string; text: string } }
      const preview = data.part.text.slice(-60).replace(/\s+/g, ' ')
      return `${data.part.type} • "${preview}"`
    }
    case 'status': {
      const data = e.data as { status: string; detail?: string }
      return data.detail ? `${data.status} — ${data.detail}` : data.status
    }
    case 'model-processing': {
      const data = e.data as { phase: string; elapsedMs?: number }
      return data.elapsedMs !== undefined
        ? `${data.phase} (${formatElapsed(data.elapsedMs)})`
        : data.phase
    }
    case 'result': {
      const data = e.data as { tokenUsage?: { inputTokens: number; outputTokens: number } }
      if (!data.tokenUsage) return 'result'
      return `result • in=${data.tokenUsage.inputTokens} out=${data.tokenUsage.outputTokens}`
    }
    case 'trace.id': {
      const data = e.data as { traceId: string }
      return data.traceId
    }
    case 'error': {
      const data = e.data as { message: string }
      return data.message
    }
    default:
      return JSON.stringify(e.data ?? {}).slice(0, 80)
  }
}

export function EventStream({
  events,
  windowSize = 50,
  selectedIdx,
  onSelect,
  autoScroll = true,
}: EventStreamProps) {
  const tailRef = useRef<HTMLDivElement | null>(null)
  const visible = events.slice(-windowSize)

  useEffect(() => {
    if (!autoScroll) return
    tailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [events.length, autoScroll])

  if (events.length === 0) {
    return (
      <div className='event-stream event-stream--empty'>
        <p>No events yet. Send a prompt to start a run.</p>
      </div>
    )
  }

  return (
    <div className='event-stream'>
      <header className='event-stream__header'>
        <span>Events ({events.length})</span>
        {events.length > windowSize ? (
          <span className='event-stream__overflow'>
            showing last {windowSize}
          </span>
        ) : null}
      </header>
      <ol className='event-stream__list'>
        {visible.map((evt) => {
          const isSelected = evt.eventIdx === selectedIdx
          const color = TYPE_COLORS[evt.event.type] ?? '#cbd5e1'
          return (
            <li
              key={evt.eventIdx}
              className={
                'event-stream__row' + (isSelected ? ' event-stream__row--selected' : '')
              }
              onClick={() => onSelect?.(evt.eventIdx)}
            >
              <span className='event-stream__idx'>#{evt.eventIdx}</span>
              <span className='event-stream__elapsed'>{formatElapsed(evt.elapsedMs)}</span>
              <span className='event-stream__type' style={{ color }}>
                {evt.event.type}
              </span>
              <span className='event-stream__summary'>{summarizeEvent(evt)}</span>
            </li>
          )
        })}
        <div ref={tailRef} />
      </ol>
    </div>
  )
}
