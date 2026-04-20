import assert from 'node:assert/strict'
import test from 'node:test'
import {
  inferCapabilities,
  loadCapabilityMap,
  summarizeMap,
} from '../dist/lib/capability-inferrer.js'

test('loadCapabilityMap: reads the registry curated file and returns a non-empty mapping', () => {
  const m = loadCapabilityMap()
  assert.ok(m.schemaVersion === 1)
  const entries = Object.entries(m.mapping)
  assert.ok(entries.length > 20, `expected >20 mapping entries, got ${entries.length}`)
  assert.ok(m.mapping['lucide-react']?.capability === 'capability:shadcn')
  assert.ok(m.mapping['tailwindcss']?.capability === 'capability:tailwind')
})

test('loadCapabilityMap: returns empty-default when file missing', () => {
  const m = loadCapabilityMap('non-existent-path.json')
  assert.deepEqual(m.mapping, {})
})

test('inferCapabilities: maps packages to capabilities via the registry map', () => {
  const map = loadCapabilityMap()
  const caps = inferCapabilities(
    {
      sessionId: 't',
      initialPrompt: null,
      scenarioId: null,
      addedPackages: [
        { pm: 'pnpm', name: 'lucide-react' },
        { pm: 'pnpm', name: 'tailwindcss' },
        { pm: 'pnpm', name: 'random-unmapped-package' },
      ],
      addedDirs: [],
    },
    map,
  )
  const caps_ids = caps.map((c) => c.capability).sort()
  assert.deepEqual(caps_ids, ['capability:shadcn', 'capability:tailwind'])
})

test('inferCapabilities: dedupes when multiple packages map to the same capability', () => {
  const map = loadCapabilityMap()
  const caps = inferCapabilities(
    {
      sessionId: 't',
      initialPrompt: null,
      scenarioId: null,
      addedPackages: [
        { pm: 'pnpm', name: 'lucide-react' },
        { pm: 'pnpm', name: 'clsx' },
        { pm: 'pnpm', name: '@radix-ui/react-slot' },
      ],
      addedDirs: [],
    },
    map,
  )
  assert.equal(caps.length, 1)
  assert.equal(caps[0]!.capability, 'capability:shadcn')
})

test('inferCapabilities: dir signals map to capabilities when clean', () => {
  const map = loadCapabilityMap()
  const caps = inferCapabilities(
    {
      sessionId: 't',
      initialPrompt: null,
      scenarioId: null,
      addedPackages: [],
      addedDirs: ['src/payments', 'src/chat', 'src/random'],
    },
    map,
  )
  const ids = caps.map((c) => c.capability).sort()
  assert.deepEqual(ids, ['capability:ai-chat-ui', 'capability:saas-billing'])
})

test('inferCapabilities: package beats dir for same capability — no dup', () => {
  const map = loadCapabilityMap()
  const caps = inferCapabilities(
    {
      sessionId: 't',
      initialPrompt: null,
      scenarioId: null,
      addedPackages: [{ pm: 'pnpm', name: 'stripe' }],
      addedDirs: ['src/payments'],
    },
    map,
  )
  // Package declared first in inferCapabilities walk; dir would add duplicate but is deduped.
  assert.equal(caps.filter((c) => c.capability === 'capability:saas-billing').length, 1)
})

test('inferCapabilities: generic EVM RPC clients alone do not imply wallet-dashboard', () => {
  // Regression: ethers/viem are generic EVM clients used for contract calls,
  // event streams, signing, gas estimation — not specifically wallet UIs.
  // Mapping them to evm-wallet-dashboard produced false positives on
  // zk-mixer-ui (ethers installed for ZK contract submission, not for a
  // wallet dashboard) in .evolve/capability-gaps.json.
  const map = loadCapabilityMap()
  for (const pkg of ['ethers', 'viem']) {
    const caps = inferCapabilities(
      {
        sessionId: 't',
        initialPrompt: null,
        scenarioId: null,
        addedPackages: [{ pm: 'pnpm', name: pkg }],
        addedDirs: [],
      },
      map,
    )
    assert.equal(caps.length, 0, `${pkg} alone should not infer any capability`)
  }
})

test('inferCapabilities: explicit wallet-kit packages still imply wallet-dashboard', () => {
  // The flip side — we trim generic clients but keep signals that ARE
  // wallet-UI-specific (rainbowkit, wagmi's hook ecosystem).
  const map = loadCapabilityMap()
  for (const pkg of ['@rainbow-me/rainbowkit', 'wagmi']) {
    const caps = inferCapabilities(
      {
        sessionId: 't',
        initialPrompt: null,
        scenarioId: null,
        addedPackages: [{ pm: 'pnpm', name: pkg }],
        addedDirs: [],
      },
      map,
    )
    assert.equal(caps[0]?.capability, 'capability:evm-wallet-dashboard', `${pkg} should still infer evm-wallet-dashboard`)
  }
})

test('summarizeMap: produces count stats', () => {
  const map = loadCapabilityMap()
  const s = summarizeMap(map)
  assert.ok(s.distinctPackages > 20)
  assert.ok(s.mappedPackages > 0)
  assert.ok(s.unmappedPackages >= 0)
  assert.equal(typeof s.hasAmbiguous, 'boolean')
})
