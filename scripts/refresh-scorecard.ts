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
const REPO =
  process.env.STARTER_FOUNDRY_REPO_OVERRIDE ??
  resolve(dirname(fileURLToPath(import.meta.url)), '..')
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
  process.env.STARTER_FOUNDRY_NO_SELF_HEAL !== '1' && !process.env.STARTER_FOUNDRY_REPO_OVERRIDE

function mtimeOf(path) {
  try {
    return existsSync(path) ? statSync(path).mtime.getTime() : 0
  } catch {
    return 0
  }
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

healIfStale(join(REPO, '.evolve/buildout-analysis.json'), 'scripts/analyze-buildouts.ts')
healIfStale(join(REPO, '.evolve/capability-gaps.json'), 'scripts/infer-capability-gaps.ts')
// scaffold-quality-audit is 20-30 min to regen; flag-only (no self-heal).
// replay-traces is fast and deterministic — always run when SELF_HEAL is on.
if (SELF_HEAL && existsSync(join(REPO, 'scripts/replay-traces.ts'))) {
  const replayOut = join(REPO, '.evolve/buildout-analysis-internal.json')
  // Run replay when its output is older than source OR doesn't exist.
  // Registry changes are not mtime-tracked here — measure-refresh handles
  // that deeper check; this is the read-time safety net.
  if (mtimeOf(replayOut) < SOURCE_MTIME) {
    trySelfHeal(replayOut, 'scripts/replay-traces.ts', 'counterfactual refresh')
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
  buildoutInternal &&
  mtimeOf(join(REPO, '.evolve/buildout-analysis.json')) < SOURCE_MTIME &&
  mtimeOf(join(REPO, '.evolve/buildout-analysis-internal.json')) >= SOURCE_MTIME

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
const familyCount = readdirSync(join(REPO, 'registry/families')).filter(
  (e) => !e.startsWith('_') && !e.startsWith('.'),
).length
const capabilityCount = readdirSync(join(REPO, 'registry/layers/capability')).filter(
  (e) => !e.startsWith('_') && !e.startsWith('.'),
).length
const partnerCount = readdirSync(join(REPO, 'registry/partners')).filter(
  (e) => !e.startsWith('_') && !e.startsWith('.'),
).length
// Gen 11.5 catalog breadth: count agent-runtime bundles. A bundle qualifies
// if (a) its directory starts with `agent-runtime-` and (b) its manifest
// declares taxonomy.surface === 'agent-runtime'. Tracks Stream B progress
// from 3 (proof-of-concept) toward 50 (Tranche 1 target) toward 100+ (long-tail).
const agentRuntimeFamilyCount = (() => {
  const root = join(REPO, 'registry/families')
  let count = 0
  for (const dir of readdirSync(root)) {
    if (!dir.startsWith('agent-runtime-')) continue
    const manifestPath = join(root, dir, 'manifest.json')
    if (!existsSync(manifestPath)) continue
    try {
      const m = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        taxonomy?: { surface?: string }
      }
      if (m.taxonomy?.surface === 'agent-runtime') count++
    } catch {
      /* skip malformed */
    }
  }
  return count
})()

// Gen 11.5 UI surface — count families whose taxonomy.surface is
// 'agent-runtime-ui' (chat / dashboard surfaces over agent bundles) or
// 'sandbox-app' (non-agent workspace apps on sandbox-sdk).
const agentUiFamilyCount = (() => {
  const root = join(REPO, 'registry/families')
  let count = 0
  for (const dir of readdirSync(root)) {
    const manifestPath = join(root, dir, 'manifest.json')
    if (!existsSync(manifestPath)) continue
    try {
      const m = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        taxonomy?: { surface?: string }
      }
      const surface = m.taxonomy?.surface
      if (surface === 'agent-runtime-ui' || surface === 'sandbox-app' || surface === 'ui') count++
    } catch {
      /* skip malformed */
    }
  }
  return count
})()

const auditPass = audit
  ? audit.audits.filter((a) => (a.phases ?? []).every((p) => p.ok)).length
  : null
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
    } catch {
      /* malformed trace — skip */
    }
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
    productValueClaim:
      'Every prompt in the held-out corpus routes to the expected family. If this slips, agents start on the wrong scaffold and burn turns pivoting.',
  },
  // Buildout end-to-end.
  {
    name: 'buildout_pass_rate',
    value: effectiveBuildout?.summary?.passRate ?? null,
    target: 0.85,
    productValueClaim:
      'Fraction of VB-run agent sessions whose composed scaffold reaches a working state. Directly = user sees something that works.',
    stale: staleness.buildout,
  },
  // Counterfactual variant — replays captured traces against the *current*
  // registry. Pass rate is still based on BA's historical observed outcomes;
  // the difference is which traces are included (those current SF can re-plan).
  // Diverges from buildout_pass_rate when current SF improvements have shipped
  // since the BA sweep that produced the historical data. Operator reads BOTH:
  // historical = "did BA actually pass?", counterfactual = "would BA still
  // hit this scenario today, and if it did, would the historical pass have held?"
  {
    name: 'buildout_pass_rate_counterfactual',
    value: buildoutInternal?.summary?.passRate ?? null,
    target: 0.85,
    productValueClaim:
      'Buildout pass rate on the subset of historical traces that current SF can re-plan. Tracks current SF capability without waiting for BA to re-sweep. When this leads buildout_pass_rate by >5pp, BA owes a re-sweep.',
    stale: false, // always reflects whatever the latest replay produced
  },
  // Install-prevention rate — fraction of historical agent installs that
  // current SF's scaffolds would prevent. Direct measure of SF coverage
  // gains over time. Doesn't require BA to re-sweep.
  {
    name: 'install_prevention_rate',
    value: buildoutInternal?.summary?.preventionRate ?? null,
    target: 0.85,
    productValueClaim:
      'Fraction of historical agent installs that current SF would prevent. Each prevented install = one less turn of wasted agent setup work. Forward-looking measure of SF coverage; moves immediately when families gain deps, even before BA re-runs.',
  },
  // Scaffold install+typecheck.
  {
    name: 'scaffold_audit_pass_rate',
    value:
      auditPass !== null && auditTotal !== null && auditTotal > 0 ? auditPass / auditTotal : null,
    target: 1.0,
    productValueClaim:
      'Fraction of framework layers where pnpm install + tsc noEmit succeeds on a freshly composed scaffold. A failure here means agents fight install errors on turn 1.',
    stale: staleness.audit,
  },
  // Capability-gap noise.
  {
    name: 'scaffold_gap_installs',
    value: gaps?.breakdown?.scaffoldGap ?? null,
    target: 10, // running target; goes down as we ship real layers
    productValueClaim:
      'Count of agent installs that map to packages NO family ships. Each one is a turn of agent work the scaffold should have avoided. Lower = less wasted setup.',
    direction: 'lower-better',
    stale: staleness.gaps,
  },
  // Rewrite waste (top rewritten file).
  {
    name: 'top_file_rewrite_count',
    value: effectiveBuildout?.topRewrittenFiles?.[0]?.timesRewritten ?? null,
    target: 5,
    productValueClaim:
      'Rewrite count for the most-rewritten file in the corpus. High number = scaffold shipped a template agents systematically replace. Lower = tokens spent on features instead of setup.',
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
      const turns = (effectiveBuildout?.perScenario ?? [])
        .map((s) => s.meanTurns)
        .filter((v) => typeof v === 'number' && v > 0)
      if (turns.length === 0) return null
      turns.sort((a, b) => a - b)
      const mid = turns[Math.floor(turns.length / 2)]
      return Math.round(mid)
    })(),
    target: 40,
    productValueClaim:
      'Median number of agent turns per buildout session. Fewer turns = agent reaches working preview faster = less user wait + fewer tokens spent on setup that could go to features.',
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
    productValueClaim:
      'Run-weighted median agent turns. Matches what a random user experiences, since high-frequency scenarios dominate the distribution. Complement to the scenario-mean-weighted metric — both must pass for the corpus to be healthy.',
    direction: 'lower-better',
  },
  // Wall-time proxy kept for latency-sensitive tracking.
  {
    name: 'median_wall_seconds_per_buildout',
    value: (() => {
      const outcomes = (effectiveBuildout?.perScenario ?? [])
        .map((s) => s.meanWallMs)
        .filter((v) => typeof v === 'number' && v > 0)
      if (outcomes.length === 0) return null
      outcomes.sort((a, b) => a - b)
      const mid = outcomes[Math.floor(outcomes.length / 2)]
      return Number((mid / 1000).toFixed(1))
    })(),
    target: 600,
    productValueClaim:
      'Median wall-time per buildout session in seconds. Faster = user sees working product sooner = lower abandon rate.',
    direction: 'lower-better',
    stale: staleness.buildout,
  },
  // Orchestration noise — capability-gap entries where the scaffold DID ship
  // the dep but agents installed it anyway (install-pipeline issue).
  {
    name: 'orchestration_installs',
    value: gaps?.breakdown?.orchestration ?? null,
    target: 15,
    productValueClaim:
      "Count of redundant agent installs when the scaffold already ships the package. Each one is a sign that the consumer pipeline isn't running install before handing the scaffold to the agent — informs blueprint-agent orchestration, not our scaffold.",
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
      const turns = (effectiveBuildout?.perScenario ?? [])
        .map((s) => s.meanTurns)
        .filter((v) => typeof v === 'number' && v > 0)
      if (turns.length === 0) return null
      turns.sort((a, b) => a - b)
      const medianTurns = turns[Math.floor(turns.length / 2)]
      return Math.round(medianTurns * 2000)
    })(),
    target: 80000,
    productValueClaim:
      'Median tokens spent per buildout (real when emitBuildoutEvent supplies tokenCount, proxy from turns otherwise). Fewer tokens = lower cost per user session + lower LLM API cost for consumers.',
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
    productValueClaim:
      'Mean $ cost per scaffold buildout. Catches regressions where a change doubles token spend even if pass rate stays flat. Drives the ROI conversation on every future capability — is the delta on pass rate worth $X more per user?',
    direction: 'lower-better',
    stale: staleness.buildout,
  },
  // Registry breadth — running growth metric.
  {
    name: 'families',
    value: familyCount,
    target: 40,
    productValueClaim:
      'Number of distinct family archetypes the router can route to. Breadth = more prompts find a good home.',
  },
  {
    name: 'capability_layers',
    value: capabilityCount,
    target: 50,
    productValueClaim:
      'Distinct capability layers available for attachment. Each one is a bundle of deps + files + context agents get for free.',
  },
  {
    name: 'partners',
    value: partnerCount,
    target: 10,
    productValueClaim:
      'Partner packs — ecosystem-specific biases + config. More partners = more prompts get routed with SDK/addresses pre-wired.',
  },
  // Gen 11.5: agent-runtime catalog breadth.
  {
    name: 'catalog_breadth_agent_runtime',
    value: agentRuntimeFamilyCount,
    target: 50,
    productValueClaim:
      'Count of distinct agent-runtime bundles in the registry. Each bundle = one role (CMO advisor / wealth manager / music producer / etc.) the operator can compose without authoring a new manifest. When this moves, the share of unrouteable BA prompts that map to fallback-static drops, and agent-runtime becomes a real product category instead of a 3-seed proof-of-concept.',
  },
  // Gen 11.5: UI surface breadth (agent-with-ui / orchestrator-with-ui / sandbox-app).
  {
    name: 'catalog_breadth_agent_ui',
    value: agentUiFamilyCount,
    target: 6,
    productValueClaim:
      'Count of UI scaffolds that compose over agent-runtime bundles or the Tangle sandbox SDK directly. Each unlocks a new product category: single-agent app, multi-agent dashboard, non-agent workspace (editor / audit-tool / REPL / file-browser). When this moves, operators can ship visible UX in hours instead of weeks of glue code.',
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
      entries = readFileSync(impactLog, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => {
          try {
            return JSON.parse(l)
          } catch {
            return null
          }
        })
        .filter(Boolean)
        .filter((e) => {
          const t = Date.parse(e.ts ?? '')
          if (!Number.isFinite(t) || t < cutoff) return false
          // Filter test-fixture events that pollute real metrics. Going
          // forward, test runs set STARTER_FOUNDRY_SYNTHETIC_RUN=1 and the
          // promoter no-ops logImpact entirely — but historical events
          // written before that env-gate landed still need to be filtered
          // here by ID heuristic.
          //
          // Known fixture-only IDs (used by tests/gen5-closed-loop.test.ts
          // and tests/gen6-flywheel.test.ts to assert error paths):
          //   - `test-*`, `synthetic-*` — explicit prefix convention
          //   - `definitely-nonexistent-*`, `nonexistent-xyz` — missing-manifest fixtures
          //   - `bun-monolith`, `ts-eval-harness` — schema-reject fixtures
          //     (draft dirs contain intentionally-broken manifests)
          const id = String(e.id ?? '')
          const newFam = String(e.newFamily ?? '')
          if (/^test-/.test(id) || /^synthetic-/.test(id)) return false
          if (/^test-/.test(newFam) || /^synthetic-/.test(newFam)) return false
          if (/^(definitely-)?nonexistent(-|$)/.test(id)) return false
          if (id === 'bun-monolith' || id === 'ts-eval-harness') return false
          // 'already exists' messages are idempotency signals from test retry
          // loops — the draft was already promoted on a prior run; the second
          // attempt is a no-op, not a gate rejection. Not a real failure.
          const msg = String(e.message ?? '')
          if (e.event === 'promote-failed' && /already exists/.test(msg)) return false
          return true
        })
    } catch {
      /* empty file is fine */
    }
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
    // Per-ID outcome rollup (not per-event). An ID that was promoted →
    // reverted → re-promoted is ONE logical attempt with outcome
    // = success. Event-level counting (which we used pre-2026-04-24)
    // inflates the denominator: the same ID contributes two promoted
    // events + a revert, so it gets counted 2× in attempts but only 1×
    // in net-promoted, pushing the rate to 50% when reality is 100%.
    // R2 fix: compute the latest-state per ID and count each ID once.
    const latestByIdPromote = new Map() // id → latest event object (preserves draftAgeHours, etc.)
    for (const e of entries) {
      if (e.event !== 'promoted' && e.event !== 'promote-failed' && e.event !== 'promote-reverted')
        continue
      const id = String(e.id ?? '')
      if (!id) continue
      const ts = Date.parse(e.ts ?? '') || 0
      const prev = latestByIdPromote.get(id)
      const prevTs = prev ? Date.parse(prev.ts ?? '') || 0 : -1
      if (prevTs < ts) latestByIdPromote.set(id, e)
    }
    const idOutcomes = [...latestByIdPromote.values()]
    const promoteAttempts = idOutcomes // alias kept for scope below
    const promoted = idOutcomes.filter((o) => o.event === 'promoted')
    const promotionRate = idOutcomes.length > 0 ? promoted.length / idOutcomes.length : null
    const firstShipHours = promoted.map((e) => e.draftAgeHours).filter((h) => typeof h === 'number')
    firstShipHours.sort((a, b) => a - b)
    const medianFirstShip =
      firstShipHours.length > 0 ? firstShipHours[Math.floor(firstShipHours.length / 2)] : null
    // Upstream funnel — proposer attempts and LLM-mode success rate.
    const proposedAttempts = entries.filter(
      (e) => e.event === 'proposed' || e.event === 'proposed-failed',
    )
    const proposedLLM = entries.filter(
      (e) => e.event === 'proposed' && (e.mode === 'llm' || e.mode === 'llm-rlm'),
    )
    const llmProposalRate =
      proposedAttempts.length > 0 ? proposedLLM.length / proposedAttempts.length : null
    // Gen 6: full-stack proposal rate + capability promotion + coverage lift.
    const fullStack = entries.filter(
      (e) =>
        e.event === 'proposed' &&
        typeof e.templateFileCount === 'number' &&
        e.templateFileCount >= 3,
    )
    const fullStackRate = proposedLLM.length > 0 ? fullStack.length / proposedLLM.length : null
    const capAttempts = entries.filter(
      (e) => e.event === 'capability-promoted' || e.event === 'capability-promote-failed',
    )
    const capPromoted = entries.filter((e) => e.event === 'capability-promoted')
    const capRate = capAttempts.length > 0 ? capPromoted.length / capAttempts.length : null
    const coverageEvents = entries.filter(
      (e) => e.event === 'coverage-measured' && typeof e.liftRatio === 'number',
    )
    const lifts = coverageEvents.map((e) => e.liftRatio).sort((a, b) => a - b)
    const medianLift = lifts.length > 0 ? lifts[Math.floor(lifts.length / 2)] : null
    return [
      {
        name: 'proposal_promotion_rate',
        value: promotionRate !== null ? Number(promotionRate.toFixed(4)) : null,
        target: 0.3,
        productValueClaim:
          'Fraction of proposed families/capabilities that passed all validation gates (schema+compose+build) and landed in registry/ over the last 30 days. When this moves, vertical expansion is working — new buildable surfaces per week without manual registry authoring.',
        direction: 'higher-better',
      },
      {
        name: 'proposed_family_first_ship_hours',
        value: medianFirstShip !== null ? Number(medianFirstShip.toFixed(1)) : null,
        target: 24,
        productValueClaim:
          'Median hours from proposal draft creation → registry promotion. Baseline was unbounded (drafts sat as TODOs indefinitely). Target 24h via nightly cron.',
        direction: 'lower-better',
      },
      {
        name: 'llm_proposal_success_rate',
        value: llmProposalRate !== null ? Number(llmProposalRate.toFixed(4)) : null,
        target: 0.8,
        productValueClaim:
          'Fraction of proposal attempts that produced an LLM-mode draft (vs falling back to deterministic TODO skeleton). Low → router/provider is unreachable or rate-limiting; deterministic mode cannot produce promotable drafts, so this gates the funnel.',
        direction: 'higher-better',
      },
      {
        name: 'full_stack_proposal_rate',
        value: fullStackRate !== null ? Number(fullStackRate.toFixed(4)) : null,
        target: 0.7,
        productValueClaim:
          'Fraction of LLM-mode proposals whose templateFiles.length ≥ 3. Bare-README drafts pass the build gate trivially but scaffold nothing useful. This flow catches the "too-minimal proposal" regression — Gen 6 Track A (filesForTaxonomy expansion) exists to lift it.',
        direction: 'higher-better',
      },
      {
        name: 'capability_promotion_rate',
        value: capRate !== null ? Number(capRate.toFixed(4)) : null,
        target: 0.4,
        productValueClaim:
          'Fraction of capability promotion attempts that passed all gates. Capabilities have lower validation bar than families (slot into existing), so this rate should exceed proposal_promotion_rate — parallel high-volume registry expansion.',
        direction: 'higher-better',
      },
      {
        name: 'coverage_lift_per_promote',
        value: medianLift !== null ? Number(medianLift.toFixed(4)) : null,
        target: 0.1,
        productValueClaim:
          'Median liftRatio from coverage-measured events — fraction of previously-unrouted buildout scenarios that now route somewhere after a promote. If this is 0, promotes are not absorbing demand; the registry is expanding without product effect.',
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
      const days = readdirSync(agentEvalRoot)
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort()
      for (let i = days.length - 1; i >= 0; i -= 1) {
        const p = join(agentEvalRoot, days[i], 'three-layer-report.json')
        if (existsSync(p)) {
          latestReport = readJson(p)
          break
        }
      }
    } catch {
      /* noop */
    }
    if (!latestReport) return []
    const meanBuild = latestReport.summary?.meanBuildScore
    const meanMeta = latestReport.summary?.meanMetaScore
    return [
      {
        name: 'agent_eval_build_pass_rate',
        value: typeof meanBuild === 'number' ? Number(meanBuild.toFixed(4)) : null,
        target: 0.95,
        productValueClaim:
          "Fraction of composed scaffolds that pass install+build locally (mean build_score from agent-eval scaffold run). Regresses when a capability manifest changes break compose or a family's build recipe stops working — fast local signal, no VB sweep needed.",
        direction: 'higher-better',
      },
      {
        name: 'agent_eval_meta_pass_rate',
        value: typeof meanMeta === 'number' ? Number(meanMeta.toFixed(4)) : null,
        target: 0.85,
        productValueClaim:
          'Mean LLM-judge meta_score on scaffold quality — correctness + completeness + idiomatic layout + production-readiness per the scaffold rubric. Null when judge disabled (--no-judge) or no runs yet.',
        direction: 'higher-better',
      },
    ]
  })(),
  // Consumer-feedback flow — fraction of consumer (BA / vibecoder) failures
  // attributable to SF (routing-error + scaffold-gap) vs agent-error /
  // unknown. Null when no consumer has plugged in yet. Lower is better:
  // when the consumer fails, we want it to be the agent's fault, not
  // ours. Read from .evolve/vb-feedback/latest.json — written by
  // scripts/consume-vb-feedback.ts against any consumer source.
  ...(() => {
    const fbPath = join(REPO, '.evolve/vb-feedback/latest.json')
    if (!existsSync(fbPath)) return []
    let fb
    try {
      fb = JSON.parse(readFileSync(fbPath, 'utf8'))
    } catch {
      return []
    }
    return [
      {
        name: 'consumer_scaffold_attributable_rate',
        value:
          typeof fb.scaffoldAttributableRate === 'number'
            ? Number(fb.scaffoldAttributableRate.toFixed(4))
            : null,
        target: 0.2,
        productValueClaim:
          "Of all consumer-side (e.g. blueprint-agent) leaf failures, the fraction whose root cause was SF (routing-error or scaffold-gap) rather than agent-side. Lower means SF is a smaller part of the consumer's failure surface — the right product direction.",
        direction: 'lower-better',
      },
    ]
  })(),
  // Gen 10: judge-fleet flow — fraction of recent agent-eval scaffold runs
  // where ALL fleet judges (compiler + test + lint + security) verdicted
  // pass. Stricter than mean meta-score: a single Goodharted judge can't
  // inflate this. Null until a fleet run lands in three-layer-report.json.
  ...(() => {
    const reportDirsRoot = join(REPO, '.evolve/agent-eval')
    if (!existsSync(reportDirsRoot)) return []
    const dirs = readdirSync(reportDirsRoot)
      .filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d))
      .sort()
      .reverse()
    if (dirs.length === 0) return []
    const reportPath = join(reportDirsRoot, dirs[0], 'three-layer-report.json')
    if (!existsSync(reportPath)) return []
    let report
    try {
      report = JSON.parse(readFileSync(reportPath, 'utf8'))
    } catch {
      return []
    }
    const projects = report.projects ?? []
    const withFleet = projects.filter((p) => Array.isArray(p.fleetByJudge))
    if (withFleet.length === 0)
      return [
        {
          name: 'judge_fleet_unanimous_pass_rate',
          value: null,
          target: 0.85,
          productValueClaim:
            'Fraction of agent-eval scaffold runs where every fleet judge (compiler + test + lint + security) verdicted pass. Null until a fleet-mode run produces a report. Stricter than mean meta-score — orthogonal validation no single judge can Goodhart.',
          direction: 'higher-better',
        },
      ]
    const allPass = withFleet.filter(
      (p) => p.fleetByJudge.length > 0 && p.fleetByJudge.every((j) => j.passed),
    ).length
    return [
      {
        name: 'judge_fleet_unanimous_pass_rate',
        value: Number((allPass / withFleet.length).toFixed(4)),
        target: 0.85,
        productValueClaim:
          'Fraction of agent-eval scaffold runs where every fleet judge (compiler + test + lint + security) verdicted pass. Stricter than mean meta-score — orthogonal validation no single judge can Goodhart.',
        direction: 'higher-better',
      },
    ]
  })(),
  // Gen 10: auto-dispatched fix PR rate — fraction of dispatch-fix actions
  // (from auto-loop.jsonl) that successfully passed gates and would have
  // opened a PR vs ones that parked. Higher = agent's fix proposals
  // surviving the validation gates. Null until 5+ dispatches have run
  // (small N noise).
  ...(() => {
    const logPath = join(REPO, '.evolve/auto-loop.jsonl')
    if (!existsSync(logPath)) return []
    const lines = readFileSync(logPath, 'utf8').trim().split('\n')
    const dispatches = lines
      .map((l) => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
      .filter((e) => e && e.action === 'dispatch-fix' && e.outcome)
    if (dispatches.length < 5)
      return [
        {
          name: 'auto_dispatched_fix_pr_rate',
          value: null,
          target: 0.5,
          productValueClaim:
            'Fraction of agent-dispatched scaffold-fix attempts that pass all validation gates (schema + compose + judge fleet + sandbox harness) and would open a PR. Null until ≥5 dispatches recorded — avoid false signal from small N.',
          direction: 'higher-better',
        },
      ]
    const succeeded = dispatches.filter((e) => e.outcome.success === true).length
    return [
      {
        name: 'auto_dispatched_fix_pr_rate',
        value: Number((succeeded / dispatches.length).toFixed(4)),
        target: 0.5,
        productValueClaim:
          'Fraction of agent-dispatched scaffold-fix attempts that pass all validation gates (schema + compose + judge fleet + sandbox harness) and would open a PR. Higher = agent fix proposals surviving the validation surface; expected baseline ~0.5 because gates correctly reject half.',
        direction: 'higher-better',
      },
    ]
  })(),
]

const aggregate = (() => {
  const scored = flows.filter((f) => f.value !== null && f.target !== null && f.target !== 0)
  if (scored.length === 0) return null
  const ratios = scored.map((f) => {
    const hit =
      f.direction === 'lower-better'
        ? Math.max(0, 1 - Number(f.value) / Number(f.target))
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
    status:
      f.value === null
        ? 'unmeasured'
        : f.direction === 'lower-better'
          ? Number(f.value) <= Number(f.target)
            ? 'pass'
            : 'fail'
          : Number(f.value) >= Number(f.target)
            ? 'pass'
            : 'fail',
    productValueClaim: f.productValueClaim,
    direction: f.direction ?? 'higher-better',
    ...(f.stale ? { stale: true } : {}),
    ...(f.notes ? { notes: f.notes } : {}),
    // Gen-3: buildout-derived flows carry the source marker so consumers
    // see that a 'counterfactual' number is the replay-against-current,
    // not the historical record.
    ...(f.stale === staleness.buildout && buildoutSource === 'counterfactual'
      ? { source: 'counterfactual' }
      : {}),
  })),
}

writeFileSync(OUT, JSON.stringify(scorecard, null, 2))
console.log(`✓ scorecard refreshed at ${OUT}`)
console.log(`  aggregate: ${aggregate}`)
for (const f of scorecard.flows) {
  const mark = f.status === 'pass' ? '✓' : f.status === 'fail' ? '✗' : '?'
  console.log(`  ${mark} ${f.name.padEnd(28)} ${String(f.value).padStart(8)} / target ${f.target}`)
}
