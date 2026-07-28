import {
  type AnySandboxEvent,
  type MessagePart,
  type NormalizedEvent,
  type SandboxEvent,
} from './event-types'

export interface StreamRunArgs {
  prompt: string
  signal?: AbortSignal
  sessionId?: string
}

export async function* streamRun(args: StreamRunArgs): AsyncIterable<NormalizedEvent> {
  const response = await fetch('/api/prompt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: args.prompt, sessionId: args.sessionId }),
    signal: args.signal,
  })
  if (!response.ok) {
    const message = (await response.text()).trim()
    throw new Error(message || `Sandbox stream failed with status ${response.status}`)
  }

  yield* normalizeEventStream(decodeEventStream(response))
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

      const merged: MessagePart = {
        ...incoming,
        text: accumulatedText,
      }
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

async function* decodeEventStream(response: Response): AsyncIterable<AnySandboxEvent> {
  if (!response.body) throw new Error('Sandbox stream response has no body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (line) yield parseEvent(line)
        newline = buffer.indexOf('\n')
      }
      if (done) break
    }

    const finalLine = buffer.trim()
    if (finalLine) yield parseEvent(finalLine)
  } finally {
    reader.releaseLock()
  }
}

function parseEvent(line: string): AnySandboxEvent {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    throw new Error('Sandbox stream returned invalid JSON')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Sandbox stream returned a non-object event')
  }
  const event = value as Record<string, unknown>
  if (typeof event.type !== 'string' || event.type.length === 0) {
    throw new Error('Sandbox stream event is missing a type')
  }
  return value as AnySandboxEvent
}
