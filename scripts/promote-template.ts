#!/usr/bin/env node
// promote-template.mjs — score every version in .evolve/template-library/<family>/,
// update _index.json (current + topN + all), and copy the current version's
// manifest + files into registry/layers/framework/<family>/ so the planner + compose
// pick it up. Deterministic given the same library contents.
//
// Usage:
//   node scripts/promote-template.ts --family threejs-game
//   node scripts/promote-template.ts --all                         # every family with a library dir
//   node scripts/promote-template.ts --all --dry-run               # score without copying
//   node scripts/promote-template.ts --family X --top 5            # keep top 5 pool (default 5)
//
// Output: per-family log + final _index.json shape.

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  cpSync,
  rmSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scoreVersion } from '../dist/lib/template-quality.js'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LIB = join(REPO, '.evolve/template-library')
const REGISTRY = join(REPO, 'registry/layers/framework')

const argv = process.argv.slice(2)
function arg(flag, fallback) {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : fallback
}
const FAMILY = arg('--family', null)
const ALL = argv.includes('--all')
const DRY = argv.includes('--dry-run')
const TOP_N = Math.max(1, Number.parseInt(arg('--top', '5'), 10))

if (!FAMILY && !ALL) {
  console.error('usage: --family <id> OR --all')
  process.exit(2)
}

function countFiles(dir) {
  if (!existsSync(dir)) return 0
  let count = 0
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const full = join(d, e)
      const s = statSync(full)
      if (s.isDirectory()) walk(full)
      else count++
    }
  }
  walk(dir)
  return count
}

function promoteFamily(family) {
  const famLibDir = join(LIB, family)
  if (!existsSync(famLibDir)) {
    return { family, skipped: 'no-library-dir' }
  }
  const versionDirs = readdirSync(famLibDir)
    .filter((e) => e.startsWith('v_'))
    .map((e) => ({
      name: e,
      full: join(famLibDir, e),
      mtime: statSync(join(famLibDir, e)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime) // recent first, stable tie-break

  if (versionDirs.length === 0) {
    return { family, skipped: 'no-versions' }
  }

  // Score each version.
  const scored = []
  for (const v of versionDirs) {
    const manifestPath = join(v.full, 'manifest.json')
    if (!existsSync(manifestPath)) {
      scored.push({ name: v.name, skipped: 'no-manifest' })
      continue
    }
    // Quality report is either sidecar (quality.json) OR computed fresh from audit + summary
    // living alongside the version.
    const qualityPath = join(v.full, 'quality.json')
    const auditPath = join(v.full, 'audit.json')
    const summaryPath = join(v.full, 'summary.json')
    let audit = null
    let summary = null
    try {
      if (existsSync(auditPath)) audit = JSON.parse(readFileSync(auditPath, 'utf8'))
    } catch {}
    try {
      if (existsSync(summaryPath)) summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
    } catch {}
    let quality = null
    if (existsSync(qualityPath)) {
      try {
        quality = JSON.parse(readFileSync(qualityPath, 'utf8'))
      } catch {}
    }
    if (!quality) {
      // Compute score on the fly. The audit may already be structured as the
      // multi-family rollup ({audits:[{...}]}) or the single-layer shape; handle both.
      const auditReport = Array.isArray(audit?.audits)
        ? (audit.audits.find((a) => a.layerId === `framework:${family}`) ?? {
            layerId: `framework:${family}`,
          })
        : (audit ?? { layerId: `framework:${family}` })
      const createdAt = existsSync(manifestPath)
        ? new Date(statSync(manifestPath).mtimeMs).toISOString()
        : new Date().toISOString()
      quality = scoreVersion({
        audit: auditReport,
        summary,
        fileCount: countFiles(join(v.full, 'files')),
        createdAt,
      })
      if (!DRY) writeFileSync(qualityPath, JSON.stringify(quality, null, 2))
    }
    scored.push({
      name: v.name,
      score: quality.score,
      components: quality.components,
      dimensions: quality.dimensions,
    })
  }

  const scorable = scored.filter((s) => typeof s.score === 'number')
  scorable.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)) // deterministic tie-break

  if (scorable.length === 0) {
    return { family, skipped: 'no-scorable-versions', versions: scored.length }
  }

  const current = scorable[0].name
  // Keep ties within 0.03 of top in topN pool (diversity bonus).
  const topScore = scorable[0].score
  const topN = scorable
    .filter((s, i) => i < TOP_N || s.score >= topScore - 0.03)
    .slice(0, Math.max(TOP_N, 1))
    .map((s) => s.name)

  const index = {
    family,
    current,
    topN,
    all: scored.map((s) => ({
      version: s.name,
      score: s.score ?? null,
      skipped: s.skipped ?? null,
    })),
    generationCount: versionDirs.length,
    lastPromotedAt: new Date().toISOString(),
  }

  if (!DRY) {
    writeFileSync(join(famLibDir, '_index.json'), JSON.stringify(index, null, 2))
    // Copy current version's manifest + files into registry/layers/framework/<family>/.
    const currentDir = join(famLibDir, current)
    const targetDir = join(REGISTRY, family)
    mkdirSync(targetDir, { recursive: true })
    const mfSrc = join(currentDir, 'manifest.json')
    const filesSrc = join(currentDir, 'files')
    if (existsSync(mfSrc)) cpSync(mfSrc, join(targetDir, 'manifest.json'))
    // Wipe + rewrite files/ so promotes are exact replacements, not merges.
    const filesTarget = join(targetDir, 'files')
    if (existsSync(filesTarget)) rmSync(filesTarget, { recursive: true, force: true })
    if (existsSync(filesSrc)) cpSync(filesSrc, filesTarget, { recursive: true })
  }

  return { family, current, topScore, topN, versions: scored.length, dryRun: DRY }
}

const targets = ALL
  ? existsSync(LIB)
    ? readdirSync(LIB).filter((e) => !e.startsWith('.') && !e.startsWith('_'))
    : []
  : [FAMILY]

const results = []
for (const fam of targets) {
  const r = promoteFamily(fam)
  results.push(r)
  if (r.skipped) {
    console.log(`  − ${fam}: skipped (${r.skipped})`)
  } else {
    console.log(
      `  ✓ ${fam}: current=${r.current} score=${r.topScore.toFixed(3)} topN=[${r.topN.join(', ')}] versions=${r.versions}`,
    )
  }
}

console.log(
  `\ndone — ${results.filter((r) => !r.skipped).length}/${targets.length} promoted${DRY ? ' (dry-run)' : ''}`,
)
