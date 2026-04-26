#!/usr/bin/env node
// replay-compose — given a prior composed directory with a .starter-foundry.lock.json,
// re-composes to a fresh tempdir, hashes every file, and asserts byte-identical match.
// Used by the reproducibility test gate and by consumers that want to confirm
// a cached scaffold corresponds to a known-good spec.

import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : fallback
}

const source = arg('--source')
if (!source) {
  console.error('usage: --source <path-to-prior-composed-dir>')
  process.exit(2)
}

const lockPath = join(source, '.starter-foundry.lock.json')
if (!existsSync(lockPath)) {
  console.error(`✗ missing lock file: ${lockPath}`)
  process.exit(2)
}
const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
console.log(`replay: foundryVersion=${lock.foundryVersion}, seed=${lock.seed.slice(0, 12)}...`)

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

function hashTree(root) {
  const out = {}
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (name === '.starter-foundry.lock.json') continue
      if (name === 'node_modules' || name.startsWith('.git')) continue
      const abs = join(dir, name)
      const st = statSync(abs)
      if (st.isDirectory()) {
        walk(abs)
      } else {
        const rel = relative(root, abs)
        out[rel] = sha256(readFileSync(abs))
      }
    }
  }
  walk(root)
  return out
}

const { composeStarter } = await import(join(REPO, 'dist/lib/compose.js'))
const { verifyLockMatches } = await import(join(REPO, 'dist/lib/reproducibility.js'))

const replayDir = mkdtempSync(join(tmpdir(), 'sf-replay-'))
try {
  await composeStarter({ spec: lock.spec, outDir: replayDir })
  const replayHashes = hashTree(replayDir)
  const result = verifyLockMatches(lock, replayHashes)
  if (result.ok) {
    console.log(`✓ bit-identical — ${Object.keys(replayHashes).length} files match`)
    process.exit(0)
  }
  console.error(`✗ replay drift:`)
  if (result.missing.length > 0) console.error(`  missing (in replay): ${result.missing.length}`)
  for (const p of result.missing.slice(0, 5)) console.error(`    - ${p}`)
  if (result.extra.length > 0) console.error(`  extra (new in replay): ${result.extra.length}`)
  for (const p of result.extra.slice(0, 5)) console.error(`    + ${p}`)
  if (result.differing.length > 0) console.error(`  differing: ${result.differing.length}`)
  for (const d of result.differing.slice(0, 5)) {
    console.error(`    ~ ${d.path}: expected ${d.expected.slice(0, 12)} got ${d.actual.slice(0, 12)}`)
  }
  process.exit(1)
} finally {
  rmSync(replayDir, { recursive: true, force: true })
}
