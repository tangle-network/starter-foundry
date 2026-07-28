#!/usr/bin/env node
// Analyze stage: reads the joined buildouts.jsonl and emits
// .evolve/buildout-analysis.json — the committed roll-up evidence.
//
// Roll-ups:
//   - per-scenario: pass rate + mean score + mean turns + mean wall ms
//   - per-scenario + per-replay-round: success-over-time signal
//   - top-added packages: "agent had to install X" — signal for capability gaps
//   - top-created dirs: scaffold structural gaps
//   - top-rewritten files: templates agents always rewrite → template-quality signal
//   - package-added-on-fail vs package-added-on-pass: which adds correlate with success
//
// This is pure data — no LLM. It's the measurement surface. LLM training
// consumes this in a later stage.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DEFAULT_PATHS } from '../dist/lib/buildout-traces.js'

if (!existsSync(DEFAULT_PATHS.buildoutsJsonl)) {
  console.error(`no buildouts file at ${DEFAULT_PATHS.buildoutsJsonl}`)
  process.exit(2)
}

const events = readFileSync(DEFAULT_PATHS.buildoutsJsonl, 'utf8')
  .trim()
  .split('\n')
  .filter((l) => l.length > 0)
  .map((l) => {
    try {
      return JSON.parse(l)
    } catch {
      return null
    }
  })
  .filter(Boolean)

const withOutcome = events.filter((e) => e.outcome)
const passes = withOutcome.filter((e) => e.outcome?.allPass)
const fails = withOutcome.filter((e) => e.outcome && !e.outcome.allPass)

// Per-scenario roll-up
const byScenario = {}
for (const e of events) {
  const key = `${e.partnerGuess ?? 'unknown'}::${e.scenarioId ?? 'unknown'}`
  if (!byScenario[key]) {
    byScenario[key] = {
      partner: e.partnerGuess,
      scenarioId: e.scenarioId,
      total: 0,
      withOutcome: 0,
      pass: 0,
      meanScore: 0,
      meanWallMs: 0,
      meanTurns: 0,
      meanCostUsd: 0,
      meanTokenCount: 0,
      costSampleCount: 0,
      replayRounds: new Set(),
    }
  }
  const s = byScenario[key]
  s.total++
  if (e.outcome) {
    s.withOutcome++
    if (e.outcome.allPass) s.pass++
    s.meanScore += e.outcome.blendedScore
    s.meanWallMs += e.outcome.wallMs
    s.meanTurns += e.outcome.toolCallsTotal
    if (typeof e.outcome.costUsd === 'number') {
      s.meanCostUsd += e.outcome.costUsd
      s.costSampleCount++
    }
    if (typeof e.outcome.tokenCount === 'number') {
      s.meanTokenCount += e.outcome.tokenCount
    }
  }
  if (e.replayRound != null) s.replayRounds.add(e.replayRound)
}
for (const s of Object.values(byScenario)) {
  if (s.withOutcome > 0) {
    s.meanScore /= s.withOutcome
    s.meanWallMs /= s.withOutcome
    s.meanTurns /= s.withOutcome
  }
  // Cost averages only over runs that reported cost (may be < withOutcome).
  if (s.costSampleCount > 0) {
    s.meanCostUsd /= s.costSampleCount
    s.meanTokenCount /= s.costSampleCount
  } else {
    s.meanCostUsd = null
    s.meanTokenCount = null
  }
  s.passRate = s.withOutcome > 0 ? s.pass / s.withOutcome : null
  s.replayRounds = [...s.replayRounds].sort((a, b) => a - b)
}

// Top packages agents added
const pkgCounts = new Map()
const pkgFailCounts = new Map()
const pkgPassCounts = new Map()
for (const e of events) {
  for (const p of e.addedPackages ?? []) {
    const key = `${p.pm}:${p.name}`
    pkgCounts.set(key, (pkgCounts.get(key) ?? 0) + 1)
    if (e.outcome?.allPass) pkgPassCounts.set(key, (pkgPassCounts.get(key) ?? 0) + 1)
    else if (e.outcome) pkgFailCounts.set(key, (pkgFailCounts.get(key) ?? 0) + 1)
  }
}
const topPackages = [...pkgCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .map(([key, n]) => ({
    key,
    timesAdded: n,
    addedOnPass: pkgPassCounts.get(key) ?? 0,
    addedOnFail: pkgFailCounts.get(key) ?? 0,
  }))

// Top dirs
const dirCounts = new Map()
for (const e of events) {
  for (const d of e.addedDirs ?? []) dirCounts.set(d, (dirCounts.get(d) ?? 0) + 1)
}
const topDirs = [...dirCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .map(([dir, n]) => ({ dir, timesAdded: n }))

// Top rewritten scaffold files — strip the scenario-nonce prefix so paths
// cluster. Agent sessions happen in /private/var/folders/.../<scenario>-<nonce>/,
// so we drop everything up through <scenario>-<nonce>/ and keep the relative
// path inside the scaffold.
function normalizePath(p) {
  if (typeof p !== 'string') return p
  const m = p.match(/\/[^/]+-[A-Za-z0-9]{4,8}\/(.+)$/)
  return m ? m[1] : p
}
const fileCounts = new Map()
const fileFailCounts = new Map()
const filePassCounts = new Map()
for (const e of events) {
  const normd = new Set()
  for (const f of e.rewrittenFiles ?? []) normd.add(normalizePath(f))
  for (const f of normd) {
    fileCounts.set(f, (fileCounts.get(f) ?? 0) + 1)
    if (e.outcome?.allPass) filePassCounts.set(f, (filePassCounts.get(f) ?? 0) + 1)
    else if (e.outcome) fileFailCounts.set(f, (fileFailCounts.get(f) ?? 0) + 1)
  }
}
const topRewrittenFiles = [...fileCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 25)
  .map(([file, n]) => ({
    file,
    timesRewritten: n,
    rewrittenOnPass: filePassCounts.get(file) ?? 0,
    rewrittenOnFail: fileFailCounts.get(file) ?? 0,
  }))

// Summary block
// Cost aggregates — only over events where the upstream caller (blueprint-agent
// / VB) emitted costUsd on the outcome. When absent, meanCostUsd is null.
const costEvents = withOutcome.filter((e) => typeof e.outcome.costUsd === 'number')
const tokenEvents = withOutcome.filter((e) => typeof e.outcome.tokenCount === 'number')
const totalCostUsd = costEvents.reduce((a, e) => a + e.outcome.costUsd, 0)
const totalTokens = tokenEvents.reduce((a, e) => a + e.outcome.tokenCount, 0)

const summary = {
  generatedAt: new Date().toISOString(),
  totalBuildouts: events.length,
  withOutcome: withOutcome.length,
  passRate: withOutcome.length > 0 ? passes.length / withOutcome.length : null,
  meanBlendedScore:
    withOutcome.length > 0
      ? withOutcome.reduce((a, e) => a + e.outcome.blendedScore, 0) / withOutcome.length
      : null,
  totalPassing: passes.length,
  totalFailing: fails.length,
  distinctScenarios: Object.keys(byScenario).length,
  distinctPartners: [...new Set(events.map((e) => e.partnerGuess).filter(Boolean))].sort(),
  // Cost rollup. Tracks $/scaffold across the corpus — the metric that
  // catches regressions where we accidentally made every buildout 2× more
  // expensive in tokens even if pass rate stayed flat.
  costRollup: {
    sampleCount: costEvents.length,
    totalCostUsd: costEvents.length > 0 ? totalCostUsd : null,
    meanCostUsd: costEvents.length > 0 ? totalCostUsd / costEvents.length : null,
    totalTokens: tokenEvents.length > 0 ? totalTokens : null,
    meanTokens: tokenEvents.length > 0 ? totalTokens / tokenEvents.length : null,
    meanCostOnPass:
      costEvents.filter((e) => e.outcome.allPass).length > 0
        ? costEvents.filter((e) => e.outcome.allPass).reduce((a, e) => a + e.outcome.costUsd, 0) /
          costEvents.filter((e) => e.outcome.allPass).length
        : null,
    meanCostOnFail:
      costEvents.filter((e) => !e.outcome.allPass).length > 0
        ? costEvents.filter((e) => !e.outcome.allPass).reduce((a, e) => a + e.outcome.costUsd, 0) /
          costEvents.filter((e) => !e.outcome.allPass).length
        : null,
  },
}

const report = {
  schemaVersion: 1,
  summary,
  perScenario: Object.values(byScenario).sort((a, b) => (b.passRate ?? -1) - (a.passRate ?? -1)),
  topAddedPackages: topPackages,
  topAddedDirs: topDirs,
  topRewrittenFiles,
}

mkdirSync(dirname(DEFAULT_PATHS.analysisJson), { recursive: true })
writeFileSync(DEFAULT_PATHS.analysisJson, JSON.stringify(report, null, 2))

console.log('=== buildout corpus summary ===')
console.log(`total buildouts:      ${summary.totalBuildouts}`)
console.log(`with VB outcome:      ${summary.withOutcome}`)
console.log(
  `pass rate:            ${summary.passRate === null ? 'n/a' : (summary.passRate * 100).toFixed(1) + '%'}`,
)
console.log(
  `mean blended score:   ${summary.meanBlendedScore === null ? 'n/a' : summary.meanBlendedScore.toFixed(3)}`,
)
console.log(`distinct scenarios:   ${summary.distinctScenarios}`)
console.log(`partners:             ${summary.distinctPartners.join(', ')}`)
console.log('')
console.log('top packages agents added (signal for missing capabilities):')
for (const p of topPackages.slice(0, 10)) {
  console.log(`  ${p.key.padEnd(40)} ${p.timesAdded}×  pass:${p.addedOnPass} fail:${p.addedOnFail}`)
}
console.log('')
console.log('top rewritten scaffold files (templates agents always fix):')
for (const f of topRewrittenFiles.slice(0, 10)) {
  console.log(`  ${f.file.slice(0, 60).padEnd(62)} ${f.timesRewritten}×`)
}
console.log('')
console.log(`wrote: ${DEFAULT_PATHS.analysisJson}`)
