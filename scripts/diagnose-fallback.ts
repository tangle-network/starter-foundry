#!/usr/bin/env tsx
// Diagnose: which 4 BA H1 catalog prompts degrade to frontend-static + saas?
// Print the top-5 scoring candidates for each.

import { selectStarter } from '../src/lib/selection.js'

const PROMPTS = [
  'compiler-lexer-dfa',
  'algo-suffix-array-sais',
  'todo-asyncstorage',
  'godot-character-movement',
  // Resilience checks — should be UNROUTEABLE, not silently degraded:
  'unknown-tech-cluster',
  'kafka-consumer-saga',
  'webrtc-signaling-coturn',
  'cuda-matmul-kernel',
  'embedding-faiss-cosine',
  // Natural language — should still route as before:
  'build me a tax filer for an LLC',
  'I want a personal portfolio site',
]

for (const p of PROMPTS) {
  const res = await selectStarter({ prompt: p })
  console.log(`\n── prompt: "${p}"`)
  console.log(`   confidence:    ${res.confidence}`)
  console.log(`   routingRisk:   ${res.routingRisk}`)
  console.log(`   fallbackUsed:  ${res.fallbackUsed}`)
  console.log(`   chosen family: ${res.spec.family}`)
  console.log(`   chosen layers: ${(res.spec.layers ?? []).join(', ')}`)
  console.log(`   reasons:       ${res.reasons.join(' | ')}`)
}
