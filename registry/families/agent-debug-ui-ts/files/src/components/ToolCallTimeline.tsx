import { useMemo } from 'react'
import type { MessagePart, NormalizedEvent } from '../lib/event-types'
import { extractToolPart } from '../lib/event-types'

interface ToolCallTimelineProps {
  events: NormalizedEvent[]
  selectedToolCallId?: string
  onSelect?: (toolCallId: string, eventIdx: number) => void
}

interface ToolCallSpan {
  toolCallId: string
  toolName: string
  firstSeenIdx: number
  firstSeenAt: number
  lastSeenAt: number
  state: MessagePart['state']
  args: unknown
  result: unknown
}

// Walk the event log, fold every tool part by toolCallId. Each span
// captures its first/last appearance + final state — exactly what you
// want for a horizontal duration bar.
export function aggregateToolCalls(events: NormalizedEvent[]): ToolCallSpan[] {
  const byId = new Map<string, ToolCallSpan>()
  // Synthetic id counter for tool parts that arrive without a toolCallId
  // — rare, but we still want to surface them rather than collapse them
  // all under a single "anon" key.
  let anonCounter = 0
  for (const evt of events) {
    const part = extractToolPart(evt.event)
    if (!part) continue
    const id = part.toolCallId ?? `anon:${anonCounter++}`
    const existing = byId.get(id)
    if (!existing) {
      byId.set(id, {
        toolCallId: id,
        toolName: part.toolName ?? '<unknown-tool>',
        firstSeenIdx: evt.eventIdx,
        firstSeenAt: evt.receivedAt,
        lastSeenAt: evt.receivedAt,
        state: part.state ?? 'pending',
        args: part.args,
        result: part.result,
      })
    } else {
      existing.lastSeenAt = evt.receivedAt
      // Latest update wins — args are usually fixed but tool runtimes can
      // re-emit refined argument shapes.
      if (part.toolName) existing.toolName = part.toolName
      if (part.state) existing.state = part.state
      if (part.args !== undefined) existing.args = part.args
      if (part.result !== undefined) existing.result = part.result
    }
  }
  return [...byId.values()].sort((a, b) => a.firstSeenIdx - b.firstSeenIdx)
}

const STATE_COLORS: Record<NonNullable<MessagePart['state']>, string> = {
  pending: '#94a3b8',
  running: '#7dd3fc',
  completed: '#86efac',
  failed: '#fca5a5',
}

export function ToolCallTimeline({
  events,
  selectedToolCallId,
  onSelect,
}: ToolCallTimelineProps) {
  const spans = useMemo(() => aggregateToolCalls(events), [events])
  const totalSpan = useMemo(() => {
    if (spans.length === 0) return 0
    const min = spans[0]!.firstSeenAt
    const max = Math.max(...spans.map((s) => s.lastSeenAt))
    return Math.max(1, max - min)
  }, [spans])
  const origin = spans[0]?.firstSeenAt ?? 0

  if (spans.length === 0) {
    return (
      <div className='tool-timeline tool-timeline--empty'>
        <p>No tool calls yet.</p>
      </div>
    )
  }

  return (
    <div className='tool-timeline'>
      <header className='tool-timeline__header'>
        Tool calls ({spans.length})
      </header>
      <ol className='tool-timeline__list'>
        {spans.map((span) => {
          const offsetPct = ((span.firstSeenAt - origin) / totalSpan) * 100
          const widthPct = Math.max(
            2,
            ((span.lastSeenAt - span.firstSeenAt) / totalSpan) * 100,
          )
          const color = STATE_COLORS[span.state ?? 'pending']
          const isSelected = span.toolCallId === selectedToolCallId
          const durationMs = span.lastSeenAt - span.firstSeenAt
          return (
            <li
              key={span.toolCallId}
              className={
                'tool-timeline__row' +
                (isSelected ? ' tool-timeline__row--selected' : '')
              }
              onClick={() => onSelect?.(span.toolCallId, span.firstSeenIdx)}
            >
              <div className='tool-timeline__label'>
                <strong>{span.toolName}</strong>
                <span className='tool-timeline__state' style={{ color }}>
                  {span.state ?? 'pending'}
                </span>
                <span className='tool-timeline__duration'>{durationMs}ms</span>
              </div>
              <div className='tool-timeline__track'>
                <div
                  className='tool-timeline__bar'
                  style={{
                    left: `${offsetPct}%`,
                    width: `${widthPct}%`,
                    background: color,
                  }}
                />
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
