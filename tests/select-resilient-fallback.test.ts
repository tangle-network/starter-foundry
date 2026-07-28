// Resilient family-selection regression guard. Locks in the Gen 11.5 fix:
//  1. Technical-identifier-shaped prompts (kebab-case noun clusters) MUST
//     either route to a real family OR return routingRisk: 'unrouteable'.
//     They MUST NOT silently degrade to frontend-static.
//  2. The four BA H1 canonical-scaffold catalog prompts that triggered this
//     bug must each route to a non-frontend-static family.
//  3. Natural-language prompts continue to route as before.
//
// Memory: 2026-04-25 BA sweep flagged compiler-lexer-dfa, algo-suffix-array-
// sais, todo-asyncstorage, godot-character-movement bucketed as
// frontend-static + industry:saas. Two of the four (compiler, algo) were real
// silent-degradations; the fix added keywords + an explicit "unrouteable"
// signal so SF refuses to default-route shapes it can't recognize.

import assert from 'node:assert/strict'
import test from 'node:test'
import { selectStarter, isTechnicalIdShape } from '../dist/lib/selection.js'

// ── BA H1 catalog regression — these MUST route to specific families. ──

test('compiler-lexer-dfa routes to wasm-rust (systems → Rust+WASM)', async () => {
  const r = await selectStarter({ prompt: 'compiler-lexer-dfa' })
  assert.equal(r.spec.family, 'wasm-rust')
  assert.equal(r.routingRisk, 'safe')
  assert.equal(r.fallbackUsed, false)
})

test('algo-suffix-array-sais routes to observable-notebook (algorithm research)', async () => {
  const r = await selectStarter({ prompt: 'algo-suffix-array-sais' })
  assert.equal(r.spec.family, 'observable-notebook')
  assert.equal(r.routingRisk, 'safe')
  assert.equal(r.fallbackUsed, false)
})

test('todo-asyncstorage routes to expo-react-native-ts (mobile)', async () => {
  const r = await selectStarter({ prompt: 'todo-asyncstorage' })
  assert.equal(r.spec.family, 'expo-react-native-ts')
  assert.equal(r.routingRisk, 'safe')
})

test('godot-character-movement routes to godot-web (gaming)', async () => {
  const r = await selectStarter({ prompt: 'godot-character-movement' })
  assert.equal(r.spec.family, 'godot-web')
  assert.equal(r.routingRisk, 'safe')
})

// ── Resilience: unknown technical IDs MUST return unrouteable, not silent default. ──

const UNKNOWN_TECH_IDS = [
  'unknown-tech-cluster',
  'kafka-consumer-saga-pattern',
  'cuda-matmul-kernel',
  'embedding-faiss-cosine',
  'libfoo-bar-baz',
]

for (const id of UNKNOWN_TECH_IDS) {
  test(`unrouteable: "${id}" returns routingRisk='unrouteable' instead of silent fallback`, async () => {
    const r = await selectStarter({ prompt: id })
    assert.equal(r.confidence, 'unknown', `confidence must be unknown, got ${r.confidence}`)
    assert.equal(
      r.routingRisk,
      'unrouteable',
      `routingRisk must be unrouteable, got ${r.routingRisk}`,
    )
    assert.equal(r.fallbackUsed, true)
    // Reason string must explain why and what to do — not "no confident match"
    const reason = r.reasons[0] ?? ''
    assert.match(reason, /unrouteable/i)
    assert.match(reason, /technical identifier/i)
  })
}

// ── Natural language unchanged. ──

test('natural-language prompt is never classified unrouteable', async () => {
  // Natural-language prompts contain whitespace; the technical-ID detector
  // requires no whitespace, so any prose phrase is structurally exempt.
  const r = await selectStarter({ prompt: 'build me a tax filer for an LLC' })
  assert.notEqual(
    r.routingRisk,
    'unrouteable',
    'natural-language prompts must not be classified unrouteable',
  )
  assert.notEqual(r.confidence, 'unknown')
})

test('natural-language portfolio prompt routes safely (not unrouteable)', async () => {
  const r = await selectStarter({ prompt: 'I want a personal portfolio site' })
  assert.notEqual(
    r.routingRisk,
    'unrouteable',
    'natural language with spaces must NEVER be classified unrouteable',
  )
})

// ── isTechnicalIdShape unit tests — narrow + specific + adversarial. ──

test('isTechnicalIdShape: kebab-case noun clusters with ≥2 hyphens', () => {
  assert.equal(isTechnicalIdShape('compiler-lexer-dfa'), true)
  assert.equal(isTechnicalIdShape('algo-suffix-array-sais'), true)
  assert.equal(isTechnicalIdShape('kafka-consumer-saga-pattern'), true)
})

test('isTechnicalIdShape: single hyphen is NOT enough (could be hyphenated noun)', () => {
  assert.equal(isTechnicalIdShape('react-native'), false)
  assert.equal(isTechnicalIdShape('hello-world'), false)
})

test('isTechnicalIdShape: anything with whitespace is natural language', () => {
  assert.equal(isTechnicalIdShape('build me an app'), false)
  assert.equal(isTechnicalIdShape('compiler lexer'), false)
})

test('isTechnicalIdShape: stopwords disqualify (state-of-the-art is natural)', () => {
  assert.equal(isTechnicalIdShape('state-of-the-art'), false)
  assert.equal(isTechnicalIdShape('end-to-end-test'), false)
})

test('isTechnicalIdShape: empty / single-word / non-alphanumeric reject', () => {
  assert.equal(isTechnicalIdShape(''), false)
  assert.equal(isTechnicalIdShape('compiler'), false)
  assert.equal(isTechnicalIdShape('compiler.lexer.dfa'), false)
  assert.equal(isTechnicalIdShape('Compiler-Lexer-DFA'), true) // case-insensitive
  assert.equal(isTechnicalIdShape('123-456-789'), false) // must start with letter
})
