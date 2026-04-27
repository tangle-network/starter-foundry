import type { NormalizedEvent } from '../lib/event-types'

interface EventInspectorProps {
  event?: NormalizedEvent
}

export function EventInspector({ event }: EventInspectorProps) {
  if (!event) {
    return (
      <div className='event-inspector event-inspector--empty'>
        <p>Click an event or tool call to inspect its full payload.</p>
      </div>
    )
  }

  return (
    <div className='event-inspector'>
      <header className='event-inspector__header'>
        <span>Event #{event.eventIdx}</span>
        <span className='event-inspector__type'>{event.event.type}</span>
        <span className='event-inspector__elapsed'>+{event.elapsedMs}ms</span>
      </header>
      <pre className='event-inspector__json'>
        {JSON.stringify(event.event, jsonReplacer, 2)}
      </pre>
    </div>
  )
}

// Truncate huge text bodies so a 200-KB tool result doesn't blow up the DOM.
function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && value.length > 4000) {
    return `${value.slice(0, 4000)}… [truncated ${value.length - 4000} chars]`
  }
  return value
}
