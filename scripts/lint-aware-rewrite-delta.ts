#!/usr/bin/env node
// Lint-aware rewrite delta — classifies rewritten scaffold files as
// "agent fixed real bugs" vs "agent stylistically rewrote clean code"
// by running a quick lint pass on the BEFORE state of each rewritten
// file. If the file was lint-clean before the agent touched it, the
// rewrite is pure stylistic drift (the template was fine; the agent
// preferred their own shape). If the file failed lint before, the
// rewrite was corrective.
//
// Output: .evolve/reports/rewrite-delta.json with per-file classification,
// consumed by the template-quality judge to weight rewrites differently.
//
// Usage:
//   node scripts/lint-aware-rewrite-delta.ts
//
// Falls back to "unclassified" when ESLint isn't available; doesn't fail
// the pipeline.

import { spawnSync } from 'node:child_process'
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync as wfs,
} from 'node:fs'
import { dirname, join, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ANALYSIS = join(REPO, '.evolve/buildout-analysis.json')
const OUT = join(REPO, '.evolve/reports/rewrite-delta.json')

if (!existsSync(ANALYSIS)) {
  console.error('no buildout-analysis.json — run scripts/run-buildout-pipeline.ts first')
  process.exit(0)
}

const data = JSON.parse(readFileSync(ANALYSIS, 'utf8'))
const rewritten = data.topRewrittenFiles ?? []

function hasESLint() {
  try {
    const res = spawnSync('npx', ['--no-install', 'eslint', '--version'], {
      encoding: 'utf8',
      timeout: 5000,
    })
    return res.status === 0
  } catch {
    return false
  }
}

function lintCheck(filePath) {
  if (!existsSync(filePath)) return { classified: 'unknown', reason: 'file-not-found' }
  const ext = extname(filePath)
  if (!['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext)) {
    return { classified: 'unknown', reason: 'unsupported-ext' }
  }
  if (!hasESLint()) {
    return { classified: 'unknown', reason: 'eslint-unavailable' }
  }
  const res = spawnSync(
    'npx',
    [
      '--no-install',
      'eslint',
      '--no-eslintrc',
      '--rule',
      '{"no-unused-vars":"error","no-undef":"error"}',
      filePath,
    ],
    {
      cwd: REPO,
      encoding: 'utf8',
      timeout: 10000,
    },
  )
  return {
    classified: res.status === 0 ? 'pre-rewrite-clean' : 'pre-rewrite-had-issues',
    reason: res.status === 0 ? 'clean' : 'lint-errors',
    sample: (res.stdout ?? '').slice(0, 300),
  }
}

// Build a (target → sourcePath) index once by walking every manifest.json
// under registry/families and registry/layers/**. #36: the previous
// lookup joined `<layer>/files/<relPath>` which never matched because
// registry file sources are basenames — targets live inside manifest
// `files[]` entries.
const targetIndex = new Map()
function indexManifest(manifestPath, layerDir) {
  const m = readJson(manifestPath)
  if (!m || !Array.isArray(m.files)) return
  for (const entry of m.files) {
    if (typeof entry?.target !== 'string' || typeof entry?.source !== 'string') continue
    if (!targetIndex.has(entry.target)) {
      targetIndex.set(entry.target, join(layerDir, entry.source))
    }
  }
}
function walkRegistry(base, depth = 0) {
  if (!existsSync(base) || depth > 3) return
  for (const name of readdirSync(base)) {
    const sub = join(base, name)
    let st
    try {
      st = statSync(sub)
    } catch {
      continue
    }
    if (!st.isDirectory()) continue
    const manifest = join(sub, 'manifest.json')
    if (existsSync(manifest)) indexManifest(manifest, sub)
    walkRegistry(sub, depth + 1)
  }
}
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}
walkRegistry(join(REPO, 'registry/families'))
walkRegistry(join(REPO, 'registry/layers'))

function findSourceForTarget(target) {
  return targetIndex.get(target) ?? null
}

const classifications = []
for (const entry of rewritten.slice(0, 30)) {
  const relPath = entry.file
  // Resolve the registry SOURCE file for a rewritten TARGET path. The
  // registry stores files at `<layer>/files/<basename>` and declares
  // target paths inside each manifest's `files[]` array — so joining
  // `<layer>/files/<target>` never matches. Walk every manifest under
  // registry/{families,layers/*}/** and look for a `files[]` entry whose
  // `target` equals the rewritten path.
  const sourcePath = findSourceForTarget(relPath)
  if (!sourcePath) {
    classifications.push({
      file: relPath,
      classified: 'unknown',
      reason: 'source-not-in-registry',
      timesRewritten: entry.timesRewritten,
    })
    continue
  }
  const lint = lintCheck(sourcePath)
  classifications.push({
    file: relPath,
    sourcePath: sourcePath.replace(REPO + '/', ''),
    timesRewritten: entry.timesRewritten,
    ...lint,
  })
}

const counts = { 'pre-rewrite-clean': 0, 'pre-rewrite-had-issues': 0, unknown: 0 }
for (const c of classifications) counts[c.classified] = (counts[c.classified] ?? 0) + 1

const report = {
  generatedAt: new Date().toISOString(),
  counts,
  interpretation: {
    'pre-rewrite-clean':
      'Template was fine before agent touched it — rewrite is stylistic drift. Signal: template is probably already good; rewrite count here should be discounted in judge scoring.',
    'pre-rewrite-had-issues':
      'Template had lint issues — agent rewrite was corrective. Signal: template IS the problem; prioritize fixing.',
    unknown:
      'Could not classify (source not in registry, eslint unavailable, unsupported extension).',
  },
  files: classifications,
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(report, null, 2))

console.log('Lint-aware rewrite delta:')
for (const [cls, count] of Object.entries(counts)) {
  console.log(`  ${cls.padEnd(28)}: ${count}`)
}
console.log(`\nwrote: ${OUT}`)
