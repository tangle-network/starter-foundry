#!/usr/bin/env node
// Diagnostic report over VB execution traces in .evolve/traces/vb-execution-*.jsonl.
// Reads the traces emitted by blueprint-agent and produces:
//   1. per-scenario pass rate + failing layer kinds
//   2. overall failing-layer histogram (what breaks most)
//   3. broken scenarios (0% pass) — actionable: fix those scaffolds
//   4. strong scenarios (100% pass, score ≥ 0.9) — seed positives for training
//
// Usage: node scripts/vb-diagnose.mjs [--tracesDir .evolve/traces] [--out path.json]

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  loadVBTraces,
  aggregateByScenario,
  failingLayerHistogram,
  brokenScenarios,
  strongScenarios,
} from '../dist/lib/vb-outcomes.js'

const argv = process.argv.slice(2)
function arg(k, fallback) {
  const i = argv.indexOf(k)
  return i >= 0 ? argv[i + 1] : fallback
}

const tracesDir = arg('--tracesDir', '.evolve/traces')
const outPath = arg('--out', null)

const traces = await loadVBTraces(tracesDir)
if (traces.length === 0) {
  console.error(`no VB traces found in ${tracesDir} (looking for vb-execution-*.jsonl)`)
  process.exit(2)
}

const outcomes = aggregateByScenario(traces)
const histogram = failingLayerHistogram(traces)
const broken = brokenScenarios(outcomes)
const strong = strongScenarios(outcomes)

const totalPass = traces.filter((t) => t.execution.allPass).length
const totalScore = traces.reduce((a, t) => a + t.execution.blendedScore, 0) / traces.length

console.log('='.repeat(70))
console.log(`VB execution traces — diagnostic report`)
console.log('='.repeat(70))
console.log(`total traces:        ${traces.length}`)
console.log(`distinct scenarios:  ${outcomes.length}`)
console.log(`overall pass rate:   ${totalPass}/${traces.length} = ${(totalPass / traces.length).toFixed(3)}`)
console.log(`mean blended score:  ${totalScore.toFixed(3)}`)
console.log('')

console.log('per-scenario:')
console.log('  scenario'.padEnd(27), '| pass   | score | failing-layers')
console.log('  ', '-'.repeat(70))
for (const o of outcomes) {
  const fl = Object.entries(o.failingLayersByKind)
    .map(([k, v]) => `${k}:${v}`)
    .join(',') || '—'
  console.log(
    '  ' + o.scenarioId.padEnd(25),
    '|',
    `${o.passed}/${o.runs}`.padEnd(6),
    '|',
    o.meanBlendedScore.toFixed(2),
    '|',
    fl,
  )
}
console.log('')

console.log('failing-layer histogram (what breaks most across all runs):')
const hist = Object.entries(histogram).sort((a, b) => b[1] - a[1])
for (const [k, v] of hist) console.log(`  ${k.padEnd(20)} ${v}`)
console.log('')

if (broken.length > 0) {
  console.log(`${broken.length} broken scenarios (0% pass — scaffold NEVER works):`)
  for (const o of broken) {
    const fl = Object.entries(o.failingLayersByKind)
      .map(([k, v]) => `${k}:${v}`)
      .join(',')
    console.log(`  ${o.scenarioId} (partner=${o.partner}) — failures: ${fl}`)
  }
  console.log('')
}

if (strong.length > 0) {
  console.log(`${strong.length} strong scenarios (100% pass, score ≥ 0.9):`)
  for (const o of strong) {
    console.log(`  ${o.scenarioId} — score ${o.meanBlendedScore.toFixed(3)}, ${o.runs} runs`)
  }
  console.log('')
}

if (outPath) {
  const report = {
    generatedAt: new Date().toISOString(),
    tracesDir,
    totalTraces: traces.length,
    distinctScenarios: outcomes.length,
    overallPassRate: totalPass / traces.length,
    meanBlendedScore: totalScore,
    perScenario: outcomes,
    failingLayerHistogram: histogram,
    brokenScenarios: broken,
    strongScenarios: strong,
  }
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`report written: ${outPath}`)
}
