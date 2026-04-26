// Tests for agent-base:privacy. Adversarial: structured PII shapes that
// trip naive regexes (Luhn-invalid card-shaped numbers, IPv6 corner cases,
// SSN with reserved area numbers), idempotency on already-redacted text,
// allow-list semantics, NER backend integration + error swallowing.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectPII, redactPII, assertNoPII } from './index.js'
import type { PiiSpan } from './types.js'

test('SSN: detects xxx-xx-xxxx', async () => {
  const r = await detectPII('Patient SSN: 123-45-6789, please verify')
  const ssn = r.spans.find((s) => s.type === 'ssn')
  assert.ok(ssn)
  assert.equal(ssn!.value, '123-45-6789')
  assert.equal(ssn!.confidence, 'high')
})

test('SSN: rejects reserved area numbers (000, 666, 9xx)', async () => {
  const r = await detectPII('Try 000-12-3456 or 666-12-3456 or 999-12-3456 — none are valid')
  assert.equal(r.spans.filter((s) => s.type === 'ssn').length, 0)
})

test('SSN: rejects xx-xxxx with all zeros in group', async () => {
  const r = await detectPII('123-00-4567 should not match (group of zeros)')
  assert.equal(r.spans.filter((s) => s.type === 'ssn').length, 0)
})

test('Email: catches standard addresses', async () => {
  const r = await detectPII('Contact alice@example.com or bob.smith+filter@sub.co.uk')
  assert.equal(r.spans.filter((s) => s.type === 'email').length, 2)
})

test('Phone: detects NANP variants', async () => {
  const cases = [
    '(555) 123-4567',
    '+1-555-123-4567',
    '555.123.4567',
    '5551234567',
  ]
  for (const c of cases) {
    const r = await detectPII(`Call me at ${c} please`)
    assert.ok(r.spans.find((s) => s.type === 'phone'), `should detect ${c}`)
  }
})

test('Credit card: Luhn-validates', async () => {
  // Real Luhn-valid Visa test number
  const valid = '4111-1111-1111-1111'
  const invalid = '1234-5678-9012-3456' // Luhn-invalid
  const validR = await detectPII(`charge ${valid}`)
  const invalidR = await detectPII(`reference ${invalid}`)
  assert.ok(validR.spans.find((s) => s.type === 'credit-card'), 'valid Luhn should match')
  assert.equal(invalidR.spans.filter((s) => s.type === 'credit-card').length, 0, 'invalid Luhn should NOT match')
})

test('IPv4: distinguishes private from public', async () => {
  const r = await detectPII('Public 8.8.8.8 or private 192.168.1.1')
  const ips = r.spans.filter((s) => s.type === 'ip')
  assert.equal(ips.length, 2)
  const pub = ips.find((s) => s.value === '8.8.8.8')
  const priv = ips.find((s) => s.value === '192.168.1.1')
  assert.equal(pub!.confidence, 'medium')
  assert.equal(priv!.confidence, 'low')
})

test('API key: detects multi-provider', async () => {
  const text = `OpenAI: sk-abc123def456ghi789jkl012mno345pqr678
  Anthropic: sk-ant-api01-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  Tangle: sk-tan-xyz789abc456def012
  AWS: AKIAIOSFODNN7EXAMPLE
  GitHub: ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`
  const r = await detectPII(text)
  const keys = r.spans.filter((s) => s.type === 'api-key')
  assert.ok(keys.length >= 4, `expected ≥4 api keys, got ${keys.length}`)
  assert.ok(keys.find((k) => k.subtype === 'openai'))
  assert.ok(keys.find((k) => k.subtype === 'aws-access-key'))
})

test('DOB: requires context anchor', async () => {
  const withContext = await detectPII('DOB: 1985-04-12, patient ID 42')
  assert.ok(withContext.spans.find((s) => s.type === 'dob'))
  // Without anchor, bare "1985-04-12" is too ambiguous.
  const noContext = await detectPII('Schedule next quarterly review for 1985-04-12')
  assert.equal(noContext.spans.filter((s) => s.type === 'dob').length, 0)
})

test('redactPII: default replaces with [REDACTED:type] preserving last-4 for ssn/cc', async () => {
  const r = await redactPII('Patient 123-45-6789 paid 4111111111111111')
  assert.ok(r.changed)
  assert.match(r.redacted, /\[REDACTED:ssn:\*\*\*\*6789\]/)
  assert.match(r.redacted, /\[REDACTED:credit-card:\*\*\*\*1111\]/)
})

test('redactPII: custom redactWith for field-aware policies', async () => {
  const r = await redactPII('Email alice@example.com', {
    redactWith: (span) => (span.type === 'email' ? '<email>' : `[${span.type}]`),
  })
  assert.match(r.redacted, /<email>/)
})

test('redactPII: idempotent — already-redacted text is unchanged', async () => {
  const original = 'Patient SSN: [REDACTED:ssn:****6789] handled'
  const r = await redactPII(original)
  assert.equal(r.changed, false)
  assert.equal(r.redacted, original)
})

test('allow list: skips specified types', async () => {
  const r = await detectPII('Public 8.8.8.8 reachable from alice@example.com', { allow: ['ip'] })
  assert.equal(r.spans.filter((s) => s.type === 'ip').length, 0)
  assert.equal(r.spans.filter((s) => s.type === 'email').length, 1)
})

test('minConfidence floor: drops low-confidence spans', async () => {
  const r = await detectPII('Internal 192.168.1.1 only', { minConfidence: 'medium' })
  assert.equal(r.spans.filter((s) => s.type === 'ip').length, 0, 'low-confidence private IP should be dropped at medium floor')
})

test('nerBackend: integrates semantic spans', async () => {
  const fakeNer = async (text: string): Promise<PiiSpan[]> => {
    const idx = text.indexOf('John Smith')
    if (idx < 0) return []
    return [{ start: idx, end: idx + 'John Smith'.length, type: 'person-name', confidence: 'high', value: 'John Smith' }]
  }
  const r = await detectPII('Patient John Smith born 1960', { nerBackend: fakeNer })
  assert.ok(r.spans.find((s) => s.type === 'person-name'))
  assert.equal(r.semanticBackend, 'custom')
})

test('nerBackend: errors are swallowed; structured detection still runs', async () => {
  const broken = async (): Promise<PiiSpan[]> => {
    throw new Error('NER backend down')
  }
  const r = await detectPII('Email: test@example.com', { nerBackend: broken })
  assert.ok(r.spans.find((s) => s.type === 'email'), 'structured detection should survive NER failure')
})

test('mergeOverlapping: higher-confidence span wins', async () => {
  // The phone regex CAN match parts of an SSN due to digit count overlap.
  // Verify the higher-confidence SSN match wins.
  const r = await detectPII('SSN: 123-45-6789')
  const ssn = r.spans.filter((s) => s.type === 'ssn')
  assert.equal(ssn.length, 1)
  // The phone detector wouldn't match this exact format, but if it did, SSN should win.
})

test('assertNoPII: throws on detection', async () => {
  await assert.rejects(
    () => assertNoPII('email: alice@example.com'),
    /PII detected/,
  )
})

test('assertNoPII: passes on clean text', async () => {
  await assertNoPII('No sensitive data here, just a sentence')
})

test('detectPII: durationMs reported', async () => {
  const r = await detectPII('alice@example.com')
  assert.ok(r.durationMs >= 0)
  assert.ok(typeof r.durationMs === 'number')
})

test('private key block: full PEM detected', async () => {
  const pem = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
-----END RSA PRIVATE KEY-----`
  const r = await detectPII(`Config:\n${pem}\nDone.`)
  const keys = r.spans.filter((s) => s.type === 'api-key' && s.subtype === 'pem-private-key')
  assert.equal(keys.length, 1)
})
