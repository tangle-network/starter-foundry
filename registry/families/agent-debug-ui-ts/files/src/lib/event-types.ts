// SSE event contract from @tangle-network/sandbox `streamPrompt()`.
// Source of truth: products/sandbox/sdk/INTEGRATION.md "SSE Event Contract" table
// + products/sandbox/sdk/src/sandbox.ts streamPrompt() implementation.
//
// We reproduce the public shape locally rather than re-export the SDK's
// `SandboxEvent` because:
//   1. The SDK's union is wider (includes internal `execution.started`,
//      `done`, replay markers) than what UI consumers should react to.
//   2. We need a discriminated narrow that React components can switch on.
//   3. Keeps the debugger usable against any adapter that speaks the
//      documented contract — not just the canonical SDK.

export type PartType = 'text' | 'reasoning' | 'tool'

export interface MessagePart {
  type: PartType
  text: string
  // Tool parts carry structured execution state on top of the text body.
  // Keep loose — different runtimes attach different metadata shapes.
  toolName?: string
  toolCallId?: string
  args?: unknown
  result?: unknown
  state?: 'pending' | 'running' | 'completed' | 'failed'
}

export type SandboxEvent =
  | {
      type: 'message.part.updated'
      data: {
        part: MessagePart
        // When `delta` is present, append to the existing part text.
        // When absent, `part.text` is the cumulative value.
        delta?: string
      }
    }
  | {
      type: 'status'
      data: {
        // Documented values: 'generating_response' | 'processing' | 'completed' | 'failed'
        // — kept open as `string` so adapters can extend.
        status: string
        detail?: string
      }
    }
  | {
      type: 'model-processing'
      data: {
        // Documented phases: 'thinking' | 'generating' | 'tool-result'
        phase: string
        elapsedMs?: number
      }
    }
  | {
      type: 'result'
      data: {
        finalText?: string
        tokenUsage?: {
          inputTokens: number
          outputTokens: number
          reasoningTokens?: number
        }
      }
    }
  | { type: 'trace.id'; data: { traceId: string } }
  | { type: 'error'; data: { message: string } }

// Anything the SDK yields that we don't model explicitly (execution.started,
// done, custom adapter events) flows through here so the debugger can still
// surface it in the raw event stream view.
export interface UnknownSandboxEvent {
  type: string
  data?: unknown
}

export type AnySandboxEvent = SandboxEvent | UnknownSandboxEvent

// A NormalizedEvent is what UI components consume — adds wall-clock + index
// + pre-accumulated part text so React doesn't re-derive on every render.
export interface NormalizedEvent {
  // 0-based monotonic index in the run.
  eventIdx: number
  // Wall-clock ms since epoch when the SSE frame was received.
  receivedAt: number
  // Elapsed ms since the first event in this run.
  elapsedMs: number
  // The raw event payload, narrowed where we recognise the type.
  event: AnySandboxEvent
}

export function isKnownSandboxEvent(
  event: AnySandboxEvent,
): event is SandboxEvent {
  switch (event.type) {
    case 'message.part.updated':
    case 'status':
    case 'model-processing':
    case 'result':
    case 'trace.id':
    case 'error':
      return true
    default:
      return false
  }
}

// Pulls a tool part out of a message.part.updated event, if applicable.
export function extractToolPart(
  event: AnySandboxEvent,
): MessagePart | undefined {
  if (event.type !== 'message.part.updated') return undefined
  const data = (event as Extract<SandboxEvent, { type: 'message.part.updated' }>).data
  if (data.part.type !== 'tool') return undefined
  return data.part
}
