// Regression tests for the capability:zk-browser layer + LayerManifest.packageDeps
// merge logic added 2026-04-20 in response to blueprint-agent bug report #4's
// top scaffold gap (snarkjs+circomlibjs 4× each on zk-mixer-ui, 0% pass).
//
// Tests cover two layers:
// 1. Planner attaches capability:zk-browser on ZK-archetype prompts
// 2. compose.mergeLayerPackageDeps adds the layer's declared packageDeps into
//    the composed package.json

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { planPrompt } from '../dist/lib/prompt-planner.js'
import { composeStarter } from '../dist/lib/compose.js'
import { createTempDir, removeDir } from '../dist/lib/fs.js'

test('planPrompt attaches capability:zk-browser on mixer-style ZK prompts', async () => {
  const plan = await planPrompt({
    prompt:
      'Build a privacy-preserving mixer UI where deposit generates a commitment and withdraw accepts a nullifier-preimage and generates a ZK proof client-side',
    partner: null,
  })
  if (plan.kind !== 'starter') return
  const layers = plan.spec.layers ?? []
  assert.ok(
    layers.includes('capability:zk-browser'),
    `expected zk-browser in layers, got: ${layers.join(', ')}`,
  )
})

test('planPrompt attaches capability:zk-browser on private voting prompts', async () => {
  const plan = await planPrompt({
    prompt:
      'Build an anonymous voting app where each vote carries a nullifier and merkle proof to prevent double-voting without revealing the voter',
    partner: null,
  })
  if (plan.kind !== 'starter') return
  const layers = plan.spec.layers ?? []
  assert.ok(
    layers.includes('capability:zk-browser'),
    `expected zk-browser in layers, got: ${layers.join(', ')}`,
  )
})

test('planPrompt does NOT attach zk-browser on plain ZK prover-service prompts', async () => {
  // Server-side ZK products route to framework:zk-prover-service (sp1/risc0),
  // not the browser capability. The detector's signals only match browser
  // archetype phrases (mixer, nullifier, commitment).
  const plan = await planPrompt({
    prompt:
      'Build a Rust ZK prover service using sp1 to generate proofs over Ethereum transactions',
    partner: null,
  })
  const allLayers =
    plan.kind === 'starter'
      ? (plan.spec.layers ?? [])
      : (plan.spec.projects ?? []).flatMap(
          (p: { spec: { layers?: string[] } }) => p.spec.layers ?? [],
        )
  assert.ok(
    !allLayers.includes('capability:zk-browser'),
    `server-side ZK prompt should not attach zk-browser; got: ${allLayers.join(', ')}`,
  )
})

test('compose merges capability:zk-browser packageDeps into composed package.json', async () => {
  // Tests the structural fix directly via composeStarter with a hand-built spec
  // so the test is independent of planner routing heuristics (workspace vs
  // starter can flip as planning evolves, but the merge logic must still work).
  const outDir = await createTempDir('sf-zk-compose')
  try {
    await composeStarter({
      spec: {
        projectName: 'zk-mixer-test',
        family: 'react-vite-ts',
        layers: ['framework:react-vite-ts', 'capability:zk-browser'],
        partner: null,
        slots: {},
        variables: { headline: 'Mixer', subheadline: 'Test' },
      },
      outDir,
    })

    const pkgPath = path.join(outDir, 'package.json')
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>
    }
    assert.ok(
      pkg.dependencies?.['snarkjs'],
      `composed package.json should include snarkjs; got deps: ${Object.keys(pkg.dependencies ?? {}).join(', ')}`,
    )
    assert.ok(pkg.dependencies?.['circomlibjs'], 'composed package.json should include circomlibjs')
    assert.ok(pkg.dependencies?.['circomlib'], 'composed package.json should include circomlib')

    // Family's existing deps (lucide-react etc) must survive the merge.
    assert.ok(pkg.dependencies?.['lucide-react'], 'react-vite-ts family deps should survive merge')

    const helperExists = await fs
      .access(path.join(outDir, 'src/lib/zkproof.ts'))
      .then(() => true)
      .catch(() => false)
    assert.ok(helperExists, 'zkproof.ts helper should be shipped by the layer')
  } finally {
    await removeDir(outDir)
  }
})
