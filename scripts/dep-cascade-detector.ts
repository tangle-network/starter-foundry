#!/usr/bin/env node
// dep-cascade-detector — finds npm packages used by multiple capability /
// framework layers and flags inconsistent pinned versions across them.
// When a dep is bumped in one layer but not its siblings, the flag surfaces
// in .evolve/proposals/dep-cascade.json so a human (or a follow-up
// cascade-bump script) can coordinate a cross-layer PR.
//
// Ships as a detector, not an auto-fixer: unifying a dep across 5 layers is
// a judgment call the human should make, but surfacing the inconsistency
// before it rots is free.
//
// Usage:
//   node scripts/dep-cascade-detector.ts

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(REPO, '.evolve/proposals/dep-cascade.json')

function collectPackageJsons() {
  const hits = []
  const roots = [
    { root: join(REPO, 'registry/families'), kind: 'family' },
    { root: join(REPO, 'registry/layers/framework'), kind: 'framework-layer' },
    { root: join(REPO, 'registry/layers/capability'), kind: 'capability-layer' },
  ]
  for (const { root, kind } of roots) {
    if (!existsSync(root)) continue
    for (const id of readdirSync(root)) {
      if (id.startsWith('_') || id.startsWith('.')) continue
      const pkgPath = join(root, id, 'files', 'package.json')
      if (!existsSync(pkgPath)) continue
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
        const deps = {
          ...(pkg.dependencies ?? {}),
          ...(pkg.devDependencies ?? {}),
          ...((pkg.peerDependencies ?? {})),
        }
        hits.push({ kind, id, deps, path: pkgPath.replace(REPO + '/', '') })
      } catch {
        /* skip */
      }
    }
  }
  // Also mine capability layers that carry `packageDeps` in manifest.json
  // (the registry's declarative dep shape).
  const capRoot = join(REPO, 'registry/layers/capability')
  if (existsSync(capRoot)) {
    for (const id of readdirSync(capRoot)) {
      if (id.startsWith('_') || id.startsWith('.')) continue
      const manifestPath = join(capRoot, id, 'manifest.json')
      if (!existsSync(manifestPath)) continue
      try {
        const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
        const pd = m.packageDeps ?? {}
        const deps = {
          ...(pd.dependencies ?? {}),
          ...(pd.devDependencies ?? {}),
        }
        if (Object.keys(deps).length === 0) continue
        hits.push({ kind: 'capability-deps', id, deps, path: `registry/layers/capability/${id}/manifest.json` })
      } catch {
        /* skip */
      }
    }
  }
  return hits
}

const rows = collectPackageJsons()

// Group by dep name.
const byDep = new Map()
for (const row of rows) {
  for (const [name, version] of Object.entries(row.deps)) {
    if (typeof version !== 'string') continue
    const bucket = byDep.get(name) ?? []
    bucket.push({ kind: row.kind, id: row.id, version, path: row.path })
    byDep.set(name, bucket)
  }
}

// Flag deps declared in ≥2 layers with >1 distinct version.
const inconsistent = []
for (const [name, uses] of byDep) {
  if (uses.length < 2) continue
  const distinct = new Set(uses.map((u) => u.version))
  if (distinct.size < 2) continue
  inconsistent.push({
    name,
    distinctVersions: [...distinct],
    uses,
    versionCounts: [...distinct].map((v) => ({
      version: v,
      count: uses.filter((u) => u.version === v).length,
    })),
  })
}
inconsistent.sort((a, b) => b.uses.length - a.uses.length)

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      totalLayersScanned: rows.length,
      distinctDepsScanned: byDep.size,
      inconsistentCount: inconsistent.length,
      inconsistent,
    },
    null,
    2,
  ) + '\n',
)

console.log(`\n=== dep-cascade-detector ===`)
console.log(`layers scanned:      ${rows.length}`)
console.log(`distinct deps:       ${byDep.size}`)
console.log(`inconsistent deps:   ${inconsistent.length}`)
for (const dep of inconsistent.slice(0, 15)) {
  const counts = dep.versionCounts.map((v) => `${v.version}×${v.count}`).join(', ')
  console.log(`  ${dep.name.padEnd(32)} ${counts}`)
}
if (inconsistent.length > 15) console.log(`  ... ${inconsistent.length - 15} more`)
console.log(`\noutput → ${OUT}`)
