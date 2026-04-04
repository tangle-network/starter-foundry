type EventState = 'received' | 'processing' | 'completed' | 'failed'

interface QueuedEvent {
  id: string
  payload: unknown
  state: EventState
  attempts: number
  lastError?: string
  createdAt: number
  updatedAt: number
}

interface QueueOptions {
  maxRetries?: number
  baseDelayMs?: number
}

export function createWebhookQueue(options: QueueOptions = {}) {
  const { maxRetries = 3, baseDelayMs = 1000 } = options
  const events = new Map<string, QueuedEvent>()

  function enqueue(id: string, payload: unknown): QueuedEvent {
    const existing = events.get(id)
    if (existing) return existing
    const entry: QueuedEvent = {
      id,
      payload,
      state: 'received',
      attempts: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    events.set(id, entry)
    return entry
  }

  async function process(
    id: string,
    handler: (payload: unknown) => Promise<void>,
  ): Promise<QueuedEvent> {
    const entry = events.get(id)
    if (!entry) throw new Error(`Event ${id} not found`)
    if (entry.state === 'completed') return entry
    if (entry.state === 'processing') return entry

    entry.state = 'processing'
    entry.attempts += 1
    entry.updatedAt = Date.now()

    try {
      await handler(entry.payload)
      entry.state = 'completed'
      entry.updatedAt = Date.now()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      entry.lastError = message
      if (entry.attempts >= maxRetries) {
        entry.state = 'failed'
      } else {
        entry.state = 'received'
        const delay = baseDelayMs * Math.pow(2, entry.attempts - 1)
        entry.updatedAt = Date.now()
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    return entry
  }

  function getStatus(id: string): QueuedEvent | undefined {
    return events.get(id)
  }

  return { enqueue, process, getStatus }
}

export type { QueuedEvent, EventState, QueueOptions }
