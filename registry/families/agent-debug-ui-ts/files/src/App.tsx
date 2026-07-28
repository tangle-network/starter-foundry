import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChatPair } from './components/ChatPair'
import { EventInspector } from './components/EventInspector'
import { EventStream } from './components/EventStream'
import { ReplayScrubber } from './components/ReplayScrubber'
import { ToolCallTimeline } from './components/ToolCallTimeline'
import type { NormalizedEvent } from './lib/event-types'
import { streamRun } from './lib/sandbox-stream'

export function App() {
  const [prompt, setPrompt] = useState('')
  const [activePrompt, setActivePrompt] = useState('')
  const [events, setEvents] = useState<NormalizedEvent[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [selectedEventIdx, setSelectedEventIdx] = useState<number | undefined>()
  const [selectedToolCallId, setSelectedToolCallId] = useState<string | undefined>()
  const [isLive, setIsLive] = useState(true)
  // Cursor for replay scrubbing — number of events to render.
  // When live, mirrors events.length so new events stay visible.
  const [cursor, setCursor] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  // Keep cursor pinned to the tail when in live mode.
  useEffect(() => {
    if (isLive) setCursor(events.length)
  }, [events.length, isLive])

  const visibleEvents = useMemo(
    () => events.slice(0, Math.min(cursor, events.length)),
    [events, cursor],
  )

  const selectedEvent = useMemo(
    () =>
      selectedEventIdx === undefined
        ? undefined
        : visibleEvents.find((e) => e.eventIdx === selectedEventIdx),
    [visibleEvents, selectedEventIdx],
  )

  const handleRun = useCallback(async () => {
    const trimmed = prompt.trim()
    if (!trimmed) return

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setActivePrompt(trimmed)
    setEvents([])
    setError(undefined)
    setSelectedEventIdx(undefined)
    setSelectedToolCallId(undefined)
    setIsLive(true)
    setCursor(0)
    setIsStreaming(true)

    try {
      for await (const evt of streamRun({
        prompt: trimmed,
        signal: ac.signal,
      })) {
        if (ac.signal.aborted) break
        // Functional setState so concurrent yields don't drop frames.
        setEvents((prev) => [...prev, evt])
      }
    } catch (err) {
      if (!ac.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (abortRef.current === ac) {
        abortRef.current = null
        setIsStreaming(false)
      }
    }
  }, [prompt])

  const handleStop = useCallback(() => {
    const activeRun = abortRef.current
    if (!activeRun) return
    abortRef.current = null
    activeRun.abort()
    setIsStreaming(false)
  }, [])

  // Cancel the in-flight stream if the component unmounts.
  useEffect(() => () => abortRef.current?.abort(), [])

  return (
    <div className='app'>
      <header className='app__header'>
        <div>
          <h1>agent-debug-ui</h1>
          <p className='app__subtitle'>Live debugger through the local Sandbox API</p>
        </div>
        <div className='app__prompt-bar'>
          <input
            type='text'
            value={prompt}
            placeholder='Send a prompt to the sandbox agent…'
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isStreaming) handleRun()
            }}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button type='button' onClick={handleStop}>
              Stop
            </button>
          ) : (
            <button type='button' onClick={handleRun} disabled={!prompt.trim()}>
              Run
            </button>
          )}
        </div>
      </header>

      {error ? (
        <div className='app__error'>
          <strong>Stream error:</strong> {error}
        </div>
      ) : null}

      <main className='app__grid'>
        <section className='app__pane app__pane--chat'>
          <ChatPair
            userPrompt={activePrompt}
            events={visibleEvents}
            isStreaming={isStreaming && isLive}
          />
        </section>

        <section className='app__pane app__pane--stream'>
          <EventStream
            events={visibleEvents}
            selectedIdx={selectedEventIdx}
            onSelect={(idx) => setSelectedEventIdx(idx)}
            autoScroll={isLive}
          />
        </section>

        <section className='app__pane app__pane--tools'>
          <ToolCallTimeline
            events={visibleEvents}
            selectedToolCallId={selectedToolCallId}
            onSelect={(toolCallId, eventIdx) => {
              setSelectedToolCallId(toolCallId)
              setSelectedEventIdx(eventIdx)
            }}
          />
        </section>

        <section className='app__pane app__pane--inspector'>
          <EventInspector event={selectedEvent} />
        </section>
      </main>

      <footer className='app__footer'>
        <ReplayScrubber
          events={events}
          cursor={cursor}
          onCursorChange={setCursor}
          isLive={isLive}
          onToggleLive={() => {
            setIsLive((prev) => {
              const next = !prev
              if (next) setCursor(events.length)
              return next
            })
          }}
        />
      </footer>
    </div>
  )
}
