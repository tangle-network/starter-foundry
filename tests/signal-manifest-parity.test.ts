// Enforces D2 single-source-of-truth: every *_ARCHETYPE_SIGNALS export in
// src/lib/planner/signals.ts must equal its corresponding capability
// manifest's tieredKeywords.archetypes array. Makes the eventual removal
// of the signals.ts arrays a mechanical rename instead of a refactor.

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as signals from '../dist/lib/planner/signals.js'
import { loadRegistry } from '../dist/lib/registry.js'

const MAP: Record<string, string> = {
  CHAT_ARCHETYPE_SIGNALS: 'capability:layout-chat',
  CHART_STRONG_SIGNALS: 'capability:chart-widget',
  AI_PRODUCT_PHRASES: 'capability:ai-chat-ui',
  VIDEO_ARCHETYPE_SIGNALS: 'capability:webrtc',
  ADMIN_ARCHETYPE_SIGNALS: 'capability:layout-admin',
  AUTH_ARCHETYPE_SIGNALS: 'capability:layout-auth',
  ZK_BROWSER_ARCHETYPE_SIGNALS: 'capability:zk-browser',
  CODE_EDITOR_ARCHETYPE_SIGNALS: 'capability:code-editor',
  DATE_HEAVY_ARCHETYPE_SIGNALS: 'capability:date-utils',
  SAAS_ARCHETYPE_SIGNALS: 'capability:multi-tenancy',
}

test('signal-manifest parity: every archetype signal array lives in its capability manifest', async () => {
  const registry = await loadRegistry()
  const mismatches: string[] = []
  const mod = signals as unknown as Record<string, string[] | undefined>
  for (const [signalName, capId] of Object.entries(MAP)) {
    const signalArr = mod[signalName]
    if (!Array.isArray(signalArr)) {
      mismatches.push(`${signalName}: not exported from signals.ts`)
      continue
    }
    const layer = registry.layers.get(capId)
    if (!layer) {
      mismatches.push(`${signalName}: ${capId} not in registry`)
      continue
    }
    const manifestArr = layer.tieredKeywords?.archetypes ?? []
    const signalSet = new Set<string>(signalArr)
    const manifestSet = new Set<string>(manifestArr)
    const onlyInSignal = [...signalSet].filter((s: string) => !manifestSet.has(s))
    const onlyInManifest = [...manifestSet].filter((s: string) => !signalSet.has(s))
    if (onlyInSignal.length > 0 || onlyInManifest.length > 0) {
      mismatches.push(
        `${signalName} vs ${capId}.tieredKeywords.archetypes: ${onlyInSignal.length} only-in-signal, ${onlyInManifest.length} only-in-manifest`,
      )
    }
  }
  assert.deepEqual(mismatches, [], `signal/manifest drift:\n  ${mismatches.join('\n  ')}`)
})

test('signal-manifest parity: the list of *_ARCHETYPE_SIGNALS exports exactly matches the MAP', () => {
  // If a new _ARCHETYPE_SIGNALS is added to signals.ts and NOT added to the
  // MAP above + a capability manifest, this test fails loud.
  const source = readFileSync('src/lib/planner/signals.ts', 'utf8')
  const foundExports = new Set<string>()
  const re = /export const (\w+_ARCHETYPE_SIGNALS|\w+_PHRASES|CHART_STRONG_SIGNALS)\s*=/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    foundExports.add(m[1]!)
  }
  const mapped = new Set(Object.keys(MAP))
  const untracked = [...foundExports].filter((e) => !mapped.has(e))
  assert.deepEqual(
    untracked,
    [],
    `${untracked.length} archetype-style export(s) in signals.ts have no capability-manifest mirror:\n  ${untracked.join('\n  ')}`,
  )
})
