// Validates registry/package-to-capability.json against the live registry.
// A typo in a capability id (e.g. "capability:shadcnn") silently turns that
// entry into a no-op at inference time. This test catches those at build
// time instead of at the next rebuild-the-corpus run.

import assert from 'node:assert/strict'
import test from 'node:test'
import { loadRegistry } from '../dist/lib/registry.js'
import { loadCapabilityMap } from '../dist/lib/capability-inferrer.js'

test('package-to-capability: every non-null capability id exists in the registry', async () => {
  const map = loadCapabilityMap()
  const registry = await loadRegistry()
  const bad: string[] = []
  for (const [pkg, entry] of Object.entries(map.mapping)) {
    if (!entry.capability) continue
    if (!entry.capability.startsWith('capability:')) {
      bad.push(`${pkg}: "${entry.capability}" does not start with "capability:"`)
      continue
    }
    if (!registry.layers.has(entry.capability)) {
      bad.push(`${pkg}: "${entry.capability}" not found in registry layers`)
    }
  }
  assert.equal(bad.length, 0, `invalid mappings:\n  ${bad.join('\n  ')}`)
})

test('package-to-capability: confidence values are between 0 and 1', () => {
  const map = loadCapabilityMap()
  const bad: string[] = []
  for (const [pkg, entry] of Object.entries(map.mapping)) {
    if (typeof entry.confidence !== 'number') bad.push(`${pkg}: confidence not a number`)
    else if (entry.confidence < 0 || entry.confidence > 1)
      bad.push(`${pkg}: confidence=${entry.confidence} out of range`)
  }
  assert.equal(bad.length, 0, `bad confidence values:\n  ${bad.join('\n  ')}`)
})

test('package-to-capability: schema version is 1', () => {
  const map = loadCapabilityMap()
  assert.equal(map.schemaVersion, 1)
})
