#!/usr/bin/env node
// Capability-gap reporter.
//
// A "gap" is: agent installed package X in their buildout, and the composed
// scaffold (family package.json + layer files) does NOT ship X. That means
// the agent burned tokens re-declaring something the scaffold should have
// provided. Examples:
//
//   - snarkjs installed 4×, all on fail → scaffold has no ZK capability
//     layer, agents improvising. Real gap; fix by shipping a zk family or
//     layer.
//   - lucide-react installed 17× when react-vite-ts already ships it →
//     orchestration concern (install didn't run before agent saw scaffold),
//     not a scaffold gap. Classified separately so consumers can tell which
//     side of the pipeline to repair.
//
// Historical detector compared (agent-inferred capability) against (capability
// the plan attached). That filter hid the most useful signals because tailwind
// + shadcn are auto-attached to every React family but agents still install
// lucide-react/tailwindcss when the install step doesn't complete before they
// start editing. Blueprint-agent 2026-04-20 bug report #4 documented this —
// they saw the analyzer emit 0 gaps against 198 events with obvious signal in
// topAddedPackages. This rewrite surfaces both classes.

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_PATHS } from '../dist/lib/buildout-traces.js'
import { loadCapabilityMap } from '../dist/lib/capability-inferrer.js'
import { planPrompt } from '../dist/lib/prompt-planner.js'

const OUT = '.evolve/capability-gaps.json'
// Bumped from 2000 → 4000 because real buildout prompts have ~3KB of
// preamble (sidecar instructions, dev-server step, no-restart guidance)
// before the actual user-ask. At 2000, the inferrer was matching only
// preamble, missing every domain signal in the user's request body.
// agent-trading scenario's `"strategy" editor (TypeScript snippet)` —
// the trigger for capability:code-editor — sits at offset ~3000.
const MAX_PROMPT_LEN = 4000
// Resolve registry relative to this script so the tool works when invoked
// from a tempdir (smoke test) or the repo root.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FAMILIES_DIR = join(REPO_ROOT, 'registry/families')
const CAPABILITIES_DIR = join(REPO_ROOT, 'registry/layers/capability')

if (!existsSync(DEFAULT_PATHS.buildoutsJsonl)) {
  console.error(
    `no buildouts file at ${DEFAULT_PATHS.buildoutsJsonl} — run scripts/run-buildout-pipeline.ts first`,
  )
  process.exit(2)
}

// Preload each family's full dependency surface (deps + devDeps + overrides keys).
// `overrides` and `pnpm.overrides` are included because if an override pins a
// version the scaffold indirectly ships it, and we don't want to report those
// as gaps.
function loadFamilyDeps() {
  const byFamily = new Map()
  for (const family of readdirSync(FAMILIES_DIR)) {
    const pkgPath = join(FAMILIES_DIR, family, 'files', 'package.json')
    if (!existsSync(pkgPath)) {
      byFamily.set(family, new Set())
      continue
    }
    let pkg
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    } catch {
      byFamily.set(family, new Set())
      continue
    }
    const deps = new Set()
    for (const block of [
      pkg.dependencies,
      pkg.devDependencies,
      pkg.peerDependencies,
      pkg.optionalDependencies,
    ]) {
      for (const name of Object.keys(block ?? {})) deps.add(name)
    }
    for (const name of Object.keys(pkg.overrides ?? {})) deps.add(name)
    for (const name of Object.keys(pkg.pnpm?.overrides ?? {})) deps.add(name)
    byFamily.set(family, deps)
  }
  return byFamily
}

// Preload each capability's packageDeps. Composer merges these into the
// produced scaffold's package.json — so deps shipped via capability
// packageDeps must NOT be classified as scaffold-gaps. Without this, the
// metric inflates: capability:tailwind ships @tailwindcss/vite, the planner
// attaches it to every React scenario, the composed scaffold contains the
// dep, but the inferrer still flagged 14 installs as "gap." The fix is to
// also union capability deps for whatever capabilities the planner attached.
function loadCapabilityDeps() {
  const byCapability = new Map()
  if (!existsSync(CAPABILITIES_DIR)) return byCapability
  for (const cap of readdirSync(CAPABILITIES_DIR)) {
    if (cap.startsWith('.') || cap.startsWith('_')) continue
    const mPath = join(CAPABILITIES_DIR, cap, 'manifest.json')
    if (!existsSync(mPath)) continue
    let m
    try {
      m = JSON.parse(readFileSync(mPath, 'utf8'))
    } catch {
      continue
    }
    const deps = new Set()
    const pd = m.packageDeps ?? {}
    for (const block of [
      pd.dependencies,
      pd.devDependencies,
      pd.peerDependencies,
      pd.optionalDependencies,
    ]) {
      for (const name of Object.keys(block ?? {})) deps.add(name)
    }
    byCapability.set(cap, deps)
  }
  return byCapability
}

// Capabilities on the plan look like 'capability:tailwind' / 'capability:zk-browser'.
// Strip the prefix to look up packageDeps.
function planCapabilities(plan) {
  const layers =
    plan.kind === 'starter'
      ? (plan.spec.layers ?? [])
      : plan.kind === 'workspace'
        ? (plan.spec.projects ?? []).flatMap((p) => p.spec.layers ?? [])
        : []
  return layers
    .filter((l) => typeof l === 'string' && l.startsWith('capability:'))
    .map((l) => l.slice('capability:'.length))
}

function planFamilies(plan) {
  if (plan.kind === 'starter') return [plan.spec.family]
  if (plan.kind === 'workspace') {
    return (plan.spec.projects ?? []).map((p) => p.spec.family).filter(Boolean)
  }
  return []
}

function* iterBuildouts(path) {
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line) continue
    try {
      yield JSON.parse(line)
    } catch {
      /* skip malformed */
    }
  }
}

const familyDeps = loadFamilyDeps()
const capabilityDeps = loadCapabilityDeps()
const capMap = loadCapabilityMap().mapping
const buildouts = [...iterBuildouts(DEFAULT_PATHS.buildoutsJsonl)]

// Aggregate per-package and per-capability across all buildouts.
const pkgIndex = new Map() // pkgName → aggregate
const capIndex = new Map() // capability → aggregate
const scenarioIndex = new Map() // scenarioId → { pkgs, caps }

let processed = 0
let totalAddedPackages = 0
let shippedByScaffold = 0
let realGaps = 0

for (const e of buildouts) {
  if (!e.initialPrompt) continue
  if (!Array.isArray(e.addedPackages) || e.addedPackages.length === 0) continue
  const prompt = e.initialPrompt.slice(0, MAX_PROMPT_LEN)

  let plan
  try {
    plan = await planPrompt({ prompt, partner: null })
  } catch {
    continue
  }

  const families = planFamilies(plan)
  if (families.length === 0) continue

  // Union of every dep the composed scaffold ships across all its projects.
  // Includes BOTH family-level package.json deps AND capability packageDeps
  // for whatever capabilities the planner attached. The latter is critical:
  // without it, capability:tailwind shipping @tailwindcss/vite is invisible
  // to the inferrer and gets misclassified as a scaffold gap.
  const shippedDeps = new Set()
  for (const f of families) {
    const deps = familyDeps.get(f)
    if (deps) for (const d of deps) shippedDeps.add(d)
  }
  const capabilities = planCapabilities(plan)
  for (const c of capabilities) {
    const deps = capabilityDeps.get(c)
    if (deps) for (const d of deps) shippedDeps.add(d)
  }

  const pass = e.outcome?.allPass === true
  const scenario = e.scenarioId ?? 'unknown'

  for (const p of e.addedPackages) {
    const name = typeof p === 'string' ? p : p?.name
    if (!name) continue
    totalAddedPackages++
    const inScaffold = shippedDeps.has(name)
    if (inScaffold) shippedByScaffold++
    else realGaps++

    const mapping = capMap[name]
    const capability = mapping?.capability ?? null

    let agg = pkgIndex.get(name)
    if (!agg) {
      agg = {
        package: name,
        timesInstalled: 0,
        onPass: 0,
        onFail: 0,
        inScaffoldDeps: inScaffold,
        mapsToCapability: capability,
        scenarios: new Set(),
        sampleFamilies: new Set(),
      }
      pkgIndex.set(name, agg)
    }
    agg.timesInstalled++
    if (pass) agg.onPass++
    else agg.onFail++
    agg.scenarios.add(scenario)
    for (const f of families) agg.sampleFamilies.add(f)

    if (capability) {
      let capAgg = capIndex.get(capability)
      if (!capAgg) {
        capAgg = {
          capability,
          totalTriggeringInstalls: 0,
          scenarios: new Set(),
          packagesTriggering: new Set(),
          gapInstalls: 0,
          orchestrationInstalls: 0,
        }
        capIndex.set(capability, capAgg)
      }
      capAgg.totalTriggeringInstalls++
      capAgg.scenarios.add(scenario)
      capAgg.packagesTriggering.add(name)
      if (inScaffold) capAgg.orchestrationInstalls++
      else capAgg.gapInstalls++
    }

    let sc = scenarioIndex.get(scenario)
    if (!sc) {
      sc = { scenarioId: scenario, gapPackages: new Map() }
      scenarioIndex.set(scenario, sc)
    }
    if (!inScaffold) {
      const existing = sc.gapPackages.get(name) ?? { package: name, times: 0, capability }
      existing.times++
      sc.gapPackages.set(name, existing)
    }
  }
  processed++
}

function serializePkg(agg) {
  const concern = agg.inScaffoldDeps ? 'orchestration' : 'scaffold-gap'
  return {
    package: agg.package,
    timesInstalled: agg.timesInstalled,
    onPass: agg.onPass,
    onFail: agg.onFail,
    inScaffoldDeps: agg.inScaffoldDeps,
    mapsToCapability: agg.mapsToCapability,
    concern,
    scenarios: [...agg.scenarios].sort(),
    sampleFamilies: [...agg.sampleFamilies].sort(),
  }
}

const allPackages = [...pkgIndex.values()]
  .map(serializePkg)
  .sort((a, b) => b.timesInstalled - a.timesInstalled)

const topScaffoldGaps = allPackages.filter((p) => p.concern === 'scaffold-gap').slice(0, 25)

const topOrchestrationInstalls = allPackages
  .filter((p) => p.concern === 'orchestration')
  .slice(0, 15)

const topMissedCapabilities = [...capIndex.values()]
  .map((c) => ({
    capability: c.capability,
    totalTriggeringInstalls: c.totalTriggeringInstalls,
    gapInstalls: c.gapInstalls,
    orchestrationInstalls: c.orchestrationInstalls,
    distinctScenarios: c.scenarios.size,
    scenarios: [...c.scenarios].filter(Boolean).sort(),
    packagesTriggering: [...c.packagesTriggering].sort(),
  }))
  .filter((c) => c.gapInstalls > 0)
  .sort((a, b) => b.gapInstalls - a.gapInstalls)
  .slice(0, 15)

const perScenarioGap = [...scenarioIndex.values()]
  .map((s) => ({
    scenarioId: s.scenarioId,
    distinctGapPackages: s.gapPackages.size,
    totalGapInstalls: [...s.gapPackages.values()].reduce((a, g) => a + g.times, 0),
    gapPackages: [...s.gapPackages.values()].sort((a, b) => b.times - a.times).slice(0, 10),
  }))
  .filter((s) => s.distinctGapPackages > 0)
  .sort((a, b) => b.totalGapInstalls - a.totalGapInstalls)

const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  processedEvents: processed,
  totalAgentInstalls: totalAddedPackages,
  breakdown: {
    scaffoldGap: realGaps,
    orchestration: shippedByScaffold,
  },
  topScaffoldGaps,
  topOrchestrationInstalls,
  topMissedCapabilities,
  perScenarioGap,
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(report, null, 2))

console.log(`=== capability gap report (schema v2) ===`)
console.log(`events processed:              ${processed}`)
console.log(`total agent installs:          ${totalAddedPackages}`)
console.log(`  scaffold-gap (our concern):  ${realGaps}`)
console.log(`  orchestration (not ours):    ${shippedByScaffold}`)
console.log('')
console.log(`top 10 scaffold gaps (packages not shipped — fix in registry):`)
for (const p of topScaffoldGaps.slice(0, 10)) {
  const capTag = p.mapsToCapability ? `[${p.mapsToCapability}]` : '[no-cap]'
  console.log(
    `  ${p.package.padEnd(32)} ${String(p.timesInstalled).padStart(3)}×  pass=${p.onPass} fail=${p.onFail}  ${capTag}  scenarios: ${p.scenarios.slice(0, 3).join(',')}`,
  )
}
console.log('')
console.log(`top 5 orchestration installs (packages already shipped — install-pipeline issue):`)
for (const p of topOrchestrationInstalls.slice(0, 5)) {
  console.log(
    `  ${p.package.padEnd(32)} ${String(p.timesInstalled).padStart(3)}×  pass=${p.onPass} fail=${p.onFail}`,
  )
}
console.log('')
console.log(`wrote: ${OUT}`)
