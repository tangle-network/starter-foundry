#!/usr/bin/env node
// gc-template-library.mjs — keep top-N versions per family by quality score;
// archive the rest to .evolve/template-library-archive/<family>/<version>/.
// Default is dry-run so catastrophic-delete is impossible without --apply.
//
// Usage:
//   node scripts/gc-template-library.ts                 # dry-run, keep 20 top
//   node scripts/gc-template-library.ts --apply         # actually archive
//   node scripts/gc-template-library.ts --keep 10 --apply
//   node scripts/gc-template-library.ts --family X --keep 5 --apply

import { readFileSync, existsSync, readdirSync, mkdirSync, cpSync, rmSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LIB = join(REPO, '.evolve/template-library')
const ARCHIVE = join(REPO, '.evolve/template-library-archive')

const argv = process.argv.slice(2)
function arg(flag, fallback) {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : fallback
}
const KEEP = Math.max(1, Number.parseInt(arg('--keep', '20'), 10))
const APPLY = argv.includes('--apply')
const ONLY_FAMILY = arg('--family', null)

if (!existsSync(LIB)) {
  console.log('no library to GC — .evolve/template-library/ missing')
  process.exit(0)
}

const families = ONLY_FAMILY
  ? [ONLY_FAMILY]
  : readdirSync(LIB).filter((e) => {
      const full = join(LIB, e)
      return !e.startsWith('.') && !e.startsWith('_') && statSync(full).isDirectory()
    })

let kept = 0
let archived = 0

for (const family of families) {
  const famDir = join(LIB, family)
  const indexPath = join(famDir, '_index.json')
  if (!existsSync(indexPath)) {
    console.log(`  − ${family}: no _index.json (promote first)`)
    continue
  }
  let index
  try {
    index = JSON.parse(readFileSync(indexPath, 'utf8'))
  } catch {
    console.log(`  − ${family}: malformed _index.json`)
    continue
  }
  // `index.all` is already sorted by scan order, not score. Pull score from
  // each entry; fallback to 0 for skipped/broken versions.
  const scored = (index.all ?? []).filter((e) => !e.skipped && typeof e.score === 'number')
  scored.sort((a, b) => b.score - a.score || a.version.localeCompare(b.version))
  const keepSet = new Set(scored.slice(0, KEEP).map((e) => e.version))
  // Always keep `current` + everything in `topN` even if they'd be GC'd by score.
  if (index.current) keepSet.add(index.current)
  for (const v of index.topN ?? []) keepSet.add(v)

  const allVersions = readdirSync(famDir).filter((e) => e.startsWith('v_'))
  const toArchive = allVersions.filter((v) => !keepSet.has(v))

  if (toArchive.length === 0) {
    console.log(
      `  ✓ ${family}: ${allVersions.length} versions, all within keep=${KEEP} (no archive)`,
    )
    kept += allVersions.length
    continue
  }

  console.log(
    `  ~ ${family}: keeping ${keepSet.size}, archiving ${toArchive.length}${APPLY ? '' : ' (dry-run)'}`,
  )
  if (APPLY) {
    const archiveFam = join(ARCHIVE, family)
    mkdirSync(archiveFam, { recursive: true })
    for (const v of toArchive) {
      const from = join(famDir, v)
      const to = join(archiveFam, v)
      cpSync(from, to, { recursive: true })
      rmSync(from, { recursive: true, force: true })
    }
  }
  kept += keepSet.size
  archived += toArchive.length
}

console.log(`\ndone — kept ${kept}, archived ${archived}${APPLY ? '' : ' (dry-run)'}`)
