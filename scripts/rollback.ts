#!/usr/bin/env node
// Rollback infrastructure — one-shot revert a shipped version. Ships
// per-version rollback metadata in .evolve/versions/<semver>.json so
// we can restore a previous registry state bit-identically.
//
// When to use: a shipped version ships a regression (CVE bump breaks
// install, template rewrite regresses pass rate) and we need to
// revert quickly without rebuilding from scratch.
//
// Usage:
//   node scripts/rollback.ts --list
//   node scripts/rollback.ts --to <version>            # dry-run
//   node scripts/rollback.ts --to <version> --apply    # actually revert

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VERSIONS = join(REPO, '.evolve/versions')

const args = process.argv.slice(2)
function arg(k, fb) {
  const i = args.indexOf(k)
  return i >= 0 ? args[i + 1] : fb
}
const LIST = args.includes('--list')
const TO = arg('--to')
const APPLY = args.includes('--apply')

mkdirSync(VERSIONS, { recursive: true })

if (LIST) {
  const files = readdirSync(VERSIONS)
    .filter((f) => f.endsWith('.json'))
    .sort()
  if (files.length === 0) {
    console.log('no snapshots recorded — run `node scripts/rollback.ts --snapshot` after a release')
    process.exit(0)
  }
  console.log('available snapshots:')
  for (const f of files) {
    const snap = JSON.parse(readFileSync(join(VERSIONS, f), 'utf8'))
    console.log(
      `  ${f.replace('.json', '').padEnd(16)}  commit ${snap.commitSha?.slice(0, 12)}  ${snap.recordedAt}`,
    )
  }
  process.exit(0)
}

if (args.includes('--snapshot')) {
  // Record the current commit SHA + package.json version as a rollback target.
  const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'))
  const version = pkg.version
  const commitSha = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPO,
    encoding: 'utf8',
  }).stdout.trim()
  const snap = {
    version,
    commitSha,
    recordedAt: new Date().toISOString(),
    familyCount: readdirSync(join(REPO, 'registry/families')).length,
    capabilityCount: readdirSync(join(REPO, 'registry/layers/capability')).length,
  }
  const path = join(VERSIONS, `${version}.json`)
  writeFileSync(path, JSON.stringify(snap, null, 2))
  console.log(`wrote snapshot: ${path}`)
  process.exit(0)
}

if (!TO) {
  console.error('usage: rollback.mjs --list | --snapshot | --to <version> [--apply]')
  process.exit(2)
}

const snapPath = join(VERSIONS, `${TO}.json`)
if (!existsSync(snapPath)) {
  console.error(`no snapshot for ${TO} — run with --list to see available versions`)
  process.exit(1)
}
const snap = JSON.parse(readFileSync(snapPath, 'utf8'))

console.log(`rollback target: ${TO}`)
console.log(`  commit:        ${snap.commitSha}`)
console.log(`  recordedAt:    ${snap.recordedAt}`)
console.log(`  registry:      ${snap.familyCount} families, ${snap.capabilityCount} caps`)

if (!APPLY) {
  console.log('\n(dry-run) pass --apply to actually revert')
  process.exit(0)
}

// Apply: checkout the commit on a new branch named rollback/<timestamp>
// and open a PR that the operator can review + merge. Does NOT push to
// main directly — rollback is still a human-reviewed action.
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const branch = `rollback/${TO}-${stamp}`

function sh(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8' })
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')}: ${res.stderr?.slice(0, 400)}`)
  }
  return res.stdout?.trim() ?? ''
}

try {
  sh('git', ['fetch', 'origin', '--tags'])
  sh('git', ['checkout', '-B', branch, snap.commitSha])
  sh('git', ['push', '-u', 'origin', branch, '--force'])
  sh('gh', [
    'pr',
    'create',
    '--base',
    'main',
    '--head',
    branch,
    '--title',
    `rollback: restore v${TO}`,
    '--body',
    [
      `## Rollback to v${TO}`,
      '',
      `Restores the registry state from commit \`${snap.commitSha.slice(0, 12)}\` (recorded ${snap.recordedAt}).`,
      '',
      '### Reason',
      "(Fill in: what regressed and why we're rolling back)",
      '',
      '### Expected state after merge',
      `- ${snap.familyCount} families`,
      `- ${snap.capabilityCount} capability layers`,
      '',
      'Review the diff before merging — this PR overwrites current registry state with the snapshotted version.',
    ].join('\n'),
  ])
  console.log(`\n✓ rollback PR opened on branch ${branch}`)
} catch (err) {
  console.error('rollback failed:', err.message)
  process.exit(1)
}
