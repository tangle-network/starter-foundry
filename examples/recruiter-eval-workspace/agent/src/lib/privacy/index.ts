// agent-base:privacy — PII detection + redaction at intentional egress
// points. Bundles call detectPII / redactPII before logging, forwarding,
// or storing data that crossed a trust boundary.
//
// Threat model (what this primitive defends):
//   - Output leak: agent writes its chain-of-thought to a log; PII in the
//     reasoning lands in the observability vendor's storage.
//   - Forward leak: agent forwards data to another agent / external API
//     with more fields than the receiver needs.
//
// Threat model (what this does NOT defend):
//   - The agent reading PHI from a webhook. The data IS the data; the
//     filter scrubs at egress, not at ingress.
//   - Network-level interception. That's TLS at the gateway.
//   - The operator deliberately disabling the filter via `allow`.
//
// Composition: pure functions. Bundles pick which detectors apply,
// which spans to allow, and what redaction shape to use. Per-egress
// configuration, not global mutable state.

import { STRUCTURED_DETECTORS } from './detectors.js'
import type {
  DetectResult,
  PiiSpan,
  PiiType,
  RedactOptions,
  RedactResult,
} from './types.js'

export type { PiiSpan, PiiType, RedactOptions, DetectResult, RedactResult } from './types.js'

const CONFIDENCE_RANK: Record<PiiSpan['confidence'], number> = { high: 3, medium: 2, low: 1 }

function defaultRedactWith(span: PiiSpan): string {
  // Last-4 visible for credit-card and SSN by default — keep enough for
  // record reconciliation, hide enough to avoid PCI/PII exposure. Bundles
  // override via opts.redactWith when they need different policy.
  if (span.type === 'credit-card' || span.type === 'ssn') {
    const digits = span.value.replace(/\D/g, '')
    return digits.length >= 4 ? `[REDACTED:${span.type}:****${digits.slice(-4)}]` : `[REDACTED:${span.type}]`
  }
  if (span.type === 'api-key' && span.subtype) {
    return `[REDACTED:api-key:${span.subtype}]`
  }
  return `[REDACTED:${span.type}]`
}

function mergeOverlapping(spans: PiiSpan[]): PiiSpan[] {
  if (spans.length === 0) return spans
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end)
  const out: PiiSpan[] = []
  for (const span of sorted) {
    const last = out[out.length - 1]
    if (last && span.start < last.end) {
      // Overlap — keep the higher-confidence one; if equal, the larger span.
      const lastRank = CONFIDENCE_RANK[last.confidence]
      const spanRank = CONFIDENCE_RANK[span.confidence]
      if (spanRank > lastRank || (spanRank === lastRank && span.end - span.start > last.end - last.start)) {
        out[out.length - 1] = span
      }
      continue
    }
    out.push(span)
  }
  return out
}

function passConfidenceFloor(span: PiiSpan, floor: PiiSpan['confidence']): boolean {
  return CONFIDENCE_RANK[span.confidence] >= CONFIDENCE_RANK[floor]
}

/**
 * Detect PII spans in `text`. Pure: no side effects, no logging, no env
 * reads. Bundles wrap this in their own audit-logging if needed.
 */
export async function detectPII(text: string, opts: RedactOptions = {}): Promise<DetectResult> {
  const t0 = performance.now()
  const allow = new Set(opts.allow ?? [])
  const minConfidence = opts.minConfidence ?? 'low'

  // Structured detectors — synchronous, no IO.
  let spans: PiiSpan[] = []
  for (const detector of STRUCTURED_DETECTORS) {
    if (allow.has(detector.type)) continue
    spans.push(...detector.scan(text))
  }

  // Semantic detector — optional, async, errors caught.
  let semanticBackend: DetectResult['semanticBackend'] = 'none'
  if (opts.nerBackend) {
    semanticBackend = 'custom'
    try {
      const nerSpans = await opts.nerBackend(text)
      // NER returns whatever types it knows; respect allow list.
      spans.push(...nerSpans.filter((s) => !allow.has(s.type)))
    } catch (err) {
      // Backend failure must NOT bypass detection; log to stderr and continue.
      // Bundles that need a hard guarantee should call detectPII once and
      // assert the result before egress.
      process.stderr.write(`[agent-base:privacy] nerBackend error (continuing with structured detectors only): ${(err as Error).message}\n`)
    }
  }

  spans = spans.filter((s) => passConfidenceFloor(s, minConfidence))
  spans = mergeOverlapping(spans)

  return { spans, semanticBackend, durationMs: Math.round(performance.now() - t0) }
}

/**
 * Redact PII from `text`. Returns the redacted string + the spans that
 * were redacted + a `changed` flag for fast-path logging.
 *
 * Idempotent: redacting an already-redacted string is a no-op (the
 * `[REDACTED:...]` markers don't match any detector).
 */
export async function redactPII(text: string, opts: RedactOptions = {}): Promise<RedactResult> {
  const t0 = performance.now()
  const detection = await detectPII(text, opts)
  if (detection.spans.length === 0) {
    return { redacted: text, spans: [], changed: false, durationMs: Math.round(performance.now() - t0) }
  }

  const redactWith = opts.redactWith ?? defaultRedactWith
  const sortedDesc = [...detection.spans].sort((a, b) => b.start - a.start)

  let redacted = text
  for (const span of sortedDesc) {
    const replacement = redactWith(span, text)
    redacted = redacted.slice(0, span.start) + replacement + redacted.slice(span.end)
  }

  return {
    redacted,
    spans: detection.spans,
    changed: true,
    durationMs: Math.round(performance.now() - t0),
  }
}

/**
 * Convenience: throw if PII is detected. Use in test harnesses or in
 * deployments where unexpected PII at an egress point is a hard fault.
 */
export async function assertNoPII(text: string, opts: RedactOptions = {}): Promise<void> {
  const detection = await detectPII(text, opts)
  if (detection.spans.length === 0) return
  const summary = detection.spans.map((s) => `${s.type}@${s.start}`).join(', ')
  throw new Error(`PII detected: ${summary}`)
}
