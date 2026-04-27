// Wraps `Sandbox.streamPrompt()` into a normalized AsyncIterable that:
//   1. Adds a wall-clock timestamp + monotonic index to every event.
//   2. Pre-accumulates streaming `delta`s into part text so consumers
//      never have to track per-part state themselves.
//   3. Surfaces unknown event types unchanged so the debugger never
//      silently drops frames it doesn't recognise.
//
// Consumers iterate with `for await (const evt of streamRun(...))`.

import { connectSandbox, type Sandbox } from '@tangle-network/sandbox'
import {
  type AnySandboxEvent,
  type MessagePart,
  type NormalizedEvent,
  type SandboxEvent,
} from './event-types'

export interface StreamRunArgs {
  baseUrl: string
  apiKey: string
  sandboxId: string
  prompt: string
  signal?: AbortSignal
  // Optional — pass through to streamPrompt's PromptOptions.
  sessionId?: string
}

// Internal: per-run accumulator for streaming text parts. Keyed by
// (toolCallId | partType + index) — we use the part's own identity when
// available, falling back to type+ordinal so concurrent text parts don't
// collide. The SDK's actual key strategy is opaque, so we reconstruct.
type PartKey = string

function partKey(part: MessagePart, fallbackIdx: number): PartKey {
  if (part.toolCallId) return `tool:${part.toolCallId}`
  return `${part.type}:${fallbackIdx}`
}

export async function* streamRun(
  args: StreamRunArgs,
): AsyncIterable<NormalizedEvent> {
  const sandbox: Sandbox = await connectSandbox({
    baseUrl: args.baseUrl,
    apiKey: args.apiKey,
    id: args.sandboxId,
  })

  yield* normalizeEventStream(
    sandbox.streamPrompt(args.prompt, {
      signal: args.signal,
      sessionId: args.sessionId,
    }),
  )
}

// Exposed separately so tests + alternative transports (replay from disk,
// websocket bridges, mock streams) can normalize without a real Sandbox.
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

      // First time we see this part: register it and bump the per-type
      // ordinal so subsequent same-type parts don't collide.
      if (!prior) {
        if (incoming.type === 'text') textPartCount++
        else if (incoming.type === 'reasoning') reasoningPartCount++
      }

      const accumulatedText =
        data.delta !== undefined
          ? (prior?.text ?? '') + data.delta
          : incoming.text

      const merged: MessagePart = {
        ...incoming,
        text: accumulatedText,
      }
      partAccum.set(key, merged)

      normalized = {
        type: 'message.part.updated',
        data: {
          part: merged,
          // `delta` preserved so consumers can distinguish "fresh chunk" vs
          // "snapshot" if they care; the part.text is already cumulative.
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

// Helper: collect a finished run into an array. Useful for tests + the
// step-through replay scrubber, which needs random access to the buffer.
export async function collectRun(
  iter: AsyncIterable<NormalizedEvent>,
): Promise<NormalizedEvent[]> {
  const out: NormalizedEvent[] = []
  for await (const evt of iter) out.push(evt)
  return out
}
