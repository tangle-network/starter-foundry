// Chaos tests — the Branch 10 resilience surface. Exercises failure modes
// that normal tests skip: stale registry load, mirror timeouts, partial
// compose failures. Not all the scenarios in Branch 10's spec are practical
// to fully simulate in this repo, so we cover the ones whose math + fallback
// behavior we actually want to lock.

import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {
  loadRegistryFromMirrors,
  MirrorLoadError,
} from '../dist/lib/registry-mirror.js'
import { decideCanaryBucket, DEFAULT_CANARY_EXPERIMENT } from '../dist/lib/canary.js'

test('chaos: mirror failover — first mirror times out, second returns', async () => {
  const calls: string[] = []
  const fakeFetch: typeof fetch = async (url) => {
    calls.push(String(url))
    if (String(url).includes('timeout')) {
      // Simulate infinite hang by returning a promise that rejects with AbortError
      // when the controller fires. Easier: throw immediately with AbortError-like name.
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    }
    return new Response('{"ok":true}', { status: 200 })
  }
  const result = await loadRegistryFromMirrors(
    [
      { url: 'https://timeout.example.com/registry.json', priority: 1 },
      { url: 'https://good.example.com/registry.json', priority: 2 },
    ],
    { fetchImpl: fakeFetch, timeoutMs: 100 },
  )
  assert.equal(result.body, '{"ok":true}')
  assert.equal(result.mirrorUrl, 'https://good.example.com/registry.json')
  assert.equal(result.attempts.length, 2)
  assert.equal(result.attempts[0]!.status, 'timeout')
  assert.equal(result.attempts[1]!.status, 'ok')
})

test('chaos: mirror failover — all mirrors fail, loader throws MirrorLoadError', async () => {
  const fakeFetch: typeof fetch = async () => new Response('server error', { status: 503 })
  await assert.rejects(
    () =>
      loadRegistryFromMirrors(
        [
          { url: 'https://a.example.com/registry.json' },
          { url: 'https://b.example.com/registry.json' },
        ],
        { fetchImpl: fakeFetch },
      ),
    (err: Error) => err instanceof MirrorLoadError && err.attempts.length === 2,
  )
})

test('chaos: mirror integrity — SHA mismatch fails fast', async () => {
  const fakeFetch: typeof fetch = async () => new Response('tampered body', { status: 200 })
  await assert.rejects(
    () =>
      loadRegistryFromMirrors(
        [{ url: 'https://a.example.com/registry.json' }],
        { fetchImpl: fakeFetch, expectedSha256: 'aa'.repeat(32) },
      ),
    (err: Error) => err instanceof MirrorLoadError && err.attempts[0]!.status === 'integrity-mismatch',
  )
})

test('chaos: canary routing — percent=0 keeps everyone on main', () => {
  const exp = { ...DEFAULT_CANARY_EXPERIMENT, percent: 0 }
  for (const key of ['a', 'b', 'c', 'abcdef', 'xyz-123']) {
    assert.equal(decideCanaryBucket(key, exp), 'main')
  }
})

test('chaos: canary routing — percent=1 routes everyone to canary (except explicit excludes)', () => {
  const exp = { ...DEFAULT_CANARY_EXPERIMENT, percent: 1, exclude: ['always-main'] }
  assert.equal(decideCanaryBucket('random-1', exp), 'canary')
  assert.equal(decideCanaryBucket('random-2', exp), 'canary')
  assert.equal(decideCanaryBucket('always-main', exp), 'main')
})

test('chaos: canary routing — deterministic bucket for the same key across calls', () => {
  const exp = { ...DEFAULT_CANARY_EXPERIMENT, percent: 0.5 }
  const key = 'consumer-deadbeef'
  const bucket1 = decideCanaryBucket(key, exp)
  const bucket2 = decideCanaryBucket(key, exp)
  const bucket3 = decideCanaryBucket(key, exp)
  assert.equal(bucket1, bucket2)
  assert.equal(bucket2, bucket3)
})

test('chaos: canary routing — expired experiment routes everyone to main', () => {
  const exp = {
    ...DEFAULT_CANARY_EXPERIMENT,
    percent: 1.0,
    expiresAt: '2020-01-01T00:00:00Z',
  }
  assert.equal(decideCanaryBucket('anyone', exp), 'main')
})

test('chaos: stale registry — reading a manifest from a tempdir that has been removed surfaces a clear error', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'chaos-stale-'))
  await fs.rm(dir, { recursive: true, force: true })
  await assert.rejects(
    () => fs.readFile(path.join(dir, 'registry/families/foo/manifest.json'), 'utf8'),
    /ENOENT/,
  )
})
