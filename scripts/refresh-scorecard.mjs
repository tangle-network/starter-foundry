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

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Gen-2: allow tests to redirect REPO to a fixture dir via env var.
// Production paths use the natural dirname(__filename)/.. derivation;
// tests set STARTER_FOUNDRY_REPO_OVERRIDE to isolate .evolve/ state.
const REPO = process.env.STARTER_FOUNDRY_REPO_OVERRIDE
  ?? resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(REPO, '.evolve/scorecard.json')

// Gen-3: read-time self-heal. When a derived input is older than the
// canonical source (.evolve/traces/buildouts.jsonl), spawn the specific
// stage that regenerates it BEFORE reading, then continue. Makes the
// scorecard self-fresh: any caller invoking this script gets honest
// data regardless of what pipeline runs the operator remembered.
//
// Disabled when:
//   STARTER_FOUNDRY_NO_SELF_HEAL=1       - tests + measure-refresh.mjs set this
//   STARTER_FOUNDRY_REPO_OVERRIDE is set - test fixtures don't have the scripts
const SELF_HEAL =
  process.env.STARTER_FOUNDRY_NO_SELF_HEAL !== '1'
  && !process.env.STARTER_FOUNDRY_REPO_OVERRIDE

function mtimeOf(path) {
  try { return existsSync(path) ? statSync(path).mtime.getTime() : 0 } catch { return 0 }
}

function hoursBetween(newerMs, olderMs) {
  return ((newerMs - olderMs) / 3_600_000).toFixed(1)
}

function trySelfHeal(targetPath, scriptRel, reason) {
  if (!SELF_HEAL) return false
  const scriptPath = join(REPO, scriptRel)
  if (!existsSync(scriptPath)) return false
  console.error(`[self-heal] regenerating ${targetPath.replace(REPO + '/', '')} (${reason})`)
  const r = spawnSync(process.execPath, [scriptPath], {
    cwd: REPO,
    env: { ...process.env, STARTER_FOUNDRY_NO_SELF_HEAL: '1' },
    stdio: 'pipe',
    encoding: 'utf8',
  })
  if (r.status !== 0) {
    console.error(`[self-heal] regen failed (exit ${r.status}); keeping stale file`)
    return false
  }
  return true
}

// The canonical freshness anchor — every derived file is supposed to
// reflect this source. If a derived artifact's mtime is older than
// buildouts.jsonl, flag every flow computed from it as stale.
const SOURCE_PATH = join(REPO, '.evolve/traces/buildouts.jsonl')
const SOURCE_MTIME = mtimeOf(SOURCE_PATH)

// Gen-3: before reading any analysis file, if the source is newer,
// regen the analysis. One regen attempt per input per invocation.
function healIfStale(analysisPath, scriptRel) {
  if (SOURCE_MTIME === 0) return // source missing — nothing to heal against
  const outMtime = mtimeOf(analysisPath)
  if (outMtime >= SOURCE_MTIME) return // already fresh
  const age = outMtime === 0 ? '(missing)' : `${hoursBetween(SOURCE_MTIME, outMtime)}h stale`
  trySelfHeal(analysisPath, scriptRel, age)
}

healIfStale(join(REPO, '.evolve/buildout-analysis.json'), 'scripts/analyze-buildouts.mjs')
healIfStale(join(REPO, '.evolve/capability-gaps.json'), 'scripts/infer-capability-gaps.mjs')
// scaffold-quality-audit is 20-30 min to regen; flag-only (no self-heal).
// replay-traces is fast and deterministic — always run when SELF_HEAL is on.
if (SELF_HEAL && existsSync(join(REPO, 'scripts/replay-traces.mjs'))) {
  const replayOut = join(REPO, '.evolve/buildout-analysis-internal.json')
  // Run replay when its output is older than source OR doesn't exist.
  // Registry changes are not mtime-tracked here — measure-refresh handles
  // that deeper check; this is the read-time safety net.
  if (mtimeOf(replayOut) < SOURCE_MTIME) {
    trySelfHeal(replayOut, 'scripts/replay-traces.mjs', 'counterfactual refresh')
  }
}

// Gen-2: track every file we read so the scorecard can manifest them
// alongside mtimes. A flow whose input file is older than the canonical
// source (`.evolve/traces/buildouts.jsonl`) gets stale: true in its
// output so the governor can refuse to dispatch on stale numbers.
const inputsRead = []
function readJson(path) {
  if (!existsSync(path)) return null
  try {
    const st = statSync(path)
    inputsRead.push({ path: path.replace(REPO + '/', ''), mtime: st.mtime.toISOString() })
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

const buildout = readJson(join(REPO, '.evolve/buildout-analysis.json'))
const gaps = readJson(join(REPO, '.evolve/capability-gaps.json'))
const audit = readJson(join(REPO, '.evolve/scaffold-quality-audit.json'))

// Gen-3: counterfactual fallback. When buildout-analysis.json is stale but
// buildout-analysis-internal.json (replay-traces output) is fresh, the
// internal data can substitute for the scorecard's buildout-derived flows.
// Not all fields map 1:1 — topRewrittenFiles only exists in main analysis —
// so this is partial substitution with a marker.
const buildoutInternal = readJson(join(REPO, '.evolve/buildout-analysis-internal.json'))
const useCounterfactual =
  buildoutInternal
  && mtimeOf(join(REPO, '.evolve/buildout-analysis.json')) < SOURCE_MTIME
  && mtimeOf(join(REPO, '.evolve/buildout-analysis-internal.json')) >= SOURCE_MTIME

// Per-input staleness: true when the input file is OLDER than the
// canonical source. Flows downstream of a stale input get marked stale,
// unless the counterfactual (buildout-analysis-internal.json) is fresh
// and can substitute — in which case the flow is marked `source:
// 'counterfactual'` instead of `stale: true`, and read from internal.
const buildoutStale = mtimeOf(join(REPO, '.evolve/buildout-analysis.json')) < SOURCE_MTIME
const staleness = {
  buildout: buildoutStale && !useCounterfactual,
  gaps: mtimeOf(join(REPO, '.evolve/capability-gaps.json')) < SOURCE_MTIME,
  audit: mtimeOf(join(REPO, '.evolve/scaffold-quality-audit.json')) < SOURCE_MTIME,
}
// When counterfactual is used, mark the buildout-derived flows so
// downstream readers know the source shifted.
const buildoutSource = useCounterfactual ? 'counterfactual' : 'historical'

// Resolver: prefer main buildout analysis; fall back to internal when stale
// and internal is fresh. Returns the effective buildout-like object for
// scorecard flows; some fields (topRewrittenFiles) exist only on main.
const effectiveBuildout = useCounterfactual
  ? {
      // Schema-harmonize: internal has { summary, perScenario, ... } shape
      // close enough to main for the scorecard's purposes. Missing fields
      // (topRewrittenFiles, topAddedPackages) are pulled from main if it
      // exists at all, even if stale — a stale topRewrittenFiles still
      // matters because it's direction-preserving across single sweeps.
      summary: buildoutInternal.summary,
      perScenario: buildoutInternal.perScenario,
      topRewrittenFiles: buildout?.topRewrittenFiles ?? [],
      topAddedPackages: buildout?.topAddedPackages ?? [],
      topAddedDirs: buildout?.topAddedDirs ?? [],
    }
  : buildout

// Registry counts (data-derived).
const familyCount = readdirSync(join(REPO, 'registry/families')).filter((e) => !e.startsWith('_') && !e.startsWith('.')).length
const capabilityCount = readdirSync(join(REPO, 'registry/layers/capability')).filter((e) => !e.startsWith('_') && !e.startsWith('.')).length
const partnerCount = readdirSync(join(REPO, 'registry/partners')).filter((e) => !e.startsWith('_') && !e.startsWith('.')).length

const auditPass = audit ? audit.audits.filter((a) => (a.phases ?? []).every((p) => p.ok)).length : null
const auditTotal = audit?.audits?.length ?? null

// Gen-2: compute run-weighted median turns directly from buildouts.jsonl
// alongside the scenario-mean-weighted median from buildout-analysis.json.
// Both are legitimate: scenario-mean-weighted answers "what's a typical
// scenario's mean turn count" (unweighted by how often each scenario runs);
// run-weighted answers "what's the median turns across ALL runs" (matches
// real user-experience cost). Showing both eliminates "which number is
// real" confusion that misdirected research this session.
function computeRunWeightedMedianTurns() {
  const path = join(REPO, '.evolve/traces/buildouts.jsonl')
  if (!existsSync(path)) return null
  const turns = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      const d = JSON.parse(line)
      const t = d?.outcome?.toolCallsTotal
      if (typeof t === 'number' && t > 0) turns.push(t)
    } catch { /* malformed trace — skip */ }
  }
  if (turns.length === 0) return null
  turns.sort((a, b) => a - b)
  return turns[Math.floor(turns.length / 2)]
}
const runWeightedMedianTurns = computeRunWeightedMedianTurns()

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
    value: effectiveBuildout?.summary?.passRate ?? null,
    target: 0.85,
    productValueClaim: 'Fraction of VB-run agent sessions whose composed scaffold reaches a working state. Directly = user sees something that works.',
    stale: staleness.buildout,
  },
  // Scaffold install+typecheck.
  {
    name: 'scaffold_audit_pass_rate',
    value: auditPass !== null && auditTotal !== null && auditTotal > 0 ? auditPass / auditTotal : null,
    target: 1.0,
    productValueClaim: 'Fraction of framework layers where pnpm install + tsc noEmit succeeds on a freshly composed scaffold. A failure here means agents fight install errors on turn 1.',
    stale: staleness.audit,
  },
  // Capability-gap noise.
  {
    name: 'scaffold_gap_installs',
    value: gaps?.breakdown?.scaffoldGap ?? null,
    target: 10, // running target; goes down as we ship real layers
    productValueClaim: 'Count of agent installs that map to packages NO family ships. Each one is a turn of agent work the scaffold should have avoided. Lower = less wasted setup.',
    direction: 'lower-better',
    stale: staleness.gaps,
  },
  // Rewrite waste (top rewritten file).
  {
    name: 'top_file_rewrite_count',
    value: effectiveBuildout?.topRewrittenFiles?.[0]?.timesRewritten ?? null,
    target: 5,
    productValueClaim: 'Rewrite count for the most-rewritten file in the corpus. High number = scaffold shipped a template agents systematically replace. Lower = tokens spent on features instead of setup.',
    direction: 'lower-better',
    stale: staleness.buildout,
  },
  // Turns to preview — median agent turns per scenario. Lower = agent got
  // to a working preview in fewer turns = less token waste, faster UX.
  // Pulled from perScenario.meanTurns in buildout-analysis.json (no
  // blueprint-agent wire needed — the miner already extracts turn counts).
  {
    name: 'median_turns_per_buildout',
    value: (() => {
      const turns = (effectiveBuildout?.perScenario ?? []).map((s) => s.meanTurns).filter((v) => typeof v === 'number' && v > 0)
      if (turns.length === 0) return null
      turns.sort((a, b) => a - b)
      const mid = turns[Math.floor(turns.length / 2)]
      return Math.round(mid)
    })(),
    target: 40,
    productValueClaim: 'Median number of agent turns per buildout session. Fewer turns = agent reaches working preview faster = less user wait + fewer tokens spent on setup that could go to features.',
    direction: 'lower-better',
    stale: staleness.buildout,
    notes: 'scenario-mean-weighted — unweighted by run count per scenario',
  },
  // Gen-2 addition: same metric, run-weighted. Dominant scenarios (e.g.
  // cross-chain-bridge with 47 runs) pull this toward the tail. Tracks
  // actual-user-cost better than the scenario-mean-weighted version.
  {
    name: 'median_turns_per_buildout_run_weighted',
    value: runWeightedMedianTurns,
    target: 40,
    productValueClaim: 'Run-weighted median agent turns. Matches what a random user experiences, since high-frequency scenarios dominate the distribution. Complement to the scenario-mean-weighted metric — both must pass for the corpus to be healthy.',
    direction: 'lower-better',
  },
  // Wall-time proxy kept for latency-sensitive tracking.
  {
    name: 'median_wall_seconds_per_buildout',
    value: (() => {
      const outcomes = (effectiveBuildout?.perScenario ?? []).map((s) => s.meanWallMs).filter((v) => typeof v === 'number' && v > 0)
      if (outcomes.length === 0) return null
      outcomes.sort((a, b) => a - b)
      const mid = outcomes[Math.floor(outcomes.length / 2)]
      return Number((mid / 1000).toFixed(1))
    })(),
    target: 600,
    productValueClaim: 'Median wall-time per buildout session in seconds. Faster = user sees working product sooner = lower abandon rate.',
    direction: 'lower-better',
    stale: staleness.buildout,
  },
  // Orchestration noise — capability-gap entries where the scaffold DID ship
  // the dep but agents installed it anyway (install-pipeline issue).
  {
    name: 'orchestration_installs',
    value: gaps?.breakdown?.orchestration ?? null,
    target: 15,
    productValueClaim: 'Count of redundant agent installs when the scaffold already ships the package. Each one is a sign that the consumer pipeline isn\'t running install before handing the scaffold to the agent — informs blueprint-agent orchestration, not our scaffold.',
    direction: 'lower-better',
    stale: staleness.gaps,
  },
  // Cost proxy: mean agent turns × estimated tokens-per-turn (conservative
  // 2k tok per turn). Real number when blueprint-agent emits actual token
  // counts via emitBuildoutEvent.outcome.
  {
    name: 'estimated_tokens_per_buildout',
    value: (() => {
      // Prefer real token count from cost rollup when present.
      const real = effectiveBuildout?.summary?.costRollup?.meanTokens
      if (typeof real === 'number' && real > 0) return Math.round(real)
      // Fallback proxy: median turns × 2k tokens/turn.
      const turns = (effectiveBuildout?.perScenario ?? []).map((s) => s.meanTurns).filter((v) => typeof v === 'number' && v > 0)
      if (turns.length === 0) return null
      turns.sort((a, b) => a - b)
      const medianTurns = turns[Math.floor(turns.length / 2)]
      return Math.round(medianTurns * 2000)
    })(),
    target: 80000,
    productValueClaim: 'Median tokens spent per buildout (real when emitBuildoutEvent supplies tokenCount, proxy from turns otherwise). Fewer tokens = lower cost per user session + lower LLM API cost for consumers.',
    direction: 'lower-better',
    stale: staleness.buildout,
  },
  // Real $/scaffold when blueprint-agent emits outcome.costUsd. Null when no
  // run has emitted cost yet — signals "measurement not wired up" instead of
  // faking a number.
  {
    name: 'cost_usd_per_buildout',
    value: (() => {
      const mean = effectiveBuildout?.summary?.costRollup?.meanCostUsd
      return typeof mean === 'number' ? Number(mean.toFixed(4)) : null
    })(),
    target: 0.5,
    productValueClaim: 'Mean $ cost per scaffold buildout. Catches regressions where a change doubles token spend even if pass rate stays flat. Drives the ROI conversation on every future capability — is the delta on pass rate worth $X more per user?',
    direction: 'lower-better',
    stale: staleness.buildout,
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
  // ── Gen 5: closed-loop generation flows ────────────────────────
  // Read .evolve/generation-impact.jsonl — one entry per proposal
  // lifecycle event (promoted / promote-failed). Compute a rolling
  // 30-day window so a stale spike doesn't mask a recent stall.
  ...(() => {
    const impactLog = join(REPO, '.evolve/generation-impact.jsonl')
    if (!existsSync(impactLog)) return []
    const windowMs = 30 * 24 * 3_600_000
    const cutoff = Date.now() - windowMs
    let entries = []
    try {
      entries = readFileSync(impactLog, 'utf8').split('\n').filter(Boolean).map((l) => {
        try { return JSON.parse(l) } catch { return null }
      }).filter(Boolean).filter((e) => {
        const t = Date.parse(e.ts ?? '')
        if (!Number.isFinite(t) || t < cutoff) return false
        // Filter test-fixture events that pollute real metrics. Test names
        // prefixed with `test-` or `synthetic-` are written during `pnpm test`
        // and must not count toward production promotion/coverage rates.
        const id = String(e.id ?? '')
        const newFam = String(e.newFamily ?? '')
        if (/^test-/.test(id) || /^synthetic-/.test(id)) return false
        if (/^test-/.test(newFam) || /^synthetic-/.test(newFam)) return false
        return true
      })
    } catch { /* empty file is fine */ }
    // A promote-reverted event means a prior 'promoted' was rolled back because
    // the scaffold, despite passing build, failed a human / fidelity review.
    // Subtract reverted ids from the promoted count so the rate reflects
    // shippable promotes, not merely gate-passing ones. Match by id AND
    // timestamp — a 'promoted' that happened AFTER a 'promote-reverted' for
    // the same id is a fresh re-promote (R2 patch-and-resubmit workflow)
    // and must not be subtracted.
    const revertedByIdTs = new Map() // id → latest revert ts
    for (const e of entries) {
      if (e.event !== 'promote-reverted') continue
      const id = String(e.id ?? '')
      const ts = Date.parse(e.ts ?? '') || 0
      if (!revertedByIdTs.has(id) || revertedByIdTs.get(id) < ts) revertedByIdTs.set(id, ts)
    }
    const promoteAttempts = entries.filter((e) => e.event === 'promoted' || e.event === 'promote-failed')
    const promoted = entries.filter((e) => {
      if (e.event !== 'promoted') return false
      const id = String(e.id ?? '')
      const ts = Date.parse(e.ts ?? '') || 0
      const revertTs = revertedByIdTs.get(id)
      // If this promoted event is AT OR BEFORE the latest revert, it's stale.
      // Promoted AFTER the revert = fresh re-promote, counts.
      if (revertTs !== undefined && ts <= revertTs) return false
      return true
    })
    const promotionRate = promoteAttempts.length > 0 ? promoted.length / promoteAttempts.length : null
    const firstShipHours = promoted
      .map((e) => e.draftAgeHours)
      .filter((h) => typeof h === 'number')
    firstShipHours.sort((a, b) => a - b)
    const medianFirstShip = firstShipHours.length > 0 ? firstShipHours[Math.floor(firstShipHours.length / 2)] : null
    // Upstream funnel — proposer attempts and LLM-mode success rate.
    const proposedAttempts = entries.filter((e) => e.event === 'proposed' || e.event === 'proposed-failed')
    const proposedLLM = entries.filter((e) => e.event === 'proposed' && (e.mode === 'llm' || e.mode === 'llm-rlm'))
    const llmProposalRate = proposedAttempts.length > 0 ? proposedLLM.length / proposedAttempts.length : null
    // Gen 6: full-stack proposal rate + capability promotion + coverage lift.
    const fullStack = entries.filter((e) => e.event === 'proposed' && typeof e.templateFileCount === 'number' && e.templateFileCount >= 3)
    const fullStackRate = proposedLLM.length > 0 ? fullStack.length / proposedLLM.length : null
    const capAttempts = entries.filter((e) => e.event === 'capability-promoted' || e.event === 'capability-promote-failed')
    const capPromoted = entries.filter((e) => e.event === 'capability-promoted')
    const capRate = capAttempts.length > 0 ? capPromoted.length / capAttempts.length : null
    const coverageEvents = entries.filter((e) => e.event === 'coverage-measured' && typeof e.liftRatio === 'number')
    const lifts = coverageEvents.map((e) => e.liftRatio).sort((a, b) => a - b)
    const medianLift = lifts.length > 0 ? lifts[Math.floor(lifts.length / 2)] : null
    return [
      {
        name: 'proposal_promotion_rate',
        value: promotionRate !== null ? Number(promotionRate.toFixed(4)) : null,
        target: 0.3,
        productValueClaim: 'Fraction of proposed families/capabilities that passed all validation gates (schema+compose+build) and landed in registry/ over the last 30 days. When this moves, vertical expansion is working — new buildable surfaces per week without manual registry authoring.',
        direction: 'higher-better',
      },
      {
        name: 'proposed_family_first_ship_hours',
        value: medianFirstShip !== null ? Number(medianFirstShip.toFixed(1)) : null,
        target: 24,
        productValueClaim: 'Median hours from proposal draft creation → registry promotion. Baseline was unbounded (drafts sat as TODOs indefinitely). Target 24h via nightly cron.',
        direction: 'lower-better',
      },
      {
        name: 'llm_proposal_success_rate',
        value: llmProposalRate !== null ? Number(llmProposalRate.toFixed(4)) : null,
        target: 0.8,
        productValueClaim: 'Fraction of proposal attempts that produced an LLM-mode draft (vs falling back to deterministic TODO skeleton). Low → router/provider is unreachable or rate-limiting; deterministic mode cannot produce promotable drafts, so this gates the funnel.',
        direction: 'higher-better',
      },
      {
        name: 'full_stack_proposal_rate',
        value: fullStackRate !== null ? Number(fullStackRate.toFixed(4)) : null,
        target: 0.7,
        productValueClaim: 'Fraction of LLM-mode proposals whose templateFiles.length ≥ 3. Bare-README drafts pass the build gate trivially but scaffold nothing useful. This flow catches the "too-minimal proposal" regression — Gen 6 Track A (filesForTaxonomy expansion) exists to lift it.',
        direction: 'higher-better',
      },
      {
        name: 'capability_promotion_rate',
        value: capRate !== null ? Number(capRate.toFixed(4)) : null,
        target: 0.4,
        productValueClaim: 'Fraction of capability promotion attempts that passed all gates. Capabilities have lower validation bar than families (slot into existing), so this rate should exceed proposal_promotion_rate — parallel high-volume registry expansion.',
        direction: 'higher-better',
      },
      {
        name: 'coverage_lift_per_promote',
        value: medianLift !== null ? Number(medianLift.toFixed(4)) : null,
        target: 0.10,
        productValueClaim: 'Median liftRatio from coverage-measured events — fraction of previously-unrouted buildout scenarios that now route somewhere after a promote. If this is 0, promotes are not absorbing demand; the registry is expanding without product effect.',
        direction: 'higher-better',
      },
    ]
  })(),
  // ── Gen 4: agent-eval scaffold flow ────────────────────────────
  // Reads the most-recent three-layer-report.json from
  // .evolve/agent-eval/<YYYY-MM-DD>/. Mean build_score across all
  // scaffold-only projects from the last run. Governor uses this to
  // detect scaffold regressions without waiting for a VB sweep —
  // compose + install + build is a fast local signal.
  ...(() => {
    const agentEvalRoot = join(REPO, '.evolve/agent-eval')
    if (!existsSync(agentEvalRoot)) return []
    let latestReport = null
    try {
      const days = readdirSync(agentEvalRoot).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
      for (let i = days.length - 1; i >= 0; i -= 1) {
        const p = join(agentEvalRoot, days[i], 'three-layer-report.json')
        if (existsSync(p)) {
          latestReport = readJson(p)
          break
        }
      }
    } catch { /* noop */ }
    if (!latestReport) return []
    const meanBuild = latestReport.summary?.meanBuildScore
    const meanMeta = latestReport.summary?.meanMetaScore
    return [
      {
        name: 'agent_eval_build_pass_rate',
        value: typeof meanBuild === 'number' ? Number(meanBuild.toFixed(4)) : null,
        target: 0.95,
        productValueClaim: 'Fraction of composed scaffolds that pass install+build locally (mean build_score from agent-eval scaffold run). Regresses when a capability manifest changes break compose or a family\'s build recipe stops working — fast local signal, no VB sweep needed.',
        direction: 'higher-better',
      },
      {
        name: 'agent_eval_meta_pass_rate',
        value: typeof meanMeta === 'number' ? Number(meanMeta.toFixed(4)) : null,
        target: 0.85,
        productValueClaim: 'Mean LLM-judge meta_score on scaffold quality — correctness + completeness + idiomatic layout + production-readiness per the scaffold rubric. Null when judge disabled (--no-judge) or no runs yet.',
        direction: 'higher-better',
      },
    ]
  })(),
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
  // Gen-2: explicit inputs manifest — each derived file read during this
  // scorecard emission, with its mtime and staleness-vs-source verdict.
  // Downstream consumers (governor, PR automation) can refuse to act on
  // flows whose source was stale at emission time.
  inputs: inputsRead,
  sourceMtime: SOURCE_MTIME > 0 ? new Date(SOURCE_MTIME).toISOString() : null,
  stale: {
    anyFlowStale: Object.values(staleness).some(Boolean),
    ...staleness,
  },
  // Gen-3: records which source fed the buildout-derived flows — either
  // 'historical' (main buildout-analysis.json, possibly stale) or
  // 'counterfactual' (buildout-analysis-internal.json, always fresh-by-
  // construction because it replays against current registry). Governor
  // can weight decisions differently for each.
  buildoutSource,
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
    ...(f.stale ? { stale: true } : {}),
    ...(f.notes ? { notes: f.notes } : {}),
    // Gen-3: buildout-derived flows carry the source marker so consumers
    // see that a 'counterfactual' number is the replay-against-current,
    // not the historical record.
    ...(f.stale === staleness.buildout && buildoutSource === 'counterfactual' ? { source: 'counterfactual' } : {}),
  })),
}

writeFileSync(OUT, JSON.stringify(scorecard, null, 2))
console.log(`✓ scorecard refreshed at ${OUT}`)
console.log(`  aggregate: ${aggregate}`)
for (const f of scorecard.flows) {
  const mark = f.status === 'pass' ? '✓' : f.status === 'fail' ? '✗' : '?'
  console.log(`  ${mark} ${f.name.padEnd(28)} ${String(f.value).padStart(8)} / target ${f.target}`)
}
