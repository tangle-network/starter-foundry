/**
 * Profile loader tests — `extends` chains, cycle rejection, override
 * semantics. Uses a temp profiles dir to avoid coupling to the repo's
 * real profiles.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { diffProfiles, listProfileNames, loadProfile } from '../dist/lib/profile-loader.js'

function tempProfilesDir(): string {
  return mkdtempSync(join(tmpdir(), 'sf-prof-'))
}

function writeProfile(dir: string, name: string, content: object): void {
  writeFileSync(join(dir, `${name}.profile.json`), JSON.stringify(content))
}

test('loadProfile resolves a single base profile', () => {
  const dir = tempProfilesDir()
  try {
    writeProfile(dir, 'base', {
      logicalModel: 'stable',
      alias: 'claude-sonnet-4-6',
      temperature: 0.2,
      maxTokens: 2048,
      costCeilingUsd: 0.5,
    })
    const p = loadProfile('base', { profilesDir: dir, skipSnapshotResolve: true })
    assert.equal(p.logicalModel, 'stable')
    assert.equal(p.temperature, 0.2)
    assert.equal(p.model, 'claude-sonnet-4-6@unresolved')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('child profile overrides parent fields', () => {
  const dir = tempProfilesDir()
  try {
    writeProfile(dir, 'parent', {
      logicalModel: 'stable',
      alias: 'claude-sonnet-4-6',
      temperature: 0.2,
      maxTokens: 2048,
      costCeilingUsd: 0.5,
    })
    writeProfile(dir, 'child', {
      extends: 'parent',
      temperature: 0.0,
      maxTokens: 8192,
    })
    const p = loadProfile('child', { profilesDir: dir, skipSnapshotResolve: true })
    assert.equal(p.temperature, 0.0)
    assert.equal(p.maxTokens, 8192)
    assert.equal(p.costCeilingUsd, 0.5) // inherited
    assert.deepEqual(p.chain, ['parent', 'child'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('cycles are rejected', () => {
  const dir = tempProfilesDir()
  try {
    writeProfile(dir, 'a', { extends: 'b', logicalModel: 'x', alias: 'x', temperature: 0, maxTokens: 1, costCeilingUsd: 0 })
    writeProfile(dir, 'b', { extends: 'a', logicalModel: 'x', alias: 'x', temperature: 0, maxTokens: 1, costCeilingUsd: 0 })
    assert.throws(() => loadProfile('a', { profilesDir: dir, skipSnapshotResolve: true }), /cycle/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('chains deeper than 5 are rejected', () => {
  const dir = tempProfilesDir()
  try {
    writeProfile(dir, 'p0', { logicalModel: 'x', alias: 'x', temperature: 0, maxTokens: 1, costCeilingUsd: 0 })
    for (let i = 1; i <= 6; i += 1) {
      writeProfile(dir, `p${i}`, { extends: `p${i - 1}` })
    }
    assert.throws(() => loadProfile('p6', { profilesDir: dir, skipSnapshotResolve: true }), /max depth/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('missing required field throws clearly', () => {
  const dir = tempProfilesDir()
  try {
    writeProfile(dir, 'incomplete', { extends: 'nonexistent' })
    assert.throws(
      () => loadProfile('incomplete', { profilesDir: dir, skipSnapshotResolve: true }),
      /not found/,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('listProfileNames returns kebab-cased stems', () => {
  const dir = tempProfilesDir()
  try {
    writeProfile(dir, 'alpha', {})
    writeProfile(dir, 'beta', {})
    const names = listProfileNames(dir)
    assert.deepEqual(names, ['alpha', 'beta'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('diffProfiles flags only differing fields', () => {
  const dir = tempProfilesDir()
  try {
    writeProfile(dir, 'a', {
      logicalModel: 'stable',
      alias: 'x',
      temperature: 0.0,
      maxTokens: 2048,
      costCeilingUsd: 0.5,
    })
    writeProfile(dir, 'b', {
      logicalModel: 'stable',
      alias: 'x',
      temperature: 0.5,
      maxTokens: 2048,
      costCeilingUsd: 0.5,
    })
    const pa = loadProfile('a', { profilesDir: dir, skipSnapshotResolve: true })
    const pb = loadProfile('b', { profilesDir: dir, skipSnapshotResolve: true })
    const delta = diffProfiles(pa, pb)
    // Two diffs expected: `role` (defaults to name → 'a' vs 'b') + `temperature`.
    const fields = delta.map((d) => d.field).sort()
    assert.deepEqual(fields, ['role', 'temperature'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('repo default profiles resolve cleanly (skipSnapshotResolve)', () => {
  // Sanity check on the actual .evolve/profiles/ — protects against
  // shipping a malformed default.profile.json.
  const profile = loadProfile('default', { skipSnapshotResolve: true })
  assert.equal(profile.role, 'default')
  assert.equal(profile.logicalModel, 'stable-sonnet-4-6')
  const proposer = loadProfile('default-proposer', { skipSnapshotResolve: true })
  assert.equal(proposer.role, 'proposer')
  assert.deepEqual(proposer.chain, ['default', 'default-proposer'])
})
