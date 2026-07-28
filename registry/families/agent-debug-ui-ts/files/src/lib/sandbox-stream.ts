import { createSandboxRuntimeClient } from '@tangle-network/sandbox/runtime'
import { SessionGatewayClient } from '@tangle-network/sandbox/session-gateway'
import {
  type AnySandboxEvent,
  type MessagePart,
  type NormalizedEvent,
  type SandboxEvent,
} from './event-types'

export interface SessionCredentials {
  sandboxId: string
  gatewayUrl: string
  gatewayToken: string
  browserSessionId: string
  runtimeUrl: string
  runtimeToken: string
  runtimeSessionId: string
  expiresAt: number
}

export interface StreamRunArgs {
  sessionUrl: string
  prompt: string
  signal?: AbortSignal
  fetch?: typeof globalThis.fetch
}

export async function loadSessionCredentials(
  sessionUrl: string,
  options: { signal?: AbortSignal; fetch?: typeof globalThis.fetch } = {},
): Promise<SessionCredentials> {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const response = await fetchImpl(sessionUrl, {
    credentials: 'include',
    signal: options.signal,
  })
  if (!response.ok) {
    throw new Error(`Session bootstrap failed: HTTP ${response.status}`)
  }
  const value = (await response.json()) as Partial<SessionCredentials>
  for (const field of [
    'sandboxId',
    'gatewayUrl',
    'gatewayToken',
    'browserSessionId',
    'runtimeUrl',
    'runtimeToken',
    'runtimeSessionId',
  ] as const) {
    if (typeof value[field] !== 'string' || value[field].length === 0) {
      throw new Error(`Session bootstrap response is missing ${field}`)
    }
  }
  if (!Number.isFinite(value.expiresAt)) {
    throw new Error('Session bootstrap response is missing expiresAt')
  }
  return value as SessionCredentials
}

export async function* streamRun(args: StreamRunArgs): AsyncIterable<NormalizedEvent> {
  let credentials = await loadSessionCredentials(args.sessionUrl, {
    signal: args.signal,
    fetch: args.fetch,
  })
  const runtime = createSandboxRuntimeClient({
    baseUrl: credentials.runtimeUrl,
    token: credentials.runtimeToken,
    ...(args.fetch ? { fetch: args.fetch } : {}),
  })
  const queue = new EventQueue()
  let connected = false
  let resolveConnected: (() => void) | undefined
  let rejectConnected: ((error: Error) => void) | undefined
  const connection = new Promise<void>((resolve, reject) => {
    resolveConnected = resolve
    rejectConnected = reject
  })
  const gateway = new SessionGatewayClient({
    url: credentials.gatewayUrl,
    token: credentials.gatewayToken,
    sessionId: credentials.browserSessionId,
    enableReplayPersistence: true,
    replayStorageKeyPrefix: `agent-debug:${credentials.browserSessionId}:`,
    onTokenRefresh: async () => {
      credentials = await loadSessionCredentials(args.sessionUrl, { fetch: args.fetch })
      runtime.updateToken(credentials.runtimeToken)
      return { token: credentials.gatewayToken, expiresAt: credentials.expiresAt }
    },
    handlers: {
      onConnect: () => {
        connected = true
        resolveConnected?.()
      },
      onAgentEvent: (channel, data) => {
        const event = normalizeGatewayEvent(channel, data)
        queue.push(event)
        if (isTerminalEvent(event)) queue.end()
      },
      onError: (message) => {
        const error = new Error(`Session gateway: ${message}`)
        if (connected) queue.fail(error)
        else rejectConnected?.(error)
      },
      onDisconnect: (code, reason) => {
        if (!connected || gateway.getState() === 'disconnected') {
          const error = new Error(`Session gateway disconnected (${code}): ${reason || 'unknown'}`)
          if (connected) queue.fail(error)
          else rejectConnected?.(error)
        }
      },
    },
  })
  const abort = () => {
    gateway.disconnect()
    queue.fail(new Error('Run aborted'))
    rejectConnected?.(new Error('Run aborted'))
  }
  args.signal?.addEventListener('abort', abort, { once: true })

  try {
    gateway.connect()
    await connection
    if (args.signal?.aborted) throw new Error('Run aborted')
    gateway.setSessionContext(credentials.runtimeSessionId)
    await runtime.sendSessionMessage(
      credentials.runtimeSessionId,
      {
        parts: [{ type: 'text', text: args.prompt }],
        turnId: crypto.randomUUID(),
      },
      { signal: args.signal },
    )
    yield* normalizeEventStream(queue)
  } finally {
    args.signal?.removeEventListener('abort', abort)
    gateway.disconnect()
  }
}

export function normalizeGatewayEvent(channel: string, data: unknown): AnySandboxEvent {
  if (isRecord(data) && typeof data.type === 'string') {
    if ('data' in data) return data as AnySandboxEvent
    const { type, ...rest } = data
    return { type, data: rest }
  }
  return { type: channel, data }
}

export function isTerminalEvent(event: AnySandboxEvent): boolean {
  if (event.type === 'result' || event.type === 'done' || event.type === 'error') return true
  if (event.type !== 'status' || !isRecord(event.data)) return false
  return event.data.status === 'completed' || event.data.status === 'failed'
}

class EventQueue implements AsyncIterable<AnySandboxEvent> {
  private values: AnySandboxEvent[] = []
  private waiters: Array<{
    resolve: (result: IteratorResult<AnySandboxEvent>) => void
    reject: (error: Error) => void
  }> = []
  private closed = false
  private error: Error | undefined

  push(value: AnySandboxEvent): void {
    if (this.closed) return
    const waiter = this.waiters.shift()
    if (waiter) waiter.resolve({ value, done: false })
    else this.values.push(value)
  }

  end(): void {
    if (this.closed) return
    this.closed = true
    for (const waiter of this.waiters.splice(0)) waiter.resolve({ value: undefined, done: true })
  }

  fail(error: Error): void {
    if (this.closed) return
    this.closed = true
    this.error = error
    for (const waiter of this.waiters.splice(0)) waiter.reject(error)
  }

  [Symbol.asyncIterator](): AsyncIterator<AnySandboxEvent> {
    return {
      next: async () => {
        const value = this.values.shift()
        if (value) return { value, done: false }
        if (this.error) throw this.error
        if (this.closed) return { value: undefined, done: true }
        return new Promise<IteratorResult<AnySandboxEvent>>((resolve, reject) => {
          this.waiters.push({ resolve, reject })
        })
      },
    }
  }
}

type PartKey = string

function partKey(part: MessagePart, fallbackIdx: number): PartKey {
  if (part.toolCallId) return `tool:${part.toolCallId}`
  return `${part.type}:${fallbackIdx}`
}

export async function* normalizeEventStream(
  raw: AsyncIterable<AnySandboxEvent>,
): AsyncIterable<NormalizedEvent> {
  let eventIdx = 0
  let firstAt: number | undefined
  const partAccum = new Map<PartKey, MessagePart>()
  let textPartCount = 0
  let reasoningPartCount = 0

  for await (const event of raw) {
    const receivedAt = Date.now()
    if (firstAt === undefined) firstAt = receivedAt
    let normalized: AnySandboxEvent = event

    if (event.type === 'message.part.updated') {
      const data = (event as Extract<SandboxEvent, { type: 'message.part.updated' }>).data
      const incoming = data.part
      const fallbackIdx =
        incoming.type === 'text'
          ? textPartCount
          : incoming.type === 'reasoning'
            ? reasoningPartCount
            : 0
      const key = partKey(incoming, fallbackIdx)
      const prior = partAccum.get(key)
      if (!prior) {
        if (incoming.type === 'text') textPartCount++
        else if (incoming.type === 'reasoning') reasoningPartCount++
      }
      const accumulatedText =
        data.delta !== undefined ? (prior?.text ?? '') + data.delta : incoming.text
      const merged: MessagePart = { ...incoming, text: accumulatedText }
      partAccum.set(key, merged)
      normalized = {
        type: 'message.part.updated',
        data: {
          part: merged,
          ...(data.delta !== undefined ? { delta: data.delta } : {}),
        },
      }
    }

    yield {
      eventIdx,
      receivedAt,
      elapsedMs: receivedAt - firstAt,
      event: normalized,
    }
    eventIdx++
  }
}

export async function collectRun(
  iter: AsyncIterable<NormalizedEvent>,
): Promise<NormalizedEvent[]> {
  const out: NormalizedEvent[] = []
  for await (const event of iter) out.push(event)
  return out
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
