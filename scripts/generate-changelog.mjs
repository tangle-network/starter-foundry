#!/usr/bin/env node
// Generate CHANGELOG.md from git log + registry diff. Runs on tag push and
// can be invoked manually with a range: `node scripts/generate-changelog.mjs v0.5.0..v0.5.4`
//
// Output shape:
//
//   ## v0.5.4 (2026-04-21)
//   ### New families
//   - bun-http — Bun HTTP API starter ...
//   ### New capabilities
//   - zk-browser — ...
//   ### Commits
//   - feat(foo): bar (abc123)

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const RANGE = process.argv[2] ?? 'HEAD~20..HEAD'

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' })
  return (r.stdout ?? '').trim()
}

const commits = run('git', ['log', '--pretty=format:%H\t%s', RANGE]).split('\n').filter(Boolean)
const head = run('git', ['rev-parse', '--short', 'HEAD'])
const date = new Date().toISOString().slice(0, 10)
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

// Registry state at HEAD.
const families = readdirSync('registry/families').filter((e) => !e.startsWith('_') && !e.startsWith('.')).sort()
const capabilities = readdirSync('registry/layers/capability').filter((e) => !e.startsWith('_') && !e.startsWith('.')).sort()
const partners = readdirSync('registry/partners').filter((e) => !e.startsWith('_') && !e.startsWith('.')).sort()

// Registry state at the range's start (best-effort; skip if unavailable).
const rangeStart = RANGE.split('..')[0]
let baselineFamilies = new Set()
let baselineCapabilities = new Set()
let baselinePartners = new Set()
try {
  baselineFamilies = new Set(run('git', ['ls-tree', '-d', '--name-only', rangeStart, 'registry/families/']).split('\n').filter(Boolean).map((p) => p.split('/').pop()))
  baselineCapabilities = new Set(run('git', ['ls-tree', '-d', '--name-only', rangeStart, 'registry/layers/capability/']).split('\n').filter(Boolean).map((p) => p.split('/').pop()))
  baselinePartners = new Set(run('git', ['ls-tree', '-d', '--name-only', rangeStart, 'registry/partners/']).split('\n').filter(Boolean).map((p) => p.split('/').pop()))
} catch {
  // History may not go back that far; accept empty baseline.
}

const newFamilies = families.filter((f) => !baselineFamilies.has(f))
const newCapabilities = capabilities.filter((c) => !baselineCapabilities.has(c))
const newPartners = partners.filter((p) => !baselinePartners.has(p))

function descriptionOf(baseDir, id) {
  try {
    const m = JSON.parse(readFileSync(join(baseDir, id, 'manifest.json'), 'utf8'))
    return (m.description ?? '').slice(0, 140)
  } catch { return '' }
}

const lines = []
lines.push(`# CHANGELOG`)
lines.push('')
lines.push(`## v${pkg.version} (${date}, @ ${head})`)
lines.push('')
lines.push(`**Generated range:** \`${RANGE}\``)
lines.push('')

if (newFamilies.length > 0) {
  lines.push('### New families')
  for (const id of newFamilies) {
    lines.push(`- \`${id}\` — ${descriptionOf('registry/families', id)}`)
  }
  lines.push('')
}
if (newCapabilities.length > 0) {
  lines.push('### New capabilities')
  for (const id of newCapabilities) {
    lines.push(`- \`capability:${id}\` — ${descriptionOf('registry/layers/capability', id)}`)
  }
  lines.push('')
}
if (newPartners.length > 0) {
  lines.push('### New partners')
  for (const id of newPartners) {
    lines.push(`- \`${id}\` — ${descriptionOf('registry/partners', id)}`)
  }
  lines.push('')
}

lines.push(`### Commits (${commits.length})`)
for (const c of commits) {
  const [sha, msg] = c.split('\t')
  lines.push(`- ${msg} (${sha?.slice(0, 7)})`)
}
lines.push('')
lines.push(`### Registry state at HEAD`)
lines.push(`- families: ${families.length}`)
lines.push(`- capabilities: ${capabilities.length}`)
lines.push(`- partners: ${partners.length}`)
lines.push('')
lines.push('### Consumer action items')
lines.push('- Ensure your bench container has the toolchains any new families require (e.g. `bun`, `deno`, `wasm-pack`, `vllm`).')
lines.push('- Re-emit your buildout traces via `emitBuildoutEvent` — new family IDs will be classified by the detector.')
lines.push('')

writeFileSync('CHANGELOG.md', lines.join('\n'))
console.log(`✓ wrote CHANGELOG.md (${commits.length} commits, +${newFamilies.length} families, +${newCapabilities.length} capabilities, +${newPartners.length} partners)`)
