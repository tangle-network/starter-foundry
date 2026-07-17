/** Tests profile coherence without relying on persistent runner state. */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const SCRIPT = resolve(REPO, 'scripts', 'check-profile-coherence.ts')

function runScript(lockPath: string, profilesDir: string) {
  return spawnSync(resolve(REPO, 'node_modules/.bin/tsx'), [SCRIPT, lockPath, profilesDir], {
    cwd: REPO,
    encoding: 'utf8',
  })
}

function writeEmptyLock(path: string): void {
  writeFileSync(
    path,
    JSON.stringify({ lockfileVersion: 1, generatedAt: null, responseHash: null, roles: {} }),
  )
}

test('profile coherence rejects a missing snapshot lock', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-profile-coherence-'))
  try {
    const result = runScript(join(dir, 'missing.lock.json'), dir)

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /lock file missing/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('profile coherence rejects an empty profiles directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-profile-coherence-'))
  try {
    const profilesDir = join(dir, 'profiles')
    mkdirSync(profilesDir)
    const lockPath = join(dir, 'snapshots.lock.json')
    writeEmptyLock(lockPath)

    const result = runScript(lockPath, profilesDir)

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /no profiles found/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('empty snapshot lock validates every profile merge path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-profile-coherence-'))
  try {
    const lockPath = join(dir, 'snapshots.lock.json')
    writeEmptyLock(lockPath)
    writeFileSync(
      join(dir, 'default.profile.json'),
      JSON.stringify({
        logicalModel: 'stable',
        alias: 'model-alias',
        temperature: 0,
        maxTokens: 1024,
        costCeilingUsd: 0.5,
      }),
    )

    const result = runScript(lockPath, dir)

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /1 profile\(s\) resolve cleanly/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('empty snapshot lock does not hide malformed profiles', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-profile-coherence-'))
  try {
    const lockPath = join(dir, 'snapshots.lock.json')
    writeEmptyLock(lockPath)
    writeFileSync(join(dir, 'invalid.profile.json'), JSON.stringify({ logicalModel: 'stable' }))

    const result = runScript(lockPath, dir)

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /profile\(s\) failed to resolve/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
