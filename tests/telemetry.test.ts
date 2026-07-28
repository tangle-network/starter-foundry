import assert from 'node:assert/strict'
import test from 'node:test'
import { planPrompt } from '../dist/lib/prompt-planner.js'
import { composeStarter } from '../dist/lib/compose.js'
import { on, off } from '../dist/lib/telemetry.js'
import type { RouteEvent, ComposeEvent } from '../dist/lib/telemetry.js'
import { createTempDir, removeDir } from '../dist/lib/fs.js'

test('planPrompt emits route event', async () => {
  const events: RouteEvent[] = []
  const handler = (e: RouteEvent) => events.push(e)
  on('route', handler)

  try {
    await planPrompt({ prompt: 'Build a Next.js app with App Router', partner: null })
    assert.equal(events.length, 1)
    assert.equal(events[0]!.kind, 'starter')
    assert.equal(events[0]!.family, 'nextjs-ts')
    assert.ok(events[0]!.durationMs >= 0)
    assert.ok(typeof events[0]!.confidence === 'string')
  } finally {
    off('route', handler)
  }
})

test('planPrompt route event includes capabilities', async () => {
  const events: RouteEvent[] = []
  const handler = (e: RouteEvent) => events.push(e)
  on('route', handler)

  try {
    await planPrompt({
      prompt: 'Build a Next.js app with Tailwind CSS and shadcn/ui components',
      partner: null,
    })
    assert.equal(events.length, 1)
    assert.ok(events[0]!.capabilities.length > 0, 'Should detect capabilities')
  } finally {
    off('route', handler)
  }
})

test('composeStarter emits compose event', async () => {
  const events: ComposeEvent[] = []
  const handler = (e: ComposeEvent) => events.push(e)
  on('compose', handler)

  const outDir = await createTempDir('telemetry-test')
  try {
    const plan = await planPrompt({ prompt: 'Build a static landing page', partner: null })
    if (plan.kind !== 'starter') return
    await composeStarter({ spec: plan.spec, outDir })

    assert.equal(events.length, 1)
    assert.equal(events[0]!.family, 'frontend-static')
    assert.ok(events[0]!.filesWritten.length > 0)
    assert.ok(events[0]!.durationMs >= 0)
  } finally {
    off('compose', handler)
    await removeDir(outDir)
  }
})

test('off() unsubscribes handler', async () => {
  const events: RouteEvent[] = []
  const handler = (e: RouteEvent) => events.push(e)
  on('route', handler)
  off('route', handler)

  await planPrompt({ prompt: 'Build a Go API', partner: null })
  assert.equal(events.length, 0, 'Handler should not fire after off()')
})

test('subscriber errors do not propagate', async () => {
  const handler = () => {
    throw new Error('subscriber crash')
  }
  on('route', handler)

  try {
    // Should not throw despite subscriber error
    const result = await planPrompt({ prompt: 'Build a React app', partner: null })
    assert.equal(result.kind, 'starter')
  } finally {
    off('route', handler)
  }
})
