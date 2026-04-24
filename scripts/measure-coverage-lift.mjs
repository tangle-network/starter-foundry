#!/usr/bin/env node
// Gen-6 Track B: coverage-lift measurement.
//
// Replays every buildout trace through the current router and reports
// which families the router selects. Used before/after a promote to
// measure: did adding family X actually absorb demand?
//
// Two modes:
//   1. --baseline            — write router decisions to .evolve/coverage-baseline.json
//   2. --compare <baseline>  — compare current router decisions to a prior baseline;
//                               emit coverage-measured events into generation-impact.jsonl
//
// Baseline + compare work the same way the scorecard staleness gates do:
// capture a snapshot, diff against current. That's the primitive for any
// "did my change move the metric?" question.
//
// Usage:
//   pnpm build
//   node scripts/measure-coverage-lift.mjs --baseline
//   # ... promote a family ...
//   node scripts/measure-coverage-lift.mjs --compare .evolve/coverage-baseline.json
//
// Scope: planPrompt() is used as the router surrogate. That's the same
// entrypoint the CLI uses for single-starter planning. Workspace prompts
// use collectServiceProjects; we run single-starter mode only because
// that's where family resolution happens discretely.

import { appendFileSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { planPrompt } from '../dist/lib/prompt-planner.js'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TRACES = join(REPO, '.evolve/traces/buildouts.jsonl')
const BASELINE_PATH = join(REPO, '.evolve/coverage-baseline.json')
const IMPACT_LOG = join(REPO, '.evolve/generation-impact.jsonl')

const argv = process.argv.slice(2)
const arg = (flag, fallback) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : fallback
}
const BASELINE = argv.includes('--baseline')
const COMPARE_TO = arg('--compare', null)
const OUT_PATH = arg('--out', BASELINE_PATH)
const NEW_FAMILY = arg('--new-family', null)  // tag the emitted event with the promote under test

if (!BASELINE && !COMPARE_TO) {
  console.error('usage: --baseline [--out path] | --compare <baseline.json> [--new-family <id>]')
  process.exit(2)
}

// ── Load unique scenario → initialPrompt, partnerGuess ──────────────
if (!existsSync(TRACES)) {
  console.error(`no buildouts trace at ${TRACES}`)
  process.exit(0)
}
const scenarios = new Map()
for (const line of readFileSync(TRACES, 'utf8').split('\n').filter(Boolean)) {
  try {
    const r = JSON.parse(line)
    if (!r.scenarioId) continue
    if (scenarios.has(r.scenarioId)) continue
    scenarios.set(r.scenarioId, {
      scenarioId: r.scenarioId,
      partner: r.partnerGuess ?? null,
      prompt: String(r.initialPrompt ?? '').slice(0, 2000),
    })
  } catch { /* skip */ }
}

console.log(`Replaying ${scenarios.size} unique buildout scenarios through router…`)

// ── Route each scenario → capture selected family ────────────────────
const results = []
for (const s of scenarios.values()) {
  try {
    const plan = await planPrompt({
      prompt: s.prompt,
      partner: s.partner,
    })
    const family = plan?.kind === 'single'
      ? plan.spec?.family ?? null
      : plan?.kind === 'workspace'
        ? (plan.spec?.projects ?? []).map((p) => p.spec?.family).filter(Boolean).join('+') || null
        : null
    results.push({
      scenarioId: s.scenarioId,
      partner: s.partner,
      family,
      confidence: plan?.confidence ?? null,
      kind: plan?.kind ?? null,
    })
  } catch (err) {
    results.push({
      scenarioId: s.scenarioId,
      partner: s.partner,
      family: null,
      error: err?.message ?? String(err),
    })
  }
}

const coverage = {
  timestamp: new Date().toISOString(),
  scenarioCount: results.length,
  routedCount: results.filter((r) => r.family).length,
  unroutedCount: results.filter((r) => !r.family).length,
  familyDistribution: (() => {
    const dist = {}
    for (const r of results) {
      if (!r.family) continue
      dist[r.family] = (dist[r.family] ?? 0) + 1
    }
    return dist
  })(),
  results,
}

// ── Mode 1: baseline ─────────────────────────────────────────────────
if (BASELINE) {
  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(coverage, null, 2) + '\n')
  console.log(`✓ wrote baseline → ${OUT_PATH}`)
  console.log(`  scenarios: ${coverage.scenarioCount}`)
  console.log(`  routed:    ${coverage.routedCount} (${((coverage.routedCount / coverage.scenarioCount) * 100).toFixed(1)}%)`)
  console.log(`  unrouted:  ${coverage.unroutedCount}`)
  console.log(`  unique families hit: ${Object.keys(coverage.familyDistribution).length}`)
  process.exit(0)
}

// ── Mode 2: compare ──────────────────────────────────────────────────
if (!existsSync(COMPARE_TO)) {
  console.error(`baseline not found: ${COMPARE_TO}`)
  process.exit(2)
}
const baseline = JSON.parse(readFileSync(COMPARE_TO, 'utf8'))
const baselineByScenario = new Map((baseline.results ?? []).map((r) => [r.scenarioId, r]))
const currentByScenario = new Map(results.map((r) => [r.scenarioId, r]))

const flipped = [] // scenario whose selected family changed
const gainedRoute = [] // was null/unrouted, now routed
const lostRoute = [] // was routed, now unrouted
for (const [sid, now] of currentByScenario) {
  const was = baselineByScenario.get(sid)
  if (!was) continue
  if (was.family === now.family) continue
  if (was.family === null && now.family !== null) gainedRoute.push({ sid, to: now.family })
  else if (was.family !== null && now.family === null) lostRoute.push({ sid, from: was.family })
  else flipped.push({ sid, from: was.family, to: now.family })
}

const diff = {
  timestamp: new Date().toISOString(),
  baselineAt: baseline.timestamp,
  scenariosCompared: results.length,
  gainedRoute: gainedRoute.length,
  lostRoute: lostRoute.length,
  flipped: flipped.length,
  newFamily: NEW_FAMILY,
  // What fraction of previously-unrouted scenarios is this promote absorbing?
  liftRatio: baseline.unroutedCount > 0 ? gainedRoute.length / baseline.unroutedCount : 0,
  details: { gainedRoute, lostRoute, flipped },
}

// Emit one event into generation-impact.jsonl so the scorecard picks it up.
const event = {
  ts: diff.timestamp,
  event: 'coverage-measured',
  newFamily: NEW_FAMILY,
  scenariosCompared: diff.scenariosCompared,
  gainedRoute: diff.gainedRoute,
  lostRoute: diff.lostRoute,
  flipped: diff.flipped,
  liftRatio: diff.liftRatio,
}
appendFileSync(IMPACT_LOG, JSON.stringify(event) + '\n')

console.log(`✓ coverage comparison complete`)
console.log(`  baseline at:   ${baseline.timestamp}`)
console.log(`  gained route:  ${gainedRoute.length} scenarios (${(diff.liftRatio * 100).toFixed(1)}% of prior unrouted)`)
console.log(`  lost route:    ${lostRoute.length}`)
console.log(`  flipped:       ${flipped.length}`)
if (NEW_FAMILY) console.log(`  attributed to: ${NEW_FAMILY}`)
if (gainedRoute.length > 0) {
  console.log('\n  Newly-routed scenarios:')
  for (const g of gainedRoute.slice(0, 10)) console.log(`    ${g.sid} → ${g.to}`)
  if (gainedRoute.length > 10) console.log(`    ... and ${gainedRoute.length - 10} more`)
}
if (lostRoute.length > 0) {
  console.log('\n  ⚠ Lost-route scenarios (regression):')
  for (const l of lostRoute.slice(0, 10)) console.log(`    ${l.sid}  (was: ${l.from})`)
}
