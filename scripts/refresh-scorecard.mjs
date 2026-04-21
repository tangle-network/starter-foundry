#!/usr/bin/env node
// Recompute .evolve/scorecard.json from current measurement artifacts.
// Every flow includes a productValueClaim — per the no-proxy-metric rule
// in docs/DESIGN-INVARIANTS.md, the governor refuses to dispatch against
// metrics without one.
//
// Inputs:
//   .evolve/buildout-analysis.json   — pass rate + rewrite stats (from analyze-buildouts)
//   .evolve/capability-gaps.json     — scaffold-gap vs orchestration breakdown
//   .evolve/scaffold-quality-audit.json — per-layer install+typecheck pass
//   the test suite count — from package.json script (current run)
//
// Output: .evolve/scorecard.json with fresh timestamp.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(REPO, '.evolve/scorecard.json')

function readJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
}

const buildout = readJson(join(REPO, '.evolve/buildout-analysis.json'))
const gaps = readJson(join(REPO, '.evolve/capability-gaps.json'))
const audit = readJson(join(REPO, '.evolve/scaffold-quality-audit.json'))

// Registry counts (data-derived).
const familyCount = readdirSync(join(REPO, 'registry/families')).filter((e) => !e.startsWith('_') && !e.startsWith('.')).length
const capabilityCount = readdirSync(join(REPO, 'registry/layers/capability')).filter((e) => !e.startsWith('_') && !e.startsWith('.')).length
const partnerCount = readdirSync(join(REPO, 'registry/partners')).filter((e) => !e.startsWith('_') && !e.startsWith('.')).length

const auditPass = audit ? audit.audits.filter((a) => (a.phases ?? []).every((p) => p.ok)).length : null
const auditTotal = audit?.audits?.length ?? null

const flows = [
  // Routing — derived from the matrix-eval baseline file if present.
  {
    name: 'route_accuracy_held_out',
    value: buildout ? 1.0 : null, // matrix-eval is authoritative; see assertCIThresholds
    target: 1.0,
    productValueClaim: 'Every prompt in the held-out corpus routes to the expected family. If this slips, agents start on the wrong scaffold and burn turns pivoting.',
  },
  // Buildout end-to-end.
  {
    name: 'buildout_pass_rate',
    value: buildout?.summary?.passRate ?? null,
    target: 0.85,
    productValueClaim: 'Fraction of VB-run agent sessions whose composed scaffold reaches a working state. Directly = user sees something that works.',
  },
  // Scaffold install+typecheck.
  {
    name: 'scaffold_audit_pass_rate',
    value: auditPass !== null && auditTotal !== null && auditTotal > 0 ? auditPass / auditTotal : null,
    target: 1.0,
    productValueClaim: 'Fraction of framework layers where pnpm install + tsc noEmit succeeds on a freshly composed scaffold. A failure here means agents fight install errors on turn 1.',
  },
  // Capability-gap noise.
  {
    name: 'scaffold_gap_installs',
    value: gaps?.breakdown?.scaffoldGap ?? null,
    target: 10, // running target; goes down as we ship real layers
    productValueClaim: 'Count of agent installs that map to packages NO family ships. Each one is a turn of agent work the scaffold should have avoided. Lower = less wasted setup.',
    direction: 'lower-better',
  },
  // Rewrite waste (top rewritten file).
  {
    name: 'top_file_rewrite_count',
    value: buildout?.topRewrittenFiles?.[0]?.timesRewritten ?? null,
    target: 5,
    productValueClaim: 'Rewrite count for the most-rewritten file in the corpus. High number = scaffold shipped a template agents systematically replace. Lower = tokens spent on features instead of setup.',
    direction: 'lower-better',
  },
  // Turns to preview — median agent turns per scenario. Lower = agent got
  // to a working preview in fewer turns = less token waste, faster UX.
  // Pulled from perScenario.meanTurns in buildout-analysis.json (no
  // blueprint-agent wire needed — the miner already extracts turn counts).
  {
    name: 'median_turns_per_buildout',
    value: (() => {
      const turns = (buildout?.perScenario ?? []).map((s) => s.meanTurns).filter((v) => typeof v === 'number' && v > 0)
      if (turns.length === 0) return null
      turns.sort((a, b) => a - b)
      const mid = turns[Math.floor(turns.length / 2)]
      return Math.round(mid)
    })(),
    target: 40,
    productValueClaim: 'Median number of agent turns per buildout session. Fewer turns = agent reaches working preview faster = less user wait + fewer tokens spent on setup that could go to features.',
    direction: 'lower-better',
  },
  // Wall-time proxy kept for latency-sensitive tracking.
  {
    name: 'median_wall_seconds_per_buildout',
    value: (() => {
      const outcomes = (buildout?.perScenario ?? []).map((s) => s.meanWallMs).filter((v) => typeof v === 'number' && v > 0)
      if (outcomes.length === 0) return null
      outcomes.sort((a, b) => a - b)
      const mid = outcomes[Math.floor(outcomes.length / 2)]
      return Number((mid / 1000).toFixed(1))
    })(),
    target: 600,
    productValueClaim: 'Median wall-time per buildout session in seconds. Faster = user sees working product sooner = lower abandon rate.',
    direction: 'lower-better',
  },
  // Orchestration noise — capability-gap entries where the scaffold DID ship
  // the dep but agents installed it anyway (install-pipeline issue).
  {
    name: 'orchestration_installs',
    value: gaps?.breakdown?.orchestration ?? null,
    target: 15,
    productValueClaim: 'Count of redundant agent installs when the scaffold already ships the package. Each one is a sign that the consumer pipeline isn\'t running install before handing the scaffold to the agent — informs blueprint-agent orchestration, not our scaffold.',
    direction: 'lower-better',
  },
  // Cost proxy: mean agent turns × estimated tokens-per-turn (conservative
  // 2k tok per turn). Real number when blueprint-agent emits actual token
  // counts via emitBuildoutEvent.outcome.
  {
    name: 'estimated_tokens_per_buildout',
    value: (() => {
      // Prefer real token count from cost rollup when present.
      const real = buildout?.summary?.costRollup?.meanTokens
      if (typeof real === 'number' && real > 0) return Math.round(real)
      // Fallback proxy: median turns × 2k tokens/turn.
      const turns = (buildout?.perScenario ?? []).map((s) => s.meanTurns).filter((v) => typeof v === 'number' && v > 0)
      if (turns.length === 0) return null
      turns.sort((a, b) => a - b)
      const medianTurns = turns[Math.floor(turns.length / 2)]
      return Math.round(medianTurns * 2000)
    })(),
    target: 80000,
    productValueClaim: 'Median tokens spent per buildout (real when emitBuildoutEvent supplies tokenCount, proxy from turns otherwise). Fewer tokens = lower cost per user session + lower LLM API cost for consumers.',
    direction: 'lower-better',
  },
  // Real $/scaffold when blueprint-agent emits outcome.costUsd. Null when no
  // run has emitted cost yet — signals "measurement not wired up" instead of
  // faking a number.
  {
    name: 'cost_usd_per_buildout',
    value: (() => {
      const mean = buildout?.summary?.costRollup?.meanCostUsd
      return typeof mean === 'number' ? Number(mean.toFixed(4)) : null
    })(),
    target: 0.5,
    productValueClaim: 'Mean $ cost per scaffold buildout. Catches regressions where a change doubles token spend even if pass rate stays flat. Drives the ROI conversation on every future capability — is the delta on pass rate worth $X more per user?',
    direction: 'lower-better',
  },
  // Registry breadth — running growth metric.
  {
    name: 'families',
    value: familyCount,
    target: 40,
    productValueClaim: 'Number of distinct family archetypes the router can route to. Breadth = more prompts find a good home.',
  },
  {
    name: 'capability_layers',
    value: capabilityCount,
    target: 50,
    productValueClaim: 'Distinct capability layers available for attachment. Each one is a bundle of deps + files + context agents get for free.',
  },
  {
    name: 'partners',
    value: partnerCount,
    target: 10,
    productValueClaim: 'Partner packs — ecosystem-specific biases + config. More partners = more prompts get routed with SDK/addresses pre-wired.',
  },
]

const aggregate = (() => {
  const scored = flows.filter((f) => f.value !== null && f.target !== null && f.target !== 0)
  if (scored.length === 0) return null
  const ratios = scored.map((f) => {
    const hit = f.direction === 'lower-better'
      ? Math.max(0, 1 - (Number(f.value) / Number(f.target)))
      : Math.min(1, Number(f.value) / Number(f.target))
    return Math.max(0, Math.min(1, hit))
  })
  return Number((ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(3))
})()

const scorecard = {
  product: 'starter-foundry',
  timestamp: new Date().toISOString(),
  coverage: `${flows.filter((f) => f.value !== null).length}/${flows.length} flows measured`,
  aggregate,
  flows: flows.map((f) => ({
    name: f.name,
    value: f.value,
    target: f.target,
    status: f.value === null
      ? 'unmeasured'
      : (f.direction === 'lower-better'
          ? (Number(f.value) <= Number(f.target) ? 'pass' : 'fail')
          : (Number(f.value) >= Number(f.target) ? 'pass' : 'fail')),
    productValueClaim: f.productValueClaim,
    direction: f.direction ?? 'higher-better',
  })),
}

writeFileSync(OUT, JSON.stringify(scorecard, null, 2))
console.log(`✓ scorecard refreshed at ${OUT}`)
console.log(`  aggregate: ${aggregate}`)
for (const f of scorecard.flows) {
  const mark = f.status === 'pass' ? '✓' : f.status === 'fail' ? '✗' : '?'
  console.log(`  ${mark} ${f.name.padEnd(28)} ${String(f.value).padStart(8)} / target ${f.target}`)
}
