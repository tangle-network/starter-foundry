// Regression tests for the capability:agent-eval layer.
//
// Contract:
// 1. Planner attaches capability:agent-eval on agentic prompts that mention
//    eval / quality-gate / benchmark vocabulary.
// 2. Planner does NOT attach it on non-agentic families (react-vite-ts etc.)
//    even if the prompt mentions eval-ish words — the capability's appliesTo
//    field guards this.
// 3. compose.mergeLayerPackageDeps adds @tangle-network/agent-eval to the
//    composed package.json dependencies.

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { planPrompt } from '../dist/lib/prompt-planner.js'
import { composeStarter } from '../dist/lib/compose.js'
import { createTempDir, removeDir } from '../dist/lib/fs.js'

test('planPrompt attaches capability:agent-eval on agentic prompts with eval vocabulary', async () => {
  const plan = await planPrompt({
    prompt: 'Build a TypeScript agent service that handles customer questions. Ship it with an agent eval harness so every PR runs a quality gate against the scenarios.',
    partner: null,
  })
  if (plan.kind !== 'starter') return
  const layers = plan.spec.layers ?? []
  assert.ok(
    layers.includes('capability:agent-eval'),
    `expected capability:agent-eval in layers, got: ${layers.join(', ')}`,
  )
})

test('planPrompt attaches capability:agent-eval on swarm prompts with scoring vocabulary', async () => {
  const plan = await planPrompt({
    prompt: 'Build a research agent swarm with a supervisor and workers. Include a scoring pipeline with LLM as judge for every agent turn.',
    partner: null,
  })
  if (plan.kind !== 'starter') return
  const layers = plan.spec.layers ?? []
  assert.ok(
    layers.includes('capability:agent-eval'),
    `expected capability:agent-eval in layers, got: ${layers.join(', ')}`,
  )
})

test('planPrompt does NOT attach capability:agent-eval on non-agentic families', async () => {
  // React landing page mentions "eval" in a benchmark-review context — but
  // capability:agent-eval.appliesTo is agentic-families-only, so the layer
  // must not attach even if the prompt mentions the vocabulary.
  const plan = await planPrompt({
    prompt: 'Build a React landing page that reviews benchmark results from AI eval reports.',
    partner: null,
  })
  if (plan.kind !== 'starter') return
  const layers = plan.spec.layers ?? []
  assert.ok(
    !layers.includes('capability:agent-eval'),
    `capability:agent-eval must not attach to non-agentic families, got: ${layers.join(', ')}`,
  )
})

test('composeStarter merges @tangle-network/agent-eval into package.json via capability packageDeps', async () => {
  const dir = await createTempDir('agent-eval-compose-')
  try {
    await composeStarter({
      spec: {
        projectName: 'eval-compose-test',
        family: 'agent-swarm-ts',
        layers: ['framework:agent-swarm-ts', 'capability:agent-eval'],
        partner: null,
        slots: {},
        variables: {},
      },
      outDir: dir,
    })
    const pkg = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8'))
    assert.ok(
      pkg.dependencies?.['@tangle-network/agent-eval'],
      `@tangle-network/agent-eval must be in dependencies, got keys: ${Object.keys(pkg.dependencies ?? {}).join(', ')}`,
    )
    // The capability's files should have landed at their targets.
    const runnerExists = await fs.stat(path.join(dir, 'tests/eval/run-eval.mjs')).then(() => true).catch(() => false)
    assert.ok(runnerExists, 'tests/eval/run-eval.mjs missing from composed scaffold')
    const workflowExists = await fs.stat(path.join(dir, '.github/workflows/eval.yml')).then(() => true).catch(() => false)
    assert.ok(workflowExists, '.github/workflows/eval.yml missing from composed scaffold')
  } finally {
    await removeDir(dir)
  }
})
