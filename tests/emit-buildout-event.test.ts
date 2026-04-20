// Regression tests for the emitBuildoutEvent SDK entrypoint. Downstream
// consumers (blueprint-agent, VB bench runners) call this to feed events
// into the same pipeline the local miner fills from Claude Code sessions.

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { createTempDir, removeDir } from '../dist/lib/fs.js'
import { emitBuildoutEvent, BUILDOUT_SCHEMA_VERSION } from '../dist/lib/buildout-traces.js'

async function readEvents(file: string): Promise<Array<Record<string, unknown>>> {
  const raw = await fs.readFile(file, 'utf8')
  return raw
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l))
}

test('emitBuildoutEvent appends a fully-populated event to the target file', async () => {
  const dir = await createTempDir('sf-emit-bo')
  const target = path.join(dir, '.evolve/traces/buildouts.jsonl')
  try {
    await emitBuildoutEvent(
      {
        sessionId: 'vb-run-42',
        sourceModel: 'blueprint-agent-vb',
        sourcePath: '/runs/42/manifest.json',
        scenarioId: 'nft-mint-page',
        partnerGuess: 'ethereum-l1',
        replayRound: 2,
        initialPrompt: 'Build an NFT mint page',
        addedPackages: [{ pm: 'pnpm', name: 'wagmi' }],
        addedDirs: ['src/mint'],
        rewrittenFiles: ['src/App.tsx'],
        outcome: {
          source: 'vb-execution',
          allPass: true,
          blendedScore: 0.91,
          failingLayers: [],
          shotsRun: 1,
          shotsToConvergence: 1,
          wallMs: 42000,
          toolCallsTotal: 8,
        },
      },
      { path: target },
    )

    const events = await readEvents(target)
    assert.equal(events.length, 1)
    assert.equal(events[0]!.schemaVersion, BUILDOUT_SCHEMA_VERSION)
    assert.equal(events[0]!.sessionId, 'vb-run-42')
    assert.equal(events[0]!.scenarioId, 'nft-mint-page')
    assert.equal((events[0]!.outcome as { allPass: boolean }).allPass, true)
  } finally {
    await removeDir(dir)
  }
})

test('emitBuildoutEvent rejects missing sessionId or sourceModel', async () => {
  await assert.rejects(
    () => emitBuildoutEvent({ sessionId: '', sourceModel: 'x' } as never, { path: '/tmp/never' }),
    /sessionId is required/,
  )
  await assert.rejects(
    () => emitBuildoutEvent({ sessionId: 'x', sourceModel: '' } as never, { path: '/tmp/never' }),
    /sourceModel is required/,
  )
})

test('emitBuildoutEvent is append-safe — concurrent writers do not overwrite each other', async () => {
  // O_APPEND is atomic per write on POSIX. This verifies that interleaved
  // concurrent emits all land as complete JSONL lines.
  const dir = await createTempDir('sf-emit-bo-concurrent')
  const target = path.join(dir, '.evolve/traces/buildouts.jsonl')
  try {
    const writes = Array.from({ length: 20 }, (_, i) =>
      emitBuildoutEvent(
        {
          sessionId: `vb-run-${i}`,
          sourceModel: 'blueprint-agent-vb',
          scenarioId: `scenario-${i}`,
        },
        { path: target },
      ),
    )
    await Promise.all(writes)

    const events = await readEvents(target)
    assert.equal(events.length, 20, `expected 20 events, got ${events.length}`)
    const ids = new Set(events.map((e) => e.sessionId))
    assert.equal(ids.size, 20, 'all sessionIds should be unique (no torn writes)')
  } finally {
    await removeDir(dir)
  }
})

test('emitBuildoutEvent: fills null/empty defaults when optional fields omitted', async () => {
  const dir = await createTempDir('sf-emit-bo-defaults')
  const target = path.join(dir, '.evolve/traces/buildouts.jsonl')
  try {
    const result = await emitBuildoutEvent(
      {
        sessionId: 'minimal',
        sourceModel: 'test',
      },
      { path: target },
    )
    assert.equal(result.scenarioId, null)
    assert.equal(result.partnerGuess, null)
    assert.equal(result.outcome, null)
    assert.deepEqual(result.addedPackages, [])
    assert.deepEqual(result.addedDirs, [])
    assert.deepEqual(result.rewrittenFiles, [])
  } finally {
    await removeDir(dir)
  }
})
