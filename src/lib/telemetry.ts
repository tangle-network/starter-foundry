/**
 * Telemetry module for starter-foundry.
 *
 * Two integration patterns:
 *
 * 1. **Event-based** (lightweight, no deps) — subscribe to typed events:
 *    ```ts
 *    import { on } from 'starter-foundry/telemetry'
 *    on('route', (e) => console.log(e.family, e.confidence, e.durationMs))
 *    on('compose', (e) => console.log(e.family, e.filesWritten, e.durationMs))
 *    ```
 *
 * 2. **OpenTelemetry** (production) — if @opentelemetry/api is installed,
 *    spans are emitted automatically under the 'starter-foundry' tracer.
 *    No additional setup needed in library code.
 */

// --- Typed event system ---

export interface RouteEvent {
  prompt: string
  kind: 'starter' | 'workspace'
  family: string
  confidence: 'high' | 'medium' | 'low'
  capabilities: string[]
  fallbackUsed: boolean
  durationMs: number
}

export interface ComposeEvent {
  family: string
  layers: string[]
  filesWritten: string[]
  partner: string | null
  durationMs: number
}

export interface CapabilityEvent {
  family: string
  detected: string[]
  prompt: string
}

interface TelemetryEvents {
  route: RouteEvent
  compose: ComposeEvent
  capability: CapabilityEvent
}

type EventHandler<T> = (event: T) => void

const handlers: { [K in keyof TelemetryEvents]?: EventHandler<TelemetryEvents[K]>[] } = {}

export function on<K extends keyof TelemetryEvents>(event: K, handler: EventHandler<TelemetryEvents[K]>): void {
  if (!handlers[event]) handlers[event] = []
  handlers[event]!.push(handler)
}

export function off<K extends keyof TelemetryEvents>(event: K, handler: EventHandler<TelemetryEvents[K]>): void {
  const list = handlers[event]
  if (!list) return
  const idx = list.indexOf(handler)
  if (idx >= 0) list.splice(idx, 1)
}

export function emit<K extends keyof TelemetryEvents>(event: K, data: TelemetryEvents[K]): void {
  const list = handlers[event]
  if (!list) return
  for (const handler of list) {
    try {
      handler(data)
    } catch {
      // subscriber errors don't propagate
    }
  }
}

// --- OpenTelemetry integration (optional) ---

interface OtelSpan {
  setAttribute(key: string, value: string | number | boolean): void
  setStatus(status: { code: number; message?: string }): void
  end(): void
}

interface OtelTracer {
  startSpan(name: string): OtelSpan
}

interface OtelApi {
  trace: {
    getTracer(name: string, version?: string): OtelTracer
  }
  SpanStatusCode: {
    OK: number
    ERROR: number
  }
}

let otelApi: OtelApi | null = null
let otelResolved = false

function getOtel(): OtelApi | null {
  if (otelResolved) return otelApi
  otelResolved = true
  try {
    // Dynamic require — no-op if @opentelemetry/api not installed
    otelApi = require('@opentelemetry/api') as OtelApi
  } catch {
    otelApi = null
  }
  return otelApi
}

function getTracer(): OtelTracer | null {
  const api = getOtel()
  return api?.trace.getTracer('starter-foundry', '0.1.0') ?? null
}

export function startSpan(name: string): OtelSpan | null {
  return getTracer()?.startSpan(name) ?? null
}

export function endSpan(span: OtelSpan | null, attrs?: Record<string, string | number | boolean>): void {
  if (!span) return
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      span.setAttribute(k, v)
    }
  }
  const api = getOtel()
  if (api) span.setStatus({ code: api.SpanStatusCode.OK })
  span.end()
}

export function failSpan(span: OtelSpan | null, error: string): void {
  if (!span) return
  const api = getOtel()
  if (api) span.setStatus({ code: api.SpanStatusCode.ERROR, message: error })
  span.end()
}

// --- Convenience: timed operation ---

export async function traced<T>(name: string, fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const span = startSpan(name)
  const start = performance.now()
  try {
    const result = await fn()
    const durationMs = Math.round(performance.now() - start)
    endSpan(span, { 'starter_foundry.duration_ms': durationMs })
    return { result, durationMs }
  } catch (err) {
    failSpan(span, err instanceof Error ? err.message : String(err))
    throw err
  }
}
