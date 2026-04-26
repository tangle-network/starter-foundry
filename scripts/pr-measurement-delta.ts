#!/usr/bin/env node
// PR-gate support. On PRs that touch registry/, CI computes the
// measurement delta: before (main) vs after (PR head) on the same
// buildout corpus. Emits a markdown report suitable for a PR comment.
//
// Usage (in CI):
//   git fetch origin main
//   node scripts/pr-measurement-delta.ts --base origin/main --out pr-delta.md
//
// Measurements captured (from the committed evidence files):
//   - buildout pass rate
//   - scaffold-gap install count
//   - top file rewrite count
//   - scorecard aggregate
//
// If any delta is a regression beyond tolerance, exit nonzero.

import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const base = arg('--base', 'origin/main')
const out = arg('--out', '.evolve/pr-delta.md')

function readAtRef(ref, path) {
  const r = spawnSync('git', ['show', `${ref}:${path}`], { cwd: REPO, encoding: 'utf8' })
  if (r.status !== 0) return null
  try { return JSON.parse(r.stdout) } catch { return null }
}

function readAtHead(path) {
  const abs = resolve(REPO, path)
  if (!existsSync(abs)) return null
  try { return JSON.parse(readFileSync(abs, 'utf8')) } catch { return null }
}

const files = [
  '.evolve/buildout-analysis.json',
  '.evolve/capability-gaps.json',
  '.evolve/scorecard.json',
]
const baseState = Object.fromEntries(files.map((f) => [f, readAtRef(base, f)]))
const headState = Object.fromEntries(files.map((f) => [f, readAtHead(f)]))

function getPath(obj, keys) {
  let cur = obj
  for (const k of keys) {
    if (cur == null) return null
    cur = cur[k]
  }
  return cur
}

const metrics = [
  { label: 'buildout_pass_rate', file: '.evolve/buildout-analysis.json', path: ['summary', 'passRate'], direction: 'higher-better', fmt: (v) => v == null ? 'n/a' : v.toFixed(3) },
  { label: 'scaffold_gap_installs', file: '.evolve/capability-gaps.json', path: ['breakdown', 'scaffoldGap'], direction: 'lower-better', fmt: (v) => v == null ? 'n/a' : String(v) },
  { label: 'orchestration_installs', file: '.evolve/capability-gaps.json', path: ['breakdown', 'orchestration'], direction: 'lower-better', fmt: (v) => v == null ? 'n/a' : String(v) },
  { label: 'top_file_rewrite_count', file: '.evolve/buildout-analysis.json', path: ['topRewrittenFiles', '0', 'timesRewritten'], direction: 'lower-better', fmt: (v) => v == null ? 'n/a' : String(v) },
  { label: 'scorecard_aggregate', file: '.evolve/scorecard.json', path: ['aggregate'], direction: 'higher-better', fmt: (v) => v == null ? 'n/a' : v.toFixed(3) },
]

function resolvePath(obj, parts) {
  let cur = obj
  for (const p of parts) {
    if (cur == null) return null
    if (Array.isArray(cur)) cur = cur[Number(p)] ?? null
    else cur = cur[p] ?? null
  }
  return cur
}

const lines = []
lines.push(`## Measurement delta vs \`${base}\``)
lines.push('')
lines.push('| Metric | Base | Head | Direction | Δ |')
lines.push('|---|---|---|---|---|')

let regressed = 0
for (const m of metrics) {
  const baseVal = resolvePath(baseState[m.file], m.path)
  const headVal = resolvePath(headState[m.file], m.path)
  const delta = (baseVal == null || headVal == null) ? null : (Number(headVal) - Number(baseVal))
  const marker = delta == null ? '?' :
    m.direction === 'higher-better'
      ? (delta > 0 ? '✅ ↑' : delta < 0 ? '🔻 ↓' : '—')
      : (delta < 0 ? '✅ ↓' : delta > 0 ? '🔻 ↑' : '—')
  if ((m.direction === 'higher-better' && delta != null && delta < -0.02) ||
      (m.direction === 'lower-better' && delta != null && delta > 1)) {
    regressed++
  }
  lines.push(`| \`${m.label}\` | ${m.fmt(baseVal)} | ${m.fmt(headVal)} | ${m.direction} | ${marker} ${delta == null ? '' : Number(delta).toFixed(3)} |`)
}

lines.push('')
if (regressed > 0) {
  lines.push(`**${regressed} regression(s) beyond tolerance.** Gate FAIL.`)
} else {
  lines.push('No regressions beyond tolerance. Gate PASS.')
}

writeFileSync(resolve(REPO, out), lines.join('\n') + '\n')
console.log(lines.join('\n'))
if (regressed > 0) process.exit(1)
