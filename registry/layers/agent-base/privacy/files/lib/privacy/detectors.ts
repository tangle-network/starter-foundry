// detectors — structured PII patterns. Each detector is pure: takes text,
// returns spans. No state, no IO. Composes with the public detectPII()
// API in index.ts.
//
// Coverage: structured PII that has a deterministic shape. Names,
// addresses, and other semantic PII require a NER backend (see
// nerBackend in index.ts) — those are NOT handled here.

import type { PiiSpan, PiiType } from './types.js'

interface Detector {
  type: PiiType
  scan: (text: string) => PiiSpan[]
}

// Luhn check for credit-card validation. Drops false positives like
// 16-digit phone numbers or order IDs.
function luhnValid(digits: string): boolean {
  let sum = 0
  let alt = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48
    if (n < 0 || n > 9) return false
    if (alt) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alt = !alt
  }
  return sum % 10 === 0
}

const SSN = {
  type: 'ssn' as const,
  scan(text: string): PiiSpan[] {
    const re = /\b(?!000|666|9\d{2})(\d{3})[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/g
    const spans: PiiSpan[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length, type: 'ssn', confidence: 'high', value: m[0] })
    }
    return spans
  },
}

const EMAIL = {
  type: 'email' as const,
  scan(text: string): PiiSpan[] {
    // RFC 5322-lite — covers practical addresses, rejects obvious nonsense.
    const re = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
    const spans: PiiSpan[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length, type: 'email', confidence: 'high', value: m[0] })
    }
    return spans
  },
}

const PHONE = {
  type: 'phone' as const,
  scan(text: string): PiiSpan[] {
    // North American + international leading-+ formats. Rejects sub-10-digit
    // sequences (those are typically order IDs / part numbers).
    const re = /\b(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b|\+\d{2,4}[-.\s]?\d{3,5}[-.\s]?\d{3,5}\b/g
    const spans: PiiSpan[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length, type: 'phone', confidence: 'medium', value: m[0] })
    }
    return spans
  },
}

const CREDIT_CARD = {
  type: 'credit-card' as const,
  scan(text: string): PiiSpan[] {
    // Match 13-19 digit groups with separators, then Luhn-validate.
    const re = /\b(?:\d[\s-]?){13,19}\b/g
    const spans: PiiSpan[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const digits = m[0].replace(/[\s-]/g, '')
      if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
        spans.push({ start: m.index, end: m.index + m[0].length, type: 'credit-card', confidence: 'high', value: m[0] })
      }
    }
    return spans
  },
}

const IP_ADDRESS = {
  type: 'ip' as const,
  scan(text: string): PiiSpan[] {
    const v4 = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\b/g
    const v6 = /\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b|\b(?:[A-Fa-f0-9]{1,4}:){1,7}:\b|\b:(?::[A-Fa-f0-9]{1,4}){1,7}\b/g
    const spans: PiiSpan[] = []
    for (const re of [v4, v6]) {
      let m: RegExpExecArray | null
      while ((m = re.exec(text)) !== null) {
        // Skip private/loopback ranges as low-PII (operator can opt-in via allow list)
        const isPrivate = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|::1)/.test(m[0])
        spans.push({
          start: m.index,
          end: m.index + m[0].length,
          type: 'ip',
          confidence: isPrivate ? 'low' : 'medium',
          value: m[0],
        })
      }
    }
    return spans
  },
}

// API keys + tokens — high-confidence patterns from known providers.
// Each entry: regex + provider name (for the redaction label).
const API_KEY_PATTERNS: { re: RegExp; provider: string }[] = [
  { re: /\bsk-[A-Za-z0-9]{32,}\b/g, provider: 'openai' },
  { re: /\bsk-ant-[A-Za-z0-9-_]{32,}\b/g, provider: 'anthropic' },
  { re: /\bsk-tan-[A-Za-z0-9-_]{20,}\b/g, provider: 'tangle' },
  { re: /\bAKIA[0-9A-Z]{16}\b/g, provider: 'aws-access-key' },
  { re: /\b(?:gh[pous]_[A-Za-z0-9]{36})\b/g, provider: 'github' },
  { re: /\bxoxb-\d+-\d+-[A-Za-z0-9]+\b/g, provider: 'slack-bot' },
  { re: /\b(?:eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g, provider: 'jwt' },
  // M9 fix: explicit length cap (≤16384 chars between BEGIN/END) so an
  // adversarial 100MB pseudo-PEM doesn't cause exponential regex scanning.
  // Real PEM private keys are well under this cap (RSA 4096 ≈ 3.5KB armored).
  { re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{0,16384}?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, provider: 'pem-private-key' },
]

const API_KEY = {
  type: 'api-key' as const,
  scan(text: string): PiiSpan[] {
    const spans: PiiSpan[] = []
    for (const { re, provider } of API_KEY_PATTERNS) {
      let m: RegExpExecArray | null
      while ((m = re.exec(text)) !== null) {
        spans.push({
          start: m.index,
          end: m.index + m[0].length,
          type: 'api-key',
          confidence: 'high',
          value: m[0],
          subtype: provider,
        })
      }
    }
    return spans
  },
}

// Date of birth — only when a date appears alongside DOB-shaped context
// markers ("DOB", "born", "birthday"). Bare dates are too ambiguous to
// flag without the context anchor.
const DATE_OF_BIRTH = {
  type: 'dob' as const,
  scan(text: string): PiiSpan[] {
    const re = /\b(?:DOB|D\.O\.B\.|date of birth|born(?: on)?|birthday)\s*[:\s]*((?:19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/](?:19|20)?\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+(?:19|20)?\d{2})/gi
    const spans: PiiSpan[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const dateStart = m.index + m[0].indexOf(m[1]!)
      spans.push({ start: dateStart, end: dateStart + m[1]!.length, type: 'dob', confidence: 'high', value: m[1]! })
    }
    return spans
  },
}

export const STRUCTURED_DETECTORS: readonly Detector[] = Object.freeze([
  SSN,
  EMAIL,
  PHONE,
  CREDIT_CARD,
  IP_ADDRESS,
  API_KEY,
  DATE_OF_BIRTH,
])
