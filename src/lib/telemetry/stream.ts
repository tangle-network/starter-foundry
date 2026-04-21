/**
 * Real-time telemetry stream.
 *
 * createTelemetryStream() produces a lightweight batching sink that accepts
 * BuildoutEvent (or any JSON-serializable payload) and POSTs batches to a
 * webhook endpoint on a timer (default: 60s) or when the batch hits a size
 * cap. When the endpoint is unreachable — network error, non-2xx, timeout —
 * events are appended to an on-disk outbox file so nothing is lost, and the
 * next flush retries the outbox first.
 *
 * This is the consumer-facing side of the real-time aggregator. Aggregators
 * and dashboards live elsewhere; this lib just guarantees delivery.
 */

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface TelemetryStreamOptions {
  /** Webhook URL. POSTed as JSON: { batchId, events: [...] }. */
  endpoint: string
  /** Max events per batch. Defaults to 50. */
  batchSize?: number
  /** Flush interval in ms. Defaults to 60_000. Set to 0 to disable the timer. */
  flushIntervalMs?: number
  /** Outbox file path. Defaults to .evolve/telemetry-outbox.jsonl. */
  outboxPath?: string
  /** Fetch timeout in ms. Defaults to 10_000. */
  timeoutMs?: number
  /** Optional bearer token header. */
  authToken?: string
  /** Test hook: override fetch. */
  fetchImpl?: typeof fetch
  /** Test hook: override clock (returns ms). */
  now?: () => number
}

export interface TelemetryEvent {
  /** Arbitrary payload; typically a BuildoutEvent. */
  payload: unknown
  /** ISO 8601 — set automatically if absent. */
  emittedAt?: string
}

export interface TelemetryStream {
  /** Queue an event for delivery. Flushes immediately if batch is full. */
  emit(event: TelemetryEvent): Promise<void>
  /** Force-flush pending events (and outbox) to the endpoint. Returns count actually delivered. */
  flush(): Promise<{ delivered: number; buffered: number }>
  /** Stop the timer and flush one last time. */
  close(): Promise<void>
  /** Number of events pending in memory. */
  pendingCount(): number
}

interface QueuedEvent extends TelemetryEvent {
  emittedAt: string
}

export const DEFAULT_OUTBOX_PATH = '.evolve/telemetry-outbox.jsonl'

export function createTelemetryStream(options: TelemetryStreamOptions): TelemetryStream {
  if (!options.endpoint) throw new Error('createTelemetryStream: endpoint is required')

  const batchSize = options.batchSize ?? 50
  const flushIntervalMs = options.flushIntervalMs ?? 60_000
  const outboxPath = options.outboxPath ?? DEFAULT_OUTBOX_PATH
  const timeoutMs = options.timeoutMs ?? 10_000
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? Date.now

  let pending: QueuedEvent[] = []
  let timer: NodeJS.Timeout | null = null
  let closed = false

  function scheduleTimer(): void {
    if (flushIntervalMs <= 0 || timer || closed) return
    timer = setTimeout(() => {
      timer = null
      flush().catch(() => {
        // Errors already routed to outbox.
      })
    }, flushIntervalMs)
    // Don't keep the event loop alive just for the timer.
    if (typeof timer.unref === 'function') timer.unref()
  }

  async function appendOutbox(events: QueuedEvent[]): Promise<void> {
    await mkdir(dirname(outboxPath), { recursive: true })
    const body = events.map((e) => JSON.stringify(e)).join('\n') + '\n'
    await appendFile(outboxPath, body, 'utf8')
  }

  async function drainOutbox(): Promise<QueuedEvent[]> {
    let raw: string
    try {
      raw = await readFile(outboxPath, 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw err
    }
    const rows: QueuedEvent[] = []
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        rows.push(JSON.parse(line) as QueuedEvent)
      } catch {
        // Skip malformed lines rather than re-enter them forever.
      }
    }
    return rows
  }

  async function truncateOutbox(): Promise<void> {
    try {
      await writeFile(outboxPath, '', 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }

  async function postBatch(events: QueuedEvent[]): Promise<boolean> {
    if (!events.length) return true
    const batchId = `${now()}-${Math.random().toString(36).slice(2, 10)}`
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (options.authToken) headers.authorization = `Bearer ${options.authToken}`
      const res = await fetchImpl(options.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ batchId, events }),
        signal: controller.signal,
      })
      return res.ok
    } catch {
      return false
    } finally {
      clearTimeout(tid)
    }
  }

  async function emit(event: TelemetryEvent): Promise<void> {
    if (closed) throw new Error('telemetry stream closed')
    pending.push({ ...event, emittedAt: event.emittedAt ?? new Date().toISOString() })
    scheduleTimer()
    if (pending.length >= batchSize) {
      await flush()
    }
  }

  async function flush(): Promise<{ delivered: number; buffered: number }> {
    // Pick up outbox first so ordering is preserved.
    const outboxEvents = await drainOutbox()
    const inMemory = pending
    pending = []
    const all = [...outboxEvents, ...inMemory]
    if (!all.length) return { delivered: 0, buffered: 0 }
    // Clear the outbox now that we have its contents in memory. If the
    // send fails we re-append everything below.
    await truncateOutbox()

    let delivered = 0
    let buffered = 0
    for (let i = 0; i < all.length; i += batchSize) {
      const chunk = all.slice(i, i + batchSize)
      const ok = await postBatch(chunk)
      if (ok) delivered += chunk.length
      else {
        await appendOutbox(chunk)
        buffered += chunk.length
      }
    }
    return { delivered, buffered }
  }

  async function close(): Promise<void> {
    closed = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    await flush()
  }

  return {
    emit,
    flush,
    close,
    pendingCount: () => pending.length,
  }
}

/**
 * CLI-friendly helper: read the outbox, POST it, truncate on success. Used
 * by scripts/telemetry-flush.mjs.
 */
export async function flushOutbox(options: {
  endpoint: string
  outboxPath?: string
  authToken?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
  batchSize?: number
}): Promise<{ delivered: number; buffered: number; total: number }> {
  const stream = createTelemetryStream({
    endpoint: options.endpoint,
    outboxPath: options.outboxPath,
    authToken: options.authToken,
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
    batchSize: options.batchSize ?? 50,
    flushIntervalMs: 0,
  })
  const result = await stream.flush()
  await stream.close()
  return { delivered: result.delivered, buffered: result.buffered, total: result.delivered + result.buffered }
}
