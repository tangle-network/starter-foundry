#!/usr/bin/env node
// auto-loop — headless governor. One iteration per invocation.
//
// Reads .evolve/scorecard.json + .evolve/governor.jsonl tail, picks ONE
// action, logs the decision + outcome, exits. Cron-friendly: run on a
// schedule; each run makes at most one change OR surfaces a clear
// "needs-operator" reason.
//
// Actions it can take autonomously (no LLM required):
//   - refresh-scorecard (always safe; reruns the measurement derivation)
//   - probe-red-flow   (greps local traces for new signal on a RED flow)
//   - park             (no new signal; write a parked record, exit)
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

  return {
    action: 'probe-red-flow',
    reason: `${reds.length} RED flows, fresh data (${ageH.toFixed(1)}h)`,
    target: reds[0].name,
  }
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

// ── main ─────────────────────────────────────────────────────────────

async function main() {
  const decision = decide()
  const entry = { ...decision }

  if (decision.action === 'refresh-scorecard') {
    entry.outcome = refreshScorecard()
  } else if (decision.action === 'probe-red-flow') {
    entry.outcome = probeRedFlow(decision.target)
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
  ].filter(Boolean).join(' ')
  console.log(summary)
  if (decision.needsOperator) process.exit(2)
}

main().catch((err) => {
  emit({ action: 'error', error: String(err?.message ?? err).slice(0, 500) })
  console.error('auto-loop error:', err.message ?? err)
  process.exit(1)
})
