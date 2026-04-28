/**
 * Snapshot resolver tests — uses an injected fetcher (the ONLY allowed mock,
 * standing in for the Tangle router model-list process boundary). Live
 * integration with the real router runs only when TANGLE_API_KEY is set.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  _resetSnapshotCache,
  refreshSnapshots,
  resolveSnapshot,
  type AnthropicModelsResponse,
  type SnapshotsLock,
} from '../dist/lib/snapshot-resolver.js'

function freshLock(): { dir: string; lockPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'sf-snap-'))
  const lockPath = join(dir, 'snapshots.lock.json')
  const initial: SnapshotsLock = {
    lockfileVersion: 1,
    generatedAt: null,
    responseHash: null,
    roles: {
      'stable-sonnet-4-6': {
        logicalName: 'stable-sonnet-4-6',
        alias: 'claude-sonnet-4-6',
        snapshot: 'unresolved',
        resolvedAt: 'never',
        deprecatesAt: null,
      },
    },
  }
  writeFileSync(lockPath, JSON.stringify(initial, null, 2))
  return { dir, lockPath }
}

// MOCK: TCloud SDK / router model-list process boundary. Standing in for
// `new TCloudClient({ apiKey }).models()` per CLAUDE.md "Real-system tests"
// rule (only allowed mock = process boundary). Integration test below
// hits the real router when TANGLE_API_KEY is set.
function fakeFetcher(ids: string[]): () => Promise<AnthropicModelsResponse> {
  return async () => ({
    data: ids.map((id) => ({ id, display_name: id })),
    has_more: false,
  })
}

test('refreshSnapshots --apply pins newest matching snapshot', async () => {
  const { dir, lockPath } = freshLock()
  try {
    _resetSnapshotCache()
    const report = await refreshSnapshots({
      apply: true,
      lockPath,
      fetcher: fakeFetcher([
        'claude-sonnet-4-5-20250715',
        'claude-sonnet-4-5-20250929',
        'claude-opus-4-7-20251001',
      ]),
      now: () => new Date('2026-04-27T00:00:00Z'),
    })
    assert.equal(report.ok, true)
    assert.equal(report.entries.length, 1)
    assert.equal(report.entries[0].newSnapshot, 'claude-sonnet-4-5-20250929')
    const written = JSON.parse(readFileSync(lockPath, 'utf8')) as SnapshotsLock
    assert.equal(written.roles['stable-sonnet-4-6'].snapshot, 'claude-sonnet-4-5-20250929')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('refreshSnapshots --check warns within deprecation window', async () => {
  const { dir, lockPath } = freshLock()
  try {
    _resetSnapshotCache()
    // Apply first
    await refreshSnapshots({
      apply: true,
      lockPath,
      fetcher: fakeFetcher(['claude-sonnet-4-5-20250929']),
      now: () => new Date('2026-04-27T00:00:00Z'),
    })
    _resetSnapshotCache()
    // Now check with API responding the snapshot is deprecating in 10 days.
    const report = await refreshSnapshots({
      check: true,
      lockPath,
      fetcher: async () => ({
        data: [
          {
            id: 'claude-sonnet-4-5-20250929',
            deprecation: { date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() },
          },
        ],
      }),
    })
    assert.equal(report.ok, true)
    assert.equal(report.warnings.length, 1)
    assert.match(report.warnings[0], /deprecates in/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('refreshSnapshots --check fails past deprecation', async () => {
  const { dir, lockPath } = freshLock()
  try {
    _resetSnapshotCache()
    await refreshSnapshots({
      apply: true,
      lockPath,
      fetcher: fakeFetcher(['claude-sonnet-4-5-20250929']),
    })
    _resetSnapshotCache()
    const report = await refreshSnapshots({
      check: true,
      lockPath,
      fetcher: async () => ({
        data: [
          {
            id: 'claude-sonnet-4-5-20250929',
            deprecation: { date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
          },
        ],
      }),
    })
    assert.equal(report.ok, false)
    assert.ok(report.errors.some((e) => /deprecated/.test(e)))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('resolveSnapshot returns <alias>@<snapshot> form', async () => {
  const { dir, lockPath } = freshLock()
  try {
    _resetSnapshotCache()
    await refreshSnapshots({
      apply: true,
      lockPath,
      fetcher: fakeFetcher(['claude-sonnet-4-5-20250929']),
    })
    _resetSnapshotCache()
    const id = resolveSnapshot('stable-sonnet-4-6', lockPath)
    assert.equal(id, 'claude-sonnet-4-6@claude-sonnet-4-5-20250929')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('resolveSnapshot throws on unknown role', async () => {
  const { dir, lockPath } = freshLock()
  try {
    _resetSnapshotCache()
    assert.throws(() => resolveSnapshot('does-not-exist', lockPath), /does not pin role/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// Live integration. Skipped unless TANGLE_API_KEY is set.
test(
  'refreshSnapshots live router integration',
  { skip: !process.env.TANGLE_API_KEY },
  async () => {
    const { dir, lockPath } = freshLock()
    try {
      _resetSnapshotCache()
      const report = await refreshSnapshots({ apply: true, lockPath })
      assert.equal(report.ok, true)
      assert.ok(report.entries[0].newSnapshot && report.entries[0].newSnapshot.length > 0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  },
)
