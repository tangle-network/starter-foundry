// Consumer integration test — mimics blueprint-agent's full usage of the
// public SDK surface. If this test breaks, downstream consumers break.
//
// Shape under test:
//   1. composeFromPrompt — end-to-end prompt → composed scaffold
//   2. validatePlan — pre-compose dry-run of a hand-built spec
//   3. listRegistry — query available families/capabilities/partners
//   4. emitBuildoutEvent — push a trace back into the pipeline
//   5. ComposeResult.promptFragment — per-family identity for consumer prompts

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { composeFromPrompt } from '../dist/lib/compose-prompt.js'
import { validatePlan } from '../dist/lib/validate-plan.js'
import { listRegistry } from '../dist/lib/registry.js'
import { emitBuildoutEvent } from '../dist/lib/buildout-traces.js'
import { createTempDir, removeDir } from '../dist/lib/fs.js'

test('consumer-flow: listRegistry returns stable shape', async () => {
  const r = await listRegistry()
  assert.ok(Array.isArray(r.families) && r.families.length > 0)
  assert.ok(Array.isArray(r.layers) && r.layers.length > 0)
  assert.ok(Array.isArray(r.partners) && r.partners.length > 0)
  const fam = r.families[0]!
  assert.ok(typeof fam.id === 'string')
  assert.ok(typeof fam.description === 'string')
  assert.ok(Array.isArray(fam.tags))
})

test('consumer-flow: validatePlan catches unknown family + incompatible partner', async () => {
  const bad = await validatePlan({
    projectName: 'x',
    family: 'does-not-exist',
    layers: [],
    partner: null,
    slots: {},
    variables: {},
  })
  assert.equal(bad.ok, false)
  assert.ok(bad.issues.some((i) => /unknown family/.test(i.message)))

  const badPartner = await validatePlan({
    projectName: 'y',
    family: 'remix-ts',
    layers: [],
    partner: 'tangle',  // tangle isn't in remix-ts's partner set
    slots: {},
    variables: {},
  })
  assert.equal(badPartner.ok, false)
  assert.ok(badPartner.issues.some((i) => /partner.*not.*apply/i.test(i.message) || /does not apply/i.test(i.message)))
})

test('consumer-flow: validatePlan passes on a valid spec', async () => {
  const ok = await validatePlan({
    projectName: 'demo',
    family: 'react-vite-ts',
    layers: ['framework:react-vite-ts', 'capability:shadcn', 'capability:tailwind'],
    partner: null,
    slots: {},
    variables: {},
  })
  assert.equal(ok.ok, true, `expected ok plan to validate; issues: ${JSON.stringify(ok.issues)}`)
})

test('consumer-flow: composeFromPrompt → compose → emit outcome back', async () => {
  // End-to-end: the exact sequence a bench runner executes.
  const outDir = await createTempDir('sf-consumer-flow')
  const tracesDir = await createTempDir('sf-consumer-traces')
  const tracesFile = path.join(tracesDir, 'buildouts.jsonl')
  try {
    const result = await composeFromPrompt({
      prompt: 'Build a React Vite single page app with a dashboard',
      outDir,
    })
    assert.ok(result.kind === 'starter' || result.kind === 'workspace', `kind: ${result.kind}`)
    if (result.kind !== 'starter') return

    // AGENTS.md is shipped and contains progressive-disclosure sections.
    const agentsMd = await fs.readFile(path.join(outDir, 'AGENTS.md'), 'utf8')
    assert.match(agentsMd, /## Turn 1/, 'AGENTS.md must have progressive-disclosure turn-order sections')
    assert.match(agentsMd, /## Before first preview/, 'AGENTS.md must have Before-preview section')
    assert.match(agentsMd, /## Placeholders — MUST replace/, 'AGENTS.md must name placeholders')

    // promptFragment surface — blueprint-agent reads this to splice into system prompt.
    assert.equal(typeof result.result.promptFragment, 'string', 'composeResult.promptFragment must be string')

    // Emit a fake outcome back.
    const event = await emitBuildoutEvent(
      {
        sessionId: 'consumer-flow-1',
        sourceModel: 'integration-test',
        scenarioId: 'consumer-flow',
        initialPrompt: 'Build a React Vite single page app with a dashboard',
        addedPackages: [{ pm: 'pnpm', name: 'recharts' }],
        outcome: {
          source: 'vb-execution',
          allPass: true,
          blendedScore: 0.92,
          failingLayers: [],
          shotsRun: 1,
          shotsToConvergence: 1,
          wallMs: 30_000,
          toolCallsTotal: 5,
        },
      },
      { path: tracesFile },
    )
    assert.equal(event.sessionId, 'consumer-flow-1')

    const tracesRaw = await fs.readFile(tracesFile, 'utf8')
    assert.ok(tracesRaw.includes('consumer-flow-1'))
  } finally {
    await removeDir(outDir)
    await removeDir(tracesDir)
  }
})

test('consumer-flow: promptFragment is populated when family ships one', async () => {
  // nextjs-ts ships a prompt-fragment.md; react-vite-ts doesn't yet.
  const outDir = await createTempDir('sf-fragment-test')
  try {
    const result = await composeFromPrompt({
      prompt: 'Build a Next.js app router project with SEO metadata',
      outDir,
    })
    if (result.kind !== 'starter') return
    assert.ok(
      result.result.promptFragment.length > 50,
      `nextjs-ts ships a prompt-fragment.md; promptFragment should be populated. Got length: ${result.result.promptFragment.length}`,
    )
    assert.ok(
      result.result.promptFragment.toLowerCase().includes('app router'),
      'nextjs-ts prompt-fragment should mention App Router',
    )
  } finally {
    await removeDir(outDir)
  }
})
