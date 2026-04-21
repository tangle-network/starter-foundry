// PAN redaction. Any log sink or error tracer that serializes request bodies
// MUST pass through this filter. One raw PAN in Sentry = PCI scope failure.

// Matches 13-19 digit strings with optional spacing/hyphens between groups
// of 4. Luhn check narrows to real-looking card numbers so we don't
// over-redact random numeric IDs.
const PAN_PATTERN = /\b(?:\d[ -]?){12,18}\d\b/g

function luhnValid(digits: string): boolean {
  let sum = 0
  let alt = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i])
    if (alt) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alt = !alt
  }
  return sum % 10 === 0
}

/** Replace any PAN-like substring with `<pan-redacted>` preserving the last 4. */
export function redactPan(input: string): string {
  return input.replace(PAN_PATTERN, (match) => {
    const digits = match.replace(/[^\d]/g, '')
    if (digits.length < 13 || digits.length > 19) return match
    if (!luhnValid(digits)) return match
    const last4 = digits.slice(-4)
    return `<pan-redacted:****${last4}>`
  })
}

/** Deep-redact an object before serialization. */
export function redactPanInObject<T>(value: T): T {
  if (typeof value === 'string') return redactPan(value) as unknown as T
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v) => redactPanInObject(v)) as unknown as T
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    // Fields that should always be redacted regardless of format.
    if (/^(cvv|cvc|pan|card.?number|account.?number)$/i.test(k)) {
      out[k] = '<redacted>'
    } else {
      out[k] = redactPanInObject(v)
    }
  }
  return out as T
}
