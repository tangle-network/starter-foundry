#!/usr/bin/env node
// rollback-version — reverts the registry to a prior git tag and republishes
// under a fresh patch bump. Records the rollback to .evolve/rollbacks.jsonl
// so src/lib/version-history.ts can expose isVersionRolledBack() to clients.
//
// Usage:
//   node scripts/rollback-version.mjs --to v0.5.3 --reason "regression in family X"
// Dry-run (no git / npm actions, only emits the rollback record):
//   node scripts/rollback-version.mjs --to v0.5.3 --reason "..." --dry-run

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROLLBACK_LOG = join(REPO, '.evolve/rollbacks.jsonl')

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const flag = (n) => process.argv.includes(n)

const targetTag = arg('--to')
const reason = arg('--reason', '(no reason given)')
const dryRun = flag('--dry-run')

if (!targetTag) {
  console.error('usage: --to <tag> --reason "..." [--dry-run]')
  process.exit(2)
}

// Verify the tag exists.
const tagCheck = spawnSync('git', ['rev-parse', '--verify', `refs/tags/${targetTag}`], {
  cwd: REPO,
  encoding: 'utf8',
})
if (tagCheck.status !== 0) {
  console.error(`✗ tag not found: ${targetTag}`)
  process.exit(2)
}

const currentVersion = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).version
// Patch-bump the current version so the rollback release is monotonic.
const [major, minor, patch] = currentVersion.split('.').map((n) => parseInt(n, 10))
const newVersion = `${major}.${minor}.${patch + 1}`

console.log(`rollback plan:`)
console.log(`  current version:  ${currentVersion}`)
console.log(`  target tag:       ${targetTag}`)
console.log(`  new version:      ${newVersion} (patch bump after rollback)`)
console.log(`  reason:           ${reason}`)

const record = {
  schemaVersion: 1,
  loggedAt: new Date().toISOString(),
  fromVersion: currentVersion,
  toTag: targetTag,
  newVersion,
  reason,
  dryRun,
  actor: process.env.GITHUB_ACTOR ?? process.env.USER ?? 'unknown',
}

mkdirSync(dirname(ROLLBACK_LOG), { recursive: true })
appendFileSync(ROLLBACK_LOG, JSON.stringify(record) + '\n')

if (dryRun) {
  console.log(`\n[dry-run] no git / npm actions taken; record appended to ${ROLLBACK_LOG}`)
  process.exit(0)
}

// 1. Revert the registry to the target tag — but NOT package.json or docs,
//    those track forward.
console.log('\n1. git checkout <tag> -- registry/ corpus/')
let r = spawnSync('git', ['checkout', targetTag, '--', 'registry/', 'corpus/'], {
  cwd: REPO,
  encoding: 'utf8',
})
if (r.status !== 0) {
  console.error(`✗ checkout failed: ${r.stderr}`)
  process.exit(1)
}

// 2. Bump package.json version.
console.log(`2. bump package.json → ${newVersion}`)
const pkgPath = join(REPO, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
pkg.version = newVersion
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

// 3. Commit.
console.log('3. git commit')
r = spawnSync('git', ['add', 'registry/', 'corpus/', 'package.json'], { cwd: REPO, encoding: 'utf8' })
if (r.status !== 0) {
  console.error(`✗ add failed: ${r.stderr}`)
  process.exit(1)
}
r = spawnSync('git', ['commit', '-m', `chore(rollback): revert registry to ${targetTag} → ${newVersion}\n\n${reason}`], {
  cwd: REPO,
  encoding: 'utf8',
})
if (r.status !== 0) {
  console.error(`✗ commit failed: ${r.stderr}`)
  process.exit(1)
}

console.log(`\n✓ rollback committed (not pushed). Review then push + tag manually:`)
console.log(`  git push origin main`)
console.log(`  git tag v${newVersion} && git push --tags`)
console.log(`  (CI will republish npm on the tag.)`)
console.log(`\nrollback logged → ${ROLLBACK_LOG}`)
