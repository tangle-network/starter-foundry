#!/usr/bin/env node
// auto-loop — headless governor. One iteration per invocation.
//
// Reads .evolve/scorecard.json + .evolve/governor.jsonl tail, picks ONE
// action, logs the decision + outcome, exits. Cron-friendly: run on a
// schedule; each run makes at most one change OR surfaces a clear
// "needs-operator" reason.
//
// Actions it can take autonomously:
//   - refresh-scorecard       (always safe; reruns the measurement derivation)
//   - probe-red-flow          (greps local traces for new signal on a RED flow)
//   - probe-vb-feedback       (reads consumer's VB output, attributes failures
//                              to scaffold-side vs agent-side — see
//                              scripts/consume-vb-feedback.mjs)
//   - dispatch-fix            (Gen 10: agent dispatch against top SF-attributable
//                              cluster — gated on SF_AUTO_DISPATCH=1, rate-limited
//                              to once per hour, hard $/iter/wall budget)
//   - park                    (no new signal; write a parked record, exit)
//
// Actions it NEVER takes (needs operator):
//   - schema/code changes, PR creation, LLM calls with spend
//
// Extend by adding a case to decide() + implementing the handler.

import { readFileSync, existsSync, appendFileSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const LOG = join(REPO, '.evolve/auto-loop.jsonl')
const SCORECARD = join(REPO, '.evolve/scorecard.json')
const GOVERNOR_LOG = join(REPO, '.evolve/governor.jsonl')
const BUILDOUTS = join(REPO, '.evolve/traces/buildouts.jsonl')
const VB_FEEDBACK_LATEST = join(REPO, '.evolve/vb-feedback/latest.json')
// Default consumer source. Override at runtime if other consumers
// expose verticalbench-shaped output. The contract is the directory
// shape, not the path.
const VB_DEFAULT_SOURCE = process.env.VB_FEEDBACK_SOURCE
  ?? join(REPO, '../blueprint-agent/scripts/experiments/results/sessions')
const VB_DEFAULT_CONSUMER = process.env.VB_FEEDBACK_CONSUMER ?? 'blueprint-agent'

function emit(entry) {
  appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n')
}

function readScorecard() {
  if (!existsSync(SCORECARD)) return null
  return JSON.parse(readFileSync(SCORECARD, 'utf8'))
}

function redFlows(card) {
  if (!card) return []
  return card.flows.filter((f) => {
    if (f.value == null) return false
    const dir = f.direction ?? 'higher-better'
    return dir === 'higher-better' ? f.value < f.target : f.value > f.target
  })
}

function lastGovernorDecisions(n = 5) {
  if (!existsSync(GOVERNOR_LOG)) return []
  const lines = readFileSync(GOVERNOR_LOG, 'utf8').trim().split('\n').slice(-n)
  return lines.map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
}

function scorecardStale() {
  if (!existsSync(SCORECARD)) return true
  const card = readScorecard()
  const stale = card?.stale
  if (!stale) return false
  return Boolean(stale.anyFlowStale || stale.buildout || stale.gaps || stale.audit)
}

function buildoutsAgeHours() {
  if (!existsSync(BUILDOUTS)) return Infinity
  const m = statSync(BUILDOUTS).mtimeMs
  return (Date.now() - m) / 3_600_000
}

// ── decide what to do ────────────────────────────────────────────────

function decide() {
  const card = readScorecard()
  const reds = redFlows(card)
  const recent = lastGovernorDecisions(5)
  const recentDecisions = recent.map((d) => d.decision).filter(Boolean)

  if (scorecardStale()) {
    return { action: 'refresh-scorecard', reason: 'scorecard has anyFlowStale=true' }
  }

  if (!card || card.flows.length === 0) {
    return { action: 'park', reason: 'no scorecard yet — needs operator to bootstrap measurement' }
  }

  if (reds.length === 0) {
    return { action: 'park', reason: 'all flows green — converged' }
  }

  const ageH = buildoutsAgeHours()
  if (ageH > 48) {
    return {
      action: 'park',
      reason: `buildout data ${ageH.toFixed(1)}h stale — RED flows ${reds.map((f) => f.name).join(',')} need fresh VB sweep, not another round against stale data`,
      needsOperator: true,
    }
  }

  const recentStops = recentDecisions.filter((d) => d === 'park' || d === 'SURFACE').length
  if (recentStops >= 3) {
    return {
      action: 'park',
      reason: `last 5 decisions include ${recentStops} stops — loop is correctly identifying "wait for data"`,
      needsOperator: false,
    }
  }

  // VB feedback freshness check: if the consumer's session dir exists
  // and has new data since the last probe, surface it. This is the
  // "augment any vibecoder consumer" path.
  if (existsSync(VB_DEFAULT_SOURCE)) {
    const lastProbe = existsSync(VB_FEEDBACK_LATEST)
      ? statSync(VB_FEEDBACK_LATEST).mtimeMs
      : 0
    const sourceM = statSync(VB_DEFAULT_SOURCE).mtimeMs
    if (sourceM > lastProbe) {
      return {
        action: 'probe-vb-feedback',
        reason: `consumer ${VB_DEFAULT_CONSUMER} has new sessions (mtime ${new Date(sourceM).toISOString().slice(0, 19)} > last probe)`,
        target: VB_DEFAULT_CONSUMER,
      }
    }
  }

  // Gen 10: dispatch-fix — agent-driven cluster fix. Conditions: opt-in
  // env, fresh consumer feedback exists, SF-attributable rate above
  // target, ≥1 cluster has ≥3 failures, and at least 1 hour since last
  // dispatch (rate-limit). Defaults default-off because each dispatch
  // spends LLM budget; operator opts in explicitly.
  const dispatchAllowed = process.env.SF_AUTO_DISPATCH === '1'
  if (dispatchAllowed && existsSync(VB_FEEDBACK_LATEST)) {
    const fb = (() => {
      try { return JSON.parse(readFileSync(VB_FEEDBACK_LATEST, 'utf8')) } catch { return null }
    })()
    if (fb && typeof fb.scaffoldAttributableRate === 'number') {
      const targetFlow = card?.flows?.find((f) => f.name === 'consumer_scaffold_attributable_rate')
      const target = targetFlow?.target ?? 0.20
      const above = fb.scaffoldAttributableRate > target
      const clusters = [
        ...Object.entries(fb.topScaffoldGaps ?? {}),
        ...Object.entries(fb.topRoutingErrors ?? {}),
      ]
      const topClusterCount = clusters.length > 0 ? Math.max(...clusters.map(([, n]) => Number(n))) : 0
      const lastDispatch = lastDispatchTs()
      const hoursSinceLast = (Date.now() - lastDispatch) / 3_600_000
      if (above && topClusterCount >= 3 && hoursSinceLast >= 1) {
        return {
          action: 'dispatch-fix',
          reason: `attributable=${(fb.scaffoldAttributableRate * 100).toFixed(1)}% > ${(target * 100).toFixed(0)}%, top cluster has ${topClusterCount} failures, ${hoursSinceLast.toFixed(1)}h since last dispatch`,
          target: 'top-cluster',
        }
      }
    }
  }

  return {
    action: 'probe-red-flow',
    reason: `${reds.length} RED flows, fresh data (${ageH.toFixed(1)}h)`,
    target: reds[0].name,
  }
}

function lastDispatchTs() {
  if (!existsSync(LOG)) return 0
  const lines = readFileSync(LOG, 'utf8').trim().split('\n').slice(-50)
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const e = JSON.parse(lines[i])
      if (e.action === 'dispatch-fix') return Date.parse(e.ts) || 0
    } catch { /* skip */ }
  }
  return 0
}

// ── actions ──────────────────────────────────────────────────────────

function refreshScorecard() {
  try {
    const out = execSync('node scripts/refresh-scorecard.mjs', { cwd: REPO, encoding: 'utf8', timeout: 60_000 })
    const card = readScorecard()
    return {
      success: true,
      aggregate: card?.aggregate,
      redCount: redFlows(card).length,
      lastLine: out.trim().split('\n').pop(),
    }
  } catch (err) {
    return { success: false, error: String(err.message ?? err).slice(0, 500) }
  }
}

function probeRedFlow(flowName) {
  // Minimal: count failure events for the relevant metric in buildouts.jsonl.
  // Doesn't fix anything; surfaces structured signal for the operator or
  // next loop iteration.
  if (!existsSync(BUILDOUTS)) return { success: false, reason: 'no buildouts.jsonl' }
  const lines = readFileSync(BUILDOUTS, 'utf8').trim().split('\n')
  const parsed = lines.map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  const withOutcome = parsed.filter((e) => e.outcome && e.outcome.allPass != null)
  const failing = withOutcome.filter((e) => !e.outcome.allPass)
  const clusters = {}
  for (const f of failing) {
    const key = `${f.scenarioId}/${f.partnerGuess ?? ''}`
    clusters[key] = (clusters[key] ?? 0) + 1
  }
  const top = Object.entries(clusters).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return {
    success: true,
    flow: flowName,
    totalFailing: failing.length,
    topClusters: top.map(([k, n]) => ({ scenario: k, count: n })),
  }
}

function dispatchFix() {
  // Gate: only proceed when opt-in env is set. The decide() guard
  // already checks this; defense in depth.
  if (process.env.SF_AUTO_DISPATCH !== '1') {
    return { success: false, error: 'SF_AUTO_DISPATCH not set; refusing to spend LLM budget without explicit opt-in' }
  }
  try {
    const out = execSync('node scripts/dispatch-scaffold-fix.mjs', {
      cwd: REPO,
      encoding: 'utf8',
      timeout: 11 * 60_000, // dispatch budget is 10min wall; +1min slack
      env: { ...process.env, SF_AUTO_DISPATCH: '1' },
    })
    // Last line is JSON outcome from dispatch-scaffold-fix.
    const lastJson = out.trim().split('\n').reverse().find((l) => l.startsWith('{')) ?? '{}'
    const outcome = JSON.parse(lastJson)
    return { success: outcome.success === true, ...outcome }
  } catch (err) {
    return { success: false, error: String(err.message ?? err).slice(0, 500) }
  }
}

function probeVbFeedback() {
  // Delegate to consume-vb-feedback.mjs; capture stdout summary line +
  // read the resulting latest.json for structured output.
  try {
    const out = execSync(
      `node scripts/consume-vb-feedback.mjs --source "${VB_DEFAULT_SOURCE}" --consumer "${VB_DEFAULT_CONSUMER}" --quiet`,
      { cwd: REPO, encoding: 'utf8', timeout: 60_000 },
    )
    const summary = existsSync(VB_FEEDBACK_LATEST)
      ? JSON.parse(readFileSync(VB_FEEDBACK_LATEST, 'utf8'))
      : null
    return {
      success: true,
      summaryLine: out.trim().split('\n').pop(),
      buckets: summary?.buckets,
      scaffoldAttributableRate: summary?.scaffoldAttributableRate,
      topRoutingErrors: summary?.topRoutingErrors,
      topScaffoldGaps: summary?.topScaffoldGaps,
    }
  } catch (err) {
    return { success: false, error: String(err.message ?? err).slice(0, 500) }
  }
}

// ── main ─────────────────────────────────────────────────────────────

async function main() {
  const decision = decide()
  const entry = { ...decision }

  if (decision.action === 'refresh-scorecard') {
    entry.outcome = refreshScorecard()
  } else if (decision.action === 'probe-red-flow') {
    entry.outcome = probeRedFlow(decision.target)
  } else if (decision.action === 'probe-vb-feedback') {
    entry.outcome = probeVbFeedback()
  } else if (decision.action === 'dispatch-fix') {
    entry.outcome = dispatchFix()
  } else if (decision.action === 'park') {
    entry.outcome = { success: true, parked: true }
  }

  emit(entry)
  // Print a one-line summary so cron logs are useful.
  const summary = [
    `action=${decision.action}`,
    `reason="${decision.reason}"`,
    decision.target ? `target=${decision.target}` : null,
    entry.outcome?.success === false ? `error=${entry.outcome.error}` : null,
    entry.outcome?.redCount != null ? `red=${entry.outcome.redCount}` : null,
    entry.outcome?.totalFailing != null ? `failing=${entry.outcome.totalFailing}` : null,
    entry.outcome?.scaffoldAttributableRate != null
      ? `sfAttribRate=${(entry.outcome.scaffoldAttributableRate * 100).toFixed(1)}%`
      : null,
  ].filter(Boolean).join(' ')
  console.log(summary)
  if (decision.needsOperator) process.exit(2)
}

main().catch((err) => {
  emit({ action: 'error', error: String(err?.message ?? err).slice(0, 500) })
  console.error('auto-loop error:', err.message ?? err)
  process.exit(1)
})
