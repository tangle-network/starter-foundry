// Shared types for the privacy layer.

export type PiiType =
  | 'ssn'
  | 'email'
  | 'phone'
  | 'credit-card'
  | 'ip'
  | 'api-key'
  | 'dob'
  // Semantic types (require nerBackend):
  | 'person-name'
  | 'address'
  | 'account-number'
  | 'unknown'

export interface PiiSpan {
  /** Inclusive start offset into the source text. */
  start: number
  /** Exclusive end offset. */
  end: number
  type: PiiType
  /** Hand-tuned per detector. NER backends should set their own. */
  confidence: 'high' | 'medium' | 'low'
  /** The matched substring; useful for logging and field-aware policies. */
  value: string
  /** For api-key spans: provider id (openai / anthropic / aws-access-key / ...). */
  subtype?: string
}

export interface RedactOptions {
  /** Custom redaction shape per span. Default: `[REDACTED:{type}]`.
   * Receives the span and the original full text so callers can do
   * field-aware partial redaction (e.g. last-4 SSN). */
  redactWith?: (span: PiiSpan, original: string) => string
  /** PII types to LEAVE alone. Default: []. Use cases:
   *   - allow: ['ip']           // internal-network deployment
   *   - allow: ['email', 'phone'] // CRM-like agent that intentionally retains
   */
  allow?: PiiType[]
  /** Drop spans below this confidence. Default: 'low' (keep everything). */
  minConfidence?: 'high' | 'medium' | 'low'
  /** Optional NER backend for semantic PII (names, addresses, account numbers).
   * Operator wires openai/privacy-filter, Microsoft Presidio, or AWS Comprehend
   * here. Receives the full text; returns spans the structured detectors don't
   * handle. Errors are caught and logged; never propagate. */
  nerBackend?: (text: string) => Promise<PiiSpan[]>
}

export interface DetectResult {
  /** Spans found, sorted by start offset, non-overlapping (overlaps merged
   * with the higher-confidence type winning). */
  spans: PiiSpan[]
  /** Backend used for semantic detection (if any). */
  semanticBackend?: 'none' | 'custom'
  /** Time spent on detection, milliseconds. */
  durationMs: number
}

export interface RedactResult {
  redacted: string
  spans: PiiSpan[]
  /** True iff at least one span was redacted. */
  changed: boolean
  durationMs: number
}
