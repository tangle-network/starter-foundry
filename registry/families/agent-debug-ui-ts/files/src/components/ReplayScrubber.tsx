import type { NormalizedEvent } from '../lib/event-types'

interface ReplayScrubberProps {
  events: NormalizedEvent[]
  // 1-based count of events to show. Range: [0, events.length].
  // 0 = nothing yet, events.length = full run.
  cursor: number
  onCursorChange: (cursor: number) => void
  isLive: boolean
  onToggleLive: () => void
}

export function ReplayScrubber({
  events,
  cursor,
  onCursorChange,
  isLive,
  onToggleLive,
}: ReplayScrubberProps) {
  const max = events.length
  const totalElapsedMs = max > 0 ? events[max - 1]!.elapsedMs : 0
  const cursorElapsed =
    cursor === 0 ? 0 : events[Math.min(cursor, max) - 1]?.elapsedMs ?? 0

  return (
    <div className='replay-scrubber'>
      <button
        type='button'
        className={
          'replay-scrubber__btn' +
          (isLive ? ' replay-scrubber__btn--live' : '')
        }
        onClick={onToggleLive}
        disabled={max === 0}
      >
        {isLive ? '▶ Live' : '⏸ Replay'}
      </button>
      <input
        className='replay-scrubber__range'
        type='range'
        min={0}
        max={max}
        step={1}
        value={Math.min(cursor, max)}
        disabled={max === 0}
        onChange={(e) => {
          const next = Number(e.target.value)
          // Switching off live the moment the user scrubs — otherwise
          // incoming events would yank the cursor away.
          if (isLive) onToggleLive()
          onCursorChange(next)
        }}
      />
      <span className='replay-scrubber__readout'>
        {cursor}/{max} events · {cursorElapsed}ms / {totalElapsedMs}ms
      </span>
    </div>
  )
}
