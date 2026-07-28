#!/usr/bin/env node
// bootstrap-library.mjs — one-time backfill: for every family that has a
// passing .evolve/review-memory/<family>.summary.json, snapshot the current
// registry state into .evolve/template-library/<family>/v_<hash>/ so we
// have a v1 baseline before the library becomes the primary write path.
// Idempotent — re-running against the same content hash is a no-op.
//
// Usage:
//   node scripts/bootstrap-library.ts          # all passing families
//   node scripts/bootstrap-library.ts --dry-run
//   node scripts/bootstrap-library.ts --only threejs-game,bevy-web

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  cpSync,
} from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MEMORY = join(REPO, '.evolve/review-memory')
const LIB = join(REPO, '.evolve/template-library')
const REGISTRY = join(REPO, 'registry/layers/framework')

const argv = process.argv.slice(2)
function arg(flag, fallback) {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : fallback
}
const DRY = argv.includes('--dry-run')
const ONLY =
  arg('--only', null)
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) ?? null

// Families to bootstrap: every summary.json with finalPass=true.
const candidates = readdirSync(MEMORY)
  .filter((f) => f.endsWith('.summary.json'))
  .map((f) => f.replace(/\.summary\.json$/, ''))
  .filter((fam) => {
    if (ONLY && !ONLY.includes(fam)) return false
    try {
      const s = JSON.parse(readFileSync(join(MEMORY, `${fam}.summary.json`), 'utf8'))
      return s.finalPass === true
    } catch {
      return false
    }
  })
  .sort()

console.log(`bootstrap-library: ${candidates.length} passing families${DRY ? ' (dry-run)' : ''}`)

let created = 0
let skipped = 0

function hashLayerDir(famDir) {
  const h = createHash('sha256')
  const manifestPath = join(famDir, 'manifest.json')
  if (existsSync(manifestPath)) h.update(readFileSync(manifestPath))
  const filesRoot = join(famDir, 'files')
  if (existsSync(filesRoot)) {
    const paths = []
    const walk = (dir) => {
      for (const e of readdirSync(dir).sort()) {
        const full = join(dir, e)
        const s = statSync(full)
        if (s.isDirectory()) walk(full)
        else paths.push(full)
      }
    }
    walk(filesRoot)
    for (const p of paths) {
      h.update(relative(famDir, p))
      h.update(readFileSync(p))
    }
  }
  return h.digest('hex').slice(0, 12)
}

for (const family of candidates) {
  const famDir = join(REGISTRY, family)
  if (!existsSync(famDir)) {
    console.log(`  − ${family}: registry dir missing`)
    skipped++
    continue
  }
  const hash = hashLayerDir(famDir)
  const libDir = join(LIB, family, `v_${hash}`)
  if (existsSync(libDir)) {
    console.log(`  · ${family}: v_${hash} already exists (no-op)`)
    skipped++
    continue
  }
  console.log(`  + ${family}: snapshotting to v_${hash}`)
  if (DRY) continue
  mkdirSync(libDir, { recursive: true })
  const manifestPath = join(famDir, 'manifest.json')
  const filesRoot = join(famDir, 'files')
  if (existsSync(manifestPath)) cpSync(manifestPath, join(libDir, 'manifest.json'))
  if (existsSync(filesRoot)) cpSync(filesRoot, join(libDir, 'files'), { recursive: true })
  const summaryPath = join(MEMORY, `${family}.summary.json`)
  if (existsSync(summaryPath)) cpSync(summaryPath, join(libDir, 'summary.json'))
  const auditPath = join(MEMORY, `${family}.audit.json`)
  if (existsSync(auditPath)) cpSync(auditPath, join(libDir, 'audit.json'))
  const shotLog = join(MEMORY, `${family}.jsonl`)
  if (existsSync(shotLog)) cpSync(shotLog, join(libDir, 'shot-log.jsonl'))
  created++
}

console.log(`\ndone — ${created} snapshotted, ${skipped} skipped`)
