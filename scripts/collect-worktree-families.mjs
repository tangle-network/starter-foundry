#!/usr/bin/env node
// Collect new families/layers from all `.claude/worktrees/agent-*` worktrees
// and copy into main's registry/. Walks each worktree, diffs registry/
// against the MAIN branch, and cp -R's any NEW families/layers/partners dirs.
//
// Intentionally conservative: only ADDS new top-level dirs under
// registry/{families,layers,partners}/ that don't already exist on main.
// Never overwrites existing registry content — a worktree can't clobber
// main. If two worktrees both added `foo/`, the first one wins and the
// second is reported as a conflict.
//
// Usage:
//   node scripts/collect-worktree-families.mjs [--dry-run]

import { existsSync, readdirSync, statSync, cpSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORKTREE_ROOT = join(REPO, '.claude/worktrees')
const DRY_RUN = process.argv.includes('--dry-run')

const REGISTRY_KINDS = [
  ['families', 'registry/families'],
  ['framework-layers', 'registry/layers/framework'],
  ['capability-layers', 'registry/layers/capability'],
  ['partners', 'registry/partners'],
]

if (!existsSync(WORKTREE_ROOT)) {
  console.log('no worktrees dir — nothing to collect')
  process.exit(0)
}

const worktrees = readdirSync(WORKTREE_ROOT)
  .map((name) => join(WORKTREE_ROOT, name))
  .filter((p) => existsSync(join(p, 'registry')) && statSync(p).isDirectory())

if (worktrees.length === 0) {
  console.log('no registry-bearing worktrees — nothing to collect')
  process.exit(0)
}

const existingOnMain = new Map()
for (const [, relPath] of REGISTRY_KINDS) {
  const absPath = join(REPO, relPath)
  if (!existsSync(absPath)) {
    existingOnMain.set(relPath, new Set())
    continue
  }
  existingOnMain.set(relPath, new Set(readdirSync(absPath)))
}

const collected = { added: [], skipped: [], conflicts: [] }
const added = new Map()
for (const [, relPath] of REGISTRY_KINDS) added.set(relPath, new Set())

for (const wt of worktrees) {
  const wtName = wt.split('/').pop()
  for (const [kind, relPath] of REGISTRY_KINDS) {
    const wtKindDir = join(wt, relPath)
    if (!existsSync(wtKindDir)) continue
    for (const id of readdirSync(wtKindDir)) {
      if (id.startsWith('.') || id.startsWith('_')) continue
      const src = join(wtKindDir, id)
      if (!statSync(src).isDirectory()) continue
      const isOnMain = existingOnMain.get(relPath)?.has(id) ?? false
      if (isOnMain) {
        continue
      }
      const alreadyAdded = added.get(relPath)?.has(id) ?? false
      if (alreadyAdded) {
        collected.conflicts.push({ kind, id, worktree: wtName })
        continue
      }
      const dst = join(REPO, relPath, id)
      if (DRY_RUN) {
        collected.added.push({ kind, id, worktree: wtName, dryRun: true })
      } else {
        mkdirSync(dirname(dst), { recursive: true })
        cpSync(src, dst, { recursive: true })
        collected.added.push({ kind, id, worktree: wtName })
      }
      added.get(relPath)?.add(id)
    }
  }
}

console.log(`\n=== collect-worktree-families ${DRY_RUN ? '(dry-run)' : ''} ===`)
console.log(`scanned worktrees: ${worktrees.length}`)
console.log(`added: ${collected.added.length}`)
for (const a of collected.added) console.log(`  + ${a.kind}/${a.id}  ← ${a.worktree}`)
console.log(`conflicts: ${collected.conflicts.length}`)
for (const c of collected.conflicts) console.log(`  ! ${c.kind}/${c.id}  already added from a prior worktree (${c.worktree} skipped)`)

if (!DRY_RUN && collected.added.length > 0) {
  console.log('\nNext:')
  console.log('  1. Review pnpm validate:registry output')
  console.log('  2. Wire routing in src/lib/planner/projects.ts for the new families')
  console.log('  3. Add coverage entries in tests/coverage.test.ts')
  console.log('  4. Update tests/family-vite-pin.test.ts SKIP list for non-JS/non-frontend families')
  const validation = spawnSync('pnpm', ['validate:registry'], { cwd: REPO, encoding: 'utf8' })
  console.log('\n--- validate:registry ---')
  console.log((validation.stdout ?? '').split('\n').slice(-15).join('\n'))
}
