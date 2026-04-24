#!/usr/bin/env node
// Baseline + regression-diff tool for tests/eval/.
//
//   node scripts/eval-baseline.mjs            # print latest vs baseline diff
//   node scripts/eval-baseline.mjs --write    # pin current latest as baseline
//   node scripts/eval-baseline.mjs --check --tolerance 0.02
//     exit 1 if aggregate regressed by more than tolerance
//
// Reads: .evolve/eval/latest.json, .evolve/eval/baseline.json
// Writes: .evolve/eval/baseline.json (with --write)

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LATEST = resolve(ROOT, '.evolve/eval/latest.json')
const BASELINE = resolve(ROOT, '.evolve/eval/baseline.json')
const argv = process.argv.slice(2)
const arg = (flag, fallback) => {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}
const WRITE = argv.includes('--write')
const CHECK = argv.includes('--check')
const TOLERANCE = Number(arg('--tolerance', '0.02'))

async function loadOrNull(path) {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (err) {
    console.error(`[eval-baseline] could not parse ${path}:`, err.message)
    return null
  }
}

async function main() {
  const latest = await loadOrNull(LATEST)
  if (!latest) {
    console.error(`no .evolve/eval/latest.json — run: node tests/eval/run-eval.mjs`)
    process.exit(2)
  }

  if (WRITE) {
    await writeFile(BASELINE, JSON.stringify(latest, null, 2))
    console.log(`baseline pinned at aggregate=${latest.aggregate.toFixed(3)} (${latest.passCount}/${latest.totalCount})`)
    return
  }

  const baseline = await loadOrNull(BASELINE)
  if (!baseline) {
    console.log(`no baseline yet — run: node scripts/eval-baseline.mjs --write`)
    console.log(`latest: aggregate=${latest.aggregate.toFixed(3)} (${latest.passCount}/${latest.totalCount})`)
    return
  }

  const delta = latest.aggregate - baseline.aggregate
  const sign = delta >= 0 ? '+' : ''
  console.log(`baseline: ${baseline.aggregate.toFixed(3)} (${baseline.passCount}/${baseline.totalCount}, ${baseline.timestamp})`)
  console.log(`latest:   ${latest.aggregate.toFixed(3)} (${latest.passCount}/${latest.totalCount}, ${latest.timestamp})`)
  console.log(`delta:    ${sign}${delta.toFixed(3)}  (tolerance ${TOLERANCE})`)

  const baselineById = Object.fromEntries(baseline.results.map((r) => [r.id, r]))
  const flips = []
  for (const r of latest.results) {
    const prev = baselineById[r.id]
    if (!prev) continue
    if (prev.passed && !r.passed) flips.push({ id: r.id, reason: r.reason, direction: 'regress' })
    if (!prev.passed && r.passed) flips.push({ id: r.id, reason: r.reason, direction: 'improve' })
  }
  if (flips.length) {
    console.log(`scenario flips (${flips.length}):`)
    for (const f of flips) console.log(`  ${f.direction === 'regress' ? '✗' : '✓'} ${f.id} — ${f.reason}`)
  }

  if (CHECK && delta < -TOLERANCE) {
    console.error(`REGRESSION — delta ${delta.toFixed(3)} below tolerance -${TOLERANCE}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[eval-baseline] fatal:', err)
  process.exit(2)
})
