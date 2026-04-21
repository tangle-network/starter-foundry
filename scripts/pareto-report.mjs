#!/usr/bin/env node
// Builds a quality-vs-speed Pareto chart from buildout-analysis.json.
// Every scenario is plotted as (meanWallMs, blendedScore); the script
// identifies the Pareto frontier (no other point is both faster AND
// higher-scoring) and emits a chart-ready JSON to .evolve/reports/pareto.json
// plus an ASCII-rendered summary to stdout.
//
// Usage:
//   node scripts/pareto-report.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ANALYSIS = join(REPO, '.evolve/buildout-analysis.json')
const OUT = join(REPO, '.evolve/reports/pareto.json')

if (!existsSync(ANALYSIS)) {
  console.error('no buildout-analysis.json — run scripts/run-buildout-pipeline.mjs first')
  process.exit(1)
}

const analysis = JSON.parse(readFileSync(ANALYSIS, 'utf8'))
const scenarios = (analysis.perScenario ?? [])
  .filter((s) => s.meanWallMs > 0 && s.meanScore > 0)
  .map((s) => ({
    id: `${s.partner}/${s.scenarioId}`,
    meanWallMs: s.meanWallMs,
    meanScore: s.meanScore,
    passRate: s.passRate,
    total: s.total,
  }))

if (scenarios.length === 0) {
  console.log('no scenarios with both wall-time and score — Pareto undefined')
  process.exit(0)
}

// Frontier: point is on frontier if no other point dominates it (lower
// wallMs AND higher score).
function dominates(a, b) {
  // Returns true if `a` dominates `b`: a is faster-or-equal AND higher-or-equal,
  // strict on at least one dimension.
  return (
    a.meanWallMs <= b.meanWallMs &&
    a.meanScore >= b.meanScore &&
    (a.meanWallMs < b.meanWallMs || a.meanScore > b.meanScore)
  )
}

const frontier = scenarios.filter(
  (p) => !scenarios.some((q) => q !== p && dominates(q, p)),
).sort((a, b) => a.meanWallMs - b.meanWallMs)

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      scenarioCount: scenarios.length,
      frontier,
      all: scenarios,
    },
    null,
    2,
  ),
)

// Render a small ASCII chart so the terminal output is useful.
const minWall = Math.min(...scenarios.map((s) => s.meanWallMs))
const maxWall = Math.max(...scenarios.map((s) => s.meanWallMs))
const W = 60, H = 16

console.log('\nQuality × Speed Pareto')
console.log(`(${scenarios.length} scenarios, ${frontier.length} on frontier)\n`)
console.log('1.0 │')
for (let y = H; y >= 0; y--) {
  const scoreFloor = y / H
  let line = `    │`
  for (let x = 0; x <= W; x++) {
    const wallFloor = minWall + ((maxWall - minWall) * x) / W
    const wallCeil = minWall + ((maxWall - minWall) * (x + 1)) / W
    const hits = scenarios.filter(
      (s) =>
        s.meanWallMs >= wallFloor &&
        s.meanWallMs < wallCeil &&
        s.meanScore >= scoreFloor &&
        s.meanScore < scoreFloor + 1 / H,
    )
    const onFrontier = hits.some((h) => frontier.includes(h))
    if (hits.length === 0) line += ' '
    else if (onFrontier) line += '*'
    else line += '·'
  }
  console.log(line)
}
console.log('0.0 └' + '─'.repeat(W))
console.log(`    ${(minWall / 1000).toFixed(0)}s`.padEnd(30) + `${(maxWall / 1000).toFixed(0)}s (wall time)`)

console.log('\nFrontier (sorted fast → slow):')
for (const p of frontier.slice(0, 10)) {
  console.log(
    `  ${p.id.padEnd(50)}  ${(p.meanWallMs / 1000).toFixed(1).padStart(6)}s  ${p.meanScore.toFixed(3)}  (pass ${p.passRate === null ? '?' : (p.passRate * 100).toFixed(0)}%)`,
  )
}
if (frontier.length > 10) console.log(`  ... ${frontier.length - 10} more`)
console.log(`\nwrote: ${OUT}`)
