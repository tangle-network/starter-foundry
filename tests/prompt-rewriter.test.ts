import assert from 'node:assert/strict'
import test from 'node:test'
import { planPrompt } from '../dist/lib/prompt-planner.js'
import { __setTestRewriter } from '../dist/lib/prompt-rewriter.js'

test('rewriter skipped on high-confidence prompts', async () => {
  let calls = 0
  __setTestRewriter(async () => {
    calls++
    return {
      canonicalPrompt: 'Build a Next.js SaaS dashboard with Stripe billing',
      confidence: 0.9,
      cacheHit: false,
      latencyMs: 1,
    }
  })

  const confident = await planPrompt({
    prompt: 'Create a Rust HTTP service with axum',
    partner: null,
    rewriter: true,
  })
  assert.equal(confident.kind, 'starter')
  if (confident.kind === 'starter') assert.equal(confident.spec.family, 'rust-service')
  assert.equal(calls, 0, 'rewriter should NOT fire on high-confidence prompt')

  __setTestRewriter(null)
})

test('rewriter fires on low-confidence prompts and re-routes using canonical prompt', async () => {
  let calls = 0
  __setTestRewriter(async () => {
    calls++
    return {
      canonicalPrompt: 'Create a Rust HTTP service with axum',
      confidence: 0.9,
      cacheHit: false,
      latencyMs: 1,
    }
  })

  const vague = await planPrompt({
    prompt: 'I want a thing',
    partner: null,
    rewriter: true,
  })
  assert.equal(calls, 1, 'rewriter should fire on vague/fallback prompt')
  assert.equal(vague.kind, 'starter')
  if (vague.kind === 'starter') assert.equal(vague.spec.family, 'rust-service')

  __setTestRewriter(null)
})

test('rewriter short-circuits gracefully when it returns null', async () => {
  __setTestRewriter(async () => null)

  const result = await planPrompt({
    prompt: 'I want a thing',
    partner: null,
    rewriter: true,
  })
  assert.ok(result.kind === 'starter' || result.kind === 'workspace')

  __setTestRewriter(null)
})

test('rewriter flag disabled means LLM never invoked even on low confidence', async () => {
  let calls = 0
  __setTestRewriter(async () => {
    calls++
    return null
  })

  await planPrompt({ prompt: 'something', partner: null, rewriter: false })
  assert.equal(calls, 0)

  __setTestRewriter(null)
})
