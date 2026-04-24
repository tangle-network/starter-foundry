#!/usr/bin/env node
// Scaffold-wide agent-eval driver.
//
// For every seed (family or workspace prompt) in .evolve/agent-eval/seeds.json:
//   1. planPrompt → spec
//   2. resolveComponents → components (family + layers)
//   3. scaffold-bridge.prepareScaffoldForEval → composes to tempdir,
//      emits snapshot, harness config, structural assertions
//   4. agent-eval BuilderSession → ship() drives SandboxHarness, records
//      build_score from harness result
//   5. agent-eval runAssertions(snapshot) → structural pass rate
//   6. optional: LLM judge (createLlmReviewer + recordMetaScore) for
//      meta_score — gated on TANGLE_ROUTER_USER_KEY / ANTHROPIC_API_KEY
//   7. scoreProject via agent-eval's three-layer-eval → kind='scaffold-only'
//
// Output: .evolve/agent-eval/<YYYY-MM-DD>/
//   - three-layer-report.json  (scoreAllProjects rollup)
//   - traces.jsonl             (TraceEmitter raw)
//   - structural-assertions.jsonl
//   - cost-summary.json        (CostTracker)
//
// Usage:
//   pnpm eval:scaffold              # full sweep — ~96 families + 6 workspaces
//   pnpm eval:scaffold:sample       # 20 representative scaffolds
//   node scripts/agent-eval-scaffold.mjs --family risczero-zkvm  # single
//   node scripts/agent-eval-scaffold.mjs --no-judge              # skip LLM, structural-only

import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  InMemoryTraceStore,
  BuilderSession,
  SubprocessSandboxDriver,
  scoreAllProjects,
  runAssertions,
  CostTracker,
} from '@tangle-network/agent-eval'
import { planPrompt } from '../dist/lib/prompt-planner.js'
import { resolveComponents } from '../dist/lib/registry.js'
import { prepareScaffoldForEval, invokeMetaJudge } from '../dist/eval/scaffold-bridge.js'
import { isLLMAvailable } from '../dist/lib/llm.js'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const argv = process.argv.slice(2)
const FAMILY_FILTER = (() => { const i = argv.indexOf('--family'); return i >= 0 ? argv[i + 1] : null })()
const SAMPLE_SIZE = (() => { const i = argv.indexOf('--sample'); return i >= 0 ? Number(argv[i + 1]) : null })()
const NO_JUDGE = argv.includes('--no-judge')
const QUIET = argv.includes('--quiet')

// ── seed loading ──────────────────────────────────────────────────
const seedsPath = join(REPO, '.evolve/agent-eval/seeds.json')
if (!existsSync(seedsPath)) {
  console.error(`missing ${seedsPath} — regenerate from tests/coverage.test.ts FAMILY_PROMPTS`)
  process.exit(2)
}
const seeds = JSON.parse(readFileSync(seedsPath, 'utf8'))

const allSeeds = [
  ...seeds.families.map((s) => ({ id: s.family, prompt: s.prompt, kind: 'family' })),
  ...seeds.workspaces.map((s) => ({ id: s.id, prompt: s.prompt, kind: 'workspace' })),
]

let selected = allSeeds
if (FAMILY_FILTER) {
  selected = allSeeds.filter((s) => s.id === FAMILY_FILTER)
  if (selected.length === 0) {
    console.error(`no seed matches --family ${FAMILY_FILTER}`)
    process.exit(2)
  }
}
if (SAMPLE_SIZE && SAMPLE_SIZE < selected.length) {
  // Stratified sample: half from families, half from workspaces.
  const fams = selected.filter((s) => s.kind === 'family')
  const wks = selected.filter((s) => s.kind === 'workspace')
  const famQuota = Math.ceil(SAMPLE_SIZE * 0.7)
  const wkQuota = Math.min(SAMPLE_SIZE - famQuota, wks.length)
  // Reservoir-free: shuffle via seeded hash for reproducibility.
  const shuffled = (arr) => arr.map((x) => [hashString(x.id), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x)
  selected = [...shuffled(fams).slice(0, famQuota), ...shuffled(wks).slice(0, wkQuota)]
}

function hashString(s) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

// ── output setup ──────────────────────────────────────────────────
const dateStr = new Date().toISOString().slice(0, 10)
const outDir = join(REPO, '.evolve/agent-eval', dateStr)
mkdirSync(outDir, { recursive: true })
const tracesPath = join(outDir, 'traces.jsonl')
const assertionsPath = join(outDir, 'structural-assertions.jsonl')
// Reset log files for this run — append-only within this session.
writeFileSync(tracesPath, '')
writeFileSync(assertionsPath, '')

// ── per-seed run ──────────────────────────────────────────────────
const store = new InMemoryTraceStore()
const costTracker = new CostTracker()
const runReports = []

if (!QUIET) console.log(`agent-eval-scaffold: ${selected.length} seeds, out=${outDir.replace(REPO + '/', '')}`)

for (const seed of selected) {
  const t0 = Date.now()
  const projectId = `scaffold:${seed.id}`
  const plan = await planPrompt({ prompt: seed.prompt, partner: null })

  if (plan.kind === 'workspace') {
    // Workspace — iterate each project. Capture the FIRST starter project
    // per seed (the leading family) as the build artifact; extension for
    // full workspace eval is follow-on work.
    // For this first ship we grade the "primary" project only.
    const primary = plan.spec.projects[0]
    if (!primary) {
      appendFileSync(tracesPath, JSON.stringify({ seed: seed.id, error: 'empty workspace projects' }) + '\n')
      continue
    }
    await evalSeed({ seed, projectId, spec: primary.spec })
    continue
  }
  await evalSeed({ seed, projectId, spec: plan.spec })

  async function evalSeed({ seed, projectId, spec }) {
    let prep
    try {
      const components = await resolveComponents(spec)
      prep = await prepareScaffoldForEval({ spec, components })
    } catch (err) {
      // Compose failure → record as a failed build with zero score.
      const msg = err?.message?.slice(0, 500) ?? String(err)
      appendFileSync(tracesPath, JSON.stringify({ seed: seed.id, phase: 'compose', pass: false, error: msg }) + '\n')
      if (!QUIET) console.error(`[${seed.id}] compose failed: ${msg}`)
      return
    }

    // cwd is baked into prep.harness by prepareScaffoldForEval. Do NOT
    // pass it to the driver constructor — SubprocessSandboxDriver.exec
    // reads cwd from the per-call HarnessConfig (agent-eval@0.7.0), so a
    // constructor arg is silently dropped. That was the Gen 8b promoter
    // bug and it lived here in the runtime path until Round 0 post-Gen-9.
    const driver = new SubprocessSandboxDriver()
    const session = new BuilderSession(store, { projectId }, driver)
    await session.startChat()

    // Ship = install + build, as configured per-family in the bridge.
    // BuilderSession emits an app-build child run with outcome.score from
    // the harness's testsPassed / testsTotal ratio.
    let shipResult
    try {
      shipResult = await session.ship({ harness: prep.harness })
    } catch (err) {
      const msg = err?.message?.slice(0, 500) ?? String(err)
      appendFileSync(tracesPath, JSON.stringify({ seed: seed.id, phase: 'ship', pass: false, error: msg }) + '\n')
      prep.cleanup()
      return
    }

    // Structural correctness — runAssertions against snapshot files that
    // the manifest says should exist. Complements the build score: build
    // can pass while the manifest's promised files are missing.
    const structural = runAssertions(prep.snapshot, prep.assertions)
    appendFileSync(
      assertionsPath,
      JSON.stringify({
        seed: seed.id,
        projectId,
        pass: structural.pass,
        score: structural.score,
        total: prep.assertions.length,
        failures: structural.results.filter((r) => !r.pass).slice(0, 10).map((r) => r.detail ?? 'unnamed'),
      }) + '\n',
    )

    // Meta score — LLM judge via router.tangle.tools. Gated on
    // --no-judge and on credentials availability. Runs AFTER ship so
    // the snapshot we grade includes anything install produced (e.g.
    // node_modules metadata is already excluded by the snapshot, but
    // install CAN produce lock files that the judge cares about).
    if (!NO_JUDGE && isLLMAvailable()) {
      try {
        const verdict = await invokeMetaJudge({
          userPrompt: seed.prompt,
          composedSpec: spec,
          snapshot: prep.snapshot,
        })
        await session.recordMetaScore(
          verdict.overall,
          `verdict=${verdict.verdict}; issues=${verdict.issues.length}`,
        )
        // Record into CostTracker so cost-summary.json actually populates.
        // Uses agent-eval 0.7.2's recordVerdict helper — one call instead
        // of record + markOutcome. No-ops if verdict.usage is absent
        // (e.g. compile-gate short-circuit — no LLM spend to track).
        costTracker.recordVerdict(verdict, seed.id, { phase: 'meta-judge' })
        appendFileSync(tracesPath, JSON.stringify({
          seed: seed.id,
          projectId,
          phase: 'meta-judge',
          overall: verdict.overall,
          verdict: verdict.verdict,
          dimensions: {
            correctness: verdict.correctness,
            completeness: verdict.completeness,
            idiomatic: verdict.idiomatic,
            productionReady: verdict.productionReady,
            overScaffold: verdict.overScaffold,
          },
          issues: verdict.issues,
          usage: verdict.usage ?? null,
        }) + '\n')
      } catch (err) {
        const msg = err?.message?.slice(0, 500) ?? String(err)
        appendFileSync(tracesPath, JSON.stringify({ seed: seed.id, phase: 'meta-judge', error: msg }) + '\n')
        if (!QUIET) console.error(`  [${seed.id}] meta-judge failed: ${msg}`)
      }
    }

    await session.endChat({
      pass: shipResult.result?.passed ?? false,
      score: shipResult.result?.score ?? 0,
    })
    prep.cleanup()

    const dt = Date.now() - t0
    runReports.push({ seed: seed.id, projectId, wallMs: dt, structuralScore: structural.score, buildScore: shipResult.result?.score ?? 0 })
    if (!QUIET) {
      const mark = shipResult.result?.passed ? '✓' : '✗'
      console.log(`  ${mark} ${seed.id.padEnd(30)} build=${(shipResult.result?.score ?? 0).toFixed(2)} struct=${structural.score.toFixed(2)} (${(dt/1000).toFixed(1)}s)`)
    }
  }
}

// ── aggregate + write report ──────────────────────────────────────
const threeLayer = await scoreAllProjects(store)
const reportPath = join(outDir, 'three-layer-report.json')
const costSummaryPath = join(outDir, 'cost-summary.json')

const summary = {
  timestamp: new Date().toISOString(),
  seedsEvaluated: runReports.length,
  seedsTotal: selected.length,
  byKind: {
    full: threeLayer.filter((r) => r.kind === 'full').length,
    'scaffold-only': threeLayer.filter((r) => r.kind === 'scaffold-only').length,
  },
  complete: threeLayer.filter((r) => r.complete).length,
  meanBuildScore: meanOf(threeLayer, (r) => r.buildScore),
  meanMetaScore: meanOf(threeLayer, (r) => r.metaScore),
}
writeFileSync(reportPath, JSON.stringify({ summary, projects: threeLayer, runReports }, null, 2))
// Method is `.summary()`, not `.getSummary()` — pre-R4 the optional
// chaining silent-failed and wrote `{}`. Explicit call now.
writeFileSync(costSummaryPath, JSON.stringify(costTracker.summary(), null, 2))

if (!QUIET) {
  console.log(`\n━━━━ agent-eval-scaffold summary ━━━━`)
  console.log(`  seeds:            ${summary.seedsEvaluated} / ${summary.seedsTotal}`)
  console.log(`  kind=full:        ${summary.byKind.full}`)
  console.log(`  kind=scaffold:    ${summary.byKind['scaffold-only']}`)
  console.log(`  complete:         ${summary.complete}`)
  console.log(`  mean build_score: ${summary.meanBuildScore?.toFixed(3) ?? 'n/a'}`)
  console.log(`  mean meta_score:  ${summary.meanMetaScore?.toFixed(3) ?? 'n/a (judge disabled)'}`)
  console.log(`  report:           ${reportPath.replace(REPO + '/', '')}`)
}

function meanOf(arr, extract) {
  const vals = arr.map(extract).filter((v) => typeof v === 'number')
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}
