import assert from 'node:assert/strict'
import test from 'node:test'
import { planPrompt } from '../dist/lib/prompt-planner.js'
import { createContextPack } from '../dist/lib/context-pack.js'
import { __setTestEnhancer } from '../dist/lib/build-plan.js'
import { createTempDir, removeDir } from '../dist/lib/fs.js'

test('llmBuildPlan replaces firstMoves via enhancer', async () => {
  __setTestEnhancer(async ({ base, spec }) => ({
    ...base,
    firstMoves: [`LLM:goal:${spec.userPrompt ?? ''}`, 'LLM:step2'],
  }))

  const plan = await planPrompt({ prompt: 'Build a Golang API with Postgres', partner: null })
  if (plan.kind !== 'starter') throw new Error('expected starter')

  const outDir = await createTempDir('starter-foundry-llm-test')
  try {
    const { contextPack } = await createContextPack({
      spec: plan.spec,
      outDir,
      llmBuildPlan: true,
    })
    assert.ok(contextPack.buildPlan)
    const firstMoves = contextPack.buildPlan.firstMoves
    assert.ok(
      firstMoves.some((m: string) => m.startsWith('LLM:goal:')),
      `expected LLM-produced firstMove, got ${JSON.stringify(firstMoves)}`,
    )
  } finally {
    await removeDir(outDir)
    __setTestEnhancer(null)
  }
})

test('llmBuildPlan flag off keeps deterministic firstMoves', async () => {
  __setTestEnhancer(async () => {
    throw new Error('enhancer should not be invoked when llmBuildPlan is false')
  })

  const plan = await planPrompt({ prompt: 'Build a Golang API with Postgres', partner: null })
  if (plan.kind !== 'starter') throw new Error('expected starter')

  const outDir = await createTempDir('starter-foundry-llm-off-test')
  try {
    const { contextPack } = await createContextPack({
      spec: plan.spec,
      outDir,
      llmBuildPlan: false,
    })
    assert.ok(contextPack.buildPlan)
    for (const m of contextPack.buildPlan.firstMoves) {
      assert.ok(!m.startsWith('LLM:'), 'deterministic plan should not contain LLM markers')
    }
  } finally {
    await removeDir(outDir)
    __setTestEnhancer(null)
  }
})
