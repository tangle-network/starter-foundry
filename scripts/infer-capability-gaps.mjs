#!/usr/bin/env node
// Capability-gap reporter: reads buildouts.jsonl, infers what capabilities
// the agent actually needed (from packages/dirs it added), compares against
// what planPrompt would have attached based on the same prompt. Output:
// a ranked gap list — "for prompts like X, agents added Y but we didn't
// detect it."
//
// This is the raw material for training a capability inferrer later. First
// we need to know the gap is real and measurable.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DEFAULT_PATHS } from '../dist/lib/buildout-traces.js'
import { loadCapabilityMap, inferCapabilities } from '../dist/lib/capability-inferrer.js'
import { planPrompt } from '../dist/lib/prompt-planner.js'

const OUT = '.evolve/capability-gaps.json'
const MAX_PROMPT_LEN = 2000

if (!existsSync(DEFAULT_PATHS.buildoutsJsonl)) {
  console.error(`no buildouts file at ${DEFAULT_PATHS.buildoutsJsonl} — run scripts/run-buildout-pipeline.mjs first`)
  process.exit(2)
}

const map = loadCapabilityMap()

const events = readFileSync(DEFAULT_PATHS.buildoutsJsonl, 'utf8')
  .trim()
  .split('\n')
  .filter((l) => l.length > 0)
  .map((l) => {
    try { return JSON.parse(l) } catch { return null }
  })
  .filter(Boolean)

// Gap per (scenarioId, capability) — how often was a capability needed but
// not routed? Aggregate across buildouts in that scenario.
const scenarioGaps = new Map()
let processed = 0

for (const e of events) {
  if (!e.initialPrompt) continue
  const prompt = e.initialPrompt.slice(0, MAX_PROMPT_LEN)

  const inferred = inferCapabilities(e, map)
  if (inferred.length === 0) continue

  let plan
  try {
    plan = await planPrompt({ prompt, partner: null })
  } catch (err) {
    continue
  }

  const attached = new Set()
  if (plan.kind === 'starter') {
    for (const l of plan.spec.layers ?? []) attached.add(l)
  } else if (plan.kind === 'workspace') {
    for (const proj of plan.spec.projects ?? []) {
      for (const l of proj.spec.layers ?? []) attached.add(l)
    }
  }

  for (const c of inferred) {
    if (attached.has(c.capability)) continue // router already got it — no gap
    const key = `${e.scenarioId ?? 'unknown'}::${c.capability}`
    let g = scenarioGaps.get(key)
    if (!g) {
      g = {
        scenarioId: e.scenarioId,
        capability: c.capability,
        missedIn: 0,
        totalBuildouts: 0,
        totalPassing: 0,
        sampleAgentPackages: new Set(),
        samplePrompts: [],
      }
      scenarioGaps.set(key, g)
    }
    g.missedIn++
    g.totalBuildouts++
    if (e.outcome?.allPass) g.totalPassing++
    g.sampleAgentPackages.add(c.sourceToken)
    if (g.samplePrompts.length < 2) g.samplePrompts.push(prompt.slice(0, 240))
  }
  processed++
}

// Sort by most-missed, filter low-signal (missed once with nothing to back it up)
const gaps = [...scenarioGaps.values()]
  .map((g) => ({
    scenarioId: g.scenarioId,
    capability: g.capability,
    missedIn: g.missedIn,
    totalBuildouts: g.totalBuildouts,
    totalPassing: g.totalPassing,
    missRate: g.totalBuildouts > 0 ? g.missedIn / g.totalBuildouts : 0,
    sampleAgentPackages: [...g.sampleAgentPackages],
    samplePrompts: g.samplePrompts,
  }))
  .filter((g) => g.missedIn >= 2)
  .sort((a, b) => b.missedIn - a.missedIn)

// Cross-scenario capability rollup — which capabilities do we most often miss?
const capRollup = new Map()
for (const g of scenarioGaps.values()) {
  let r = capRollup.get(g.capability)
  if (!r) {
    r = { capability: g.capability, totalMissed: 0, scenarios: new Set() }
    capRollup.set(g.capability, r)
  }
  r.totalMissed += g.missedIn
  r.scenarios.add(g.scenarioId)
}
const topMissed = [...capRollup.values()]
  .map((r) => ({
    capability: r.capability,
    totalMissed: r.totalMissed,
    distinctScenarios: r.scenarios.size,
    scenarios: [...r.scenarios].filter(Boolean).sort(),
  }))
  .sort((a, b) => b.totalMissed - a.totalMissed)
  .slice(0, 15)

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  processedEvents: processed,
  distinctGaps: gaps.length,
  totalMissedInferences: gaps.reduce((a, g) => a + g.missedIn, 0),
  topMissedCapabilities: topMissed,
  perScenarioGap: gaps,
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(report, null, 2))

console.log(`=== capability gap report ===`)
console.log(`events processed:      ${processed}`)
console.log(`distinct gaps:         ${gaps.length}`)
console.log(`total missed:          ${report.totalMissedInferences}`)
console.log('')
console.log(`top 10 most-missed capabilities:`)
for (const t of topMissed.slice(0, 10)) {
  console.log(`  ${t.capability.padEnd(40)} ${t.totalMissed}× across ${t.distinctScenarios} scenarios`)
}
console.log('')
console.log(`top 10 scenario-level gaps:`)
for (const g of gaps.slice(0, 10)) {
  console.log(`  ${(g.scenarioId ?? '?').padEnd(28)} ${g.capability.padEnd(32)} ${g.missedIn}×  pkgs: ${g.sampleAgentPackages.slice(0,3).join(',')}`)
}
console.log('')
console.log(`wrote: ${OUT}`)
