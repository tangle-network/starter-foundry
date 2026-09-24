// agent-base:scheduler — sweep loop. The dispatcher process.
//
// The agent calls sweep() once at startup. The returned handle's stop()
// is wired to graceful-shutdown so an unmounted agent doesn't leak the
// timer. No background thread, no separate process — the in-sandbox
// agent owns its own scheduler tick.

import { fireDue } from './index.js'

/** Handle returned by `sweep` — call `stop()` to halt further ticks. */
export interface SweepHandle {
  stop: () => void
}

export interface SweepOptions {
  /** Tick interval in ms. Default 60_000 (one minute, matches cron resolution). */
  intervalMs?: number
  /** Optional logger override. Defaults to `console.error` for failures. */
  onError?: (err: unknown, context: string) => void
}

/**
 * Run the sweep loop. Each tick calls `fireDue()` and reports per-task
 * failures via `onError` (default: `console.error`). The loop self-schedules
 * via `setTimeout` so a long dispatch can't double-fire — the next tick
 * starts only after the previous one resolves.
 */
export function sweep(options: SweepOptions = {}): SweepHandle {
  const interval = options.intervalMs ?? 60_000
  const onError = options.onError ?? ((err, context) => console.error(`[scheduler] ${context}:`, err))

  let stopped = false
  let timer: NodeJS.Timeout | null = null

  const tick = async (): Promise<void> => {
    if (stopped) return
    try {
      const results = await fireDue()
      for (const r of results) {
        if (!r.ok) onError(new Error(r.error ?? 'unknown error'), `task ${r.id} failed`)
      }
    } catch (err) {
      onError(err, 'sweep error')
    }
    if (stopped) return
    timer = setTimeout(() => {
      void tick()
    }, interval)
    // Don't keep the event loop alive solely for the sweep — if the agent
    // is otherwise idle, let it exit. The sandbox runtime restarts the
    // process on the next inbound request.
    if (typeof timer.unref === 'function') timer.unref()
  }

  void tick()

  return {
    stop: () => {
      stopped = true
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}
