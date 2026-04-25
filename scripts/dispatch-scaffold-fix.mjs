#!/usr/bin/env node
// dispatch-scaffold-fix — Gen 10 closed-loop closure.
//
// Inputs:
//   .evolve/vb-feedback/latest.json   (consumer-feedback attribution)
//   .evolve/scorecard.json             (current state)
//
// Process:
//   1. Pick the top scaffold-attributable cluster with ≥3 failures.
//      Cluster shape: `{family}/{verticalId}` for scaffold-gap or
//      `{verticalId}` for routing-error.
//
//   2. Materialize a representative failed scaffold to a workspace
//      tempdir by re-composing from the original spec (read from
//      consumer's scaffold-compose.json).
//
//   3. Dispatch tcloud-agent with a focused brief: read the scaffold +
//      verification failures + cluster pattern, propose ONE registry
//      change. Output: file edits + brief rationale + criterion gates.
//
//   4. Validate the proposed change end-to-end:
//        - schema (json-schema for the registry artifact)
//        - compose (re-compose against the cluster's failing scenario)
//        - judge fleet (compiler + test + lint + security parallel)
//        - sandbox harness (BuilderSession.ship — 4-gate)
//
//   5. If all gates pass: open PR with structured body. Park on any
//      gate fail with attribution + suggestion.
//
// Hard budget per dispatch: 5 iterations / $1 USD / 10 min wall. Off
// by default; enable via SF_AUTO_DISPATCH=1 or --force.
//
// Usage:
//   node scripts/dispatch-scaffold-fix.mjs                    # picks top cluster
//   node scripts/dispatch-scaffold-fix.mjs --cluster <key>    # specific cluster
//   node scripts/dispatch-scaffold-fix.mjs --dry-run          # show plan, no dispatch

import { readFileSync, existsSync, mkdtempSync, readdirSync, appendFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dispatchAgenticProposal } from './_lib/agentic-proposer.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const FEEDBACK = join(REPO, '.evolve/vb-feedback/latest.json')
const SCORECARD = join(REPO, '.evolve/scorecard.json')
const DISPATCH_LOG = join(REPO, '.evolve/auto-loop.jsonl')

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}

const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')
const CLUSTER_OVERRIDE = arg('cluster')

if (!FORCE && process.env.SF_AUTO_DISPATCH !== '1') {
  console.error('dispatch-scaffold-fix: gated. Set SF_AUTO_DISPATCH=1 or pass --force.')
  console.error('  Reason: this dispatches an LLM agent ($/iter spend). Default off; opt in explicitly.')
  process.exit(2)
}

if (!existsSync(FEEDBACK)) {
  console.error('no consumer feedback — run scripts/consume-vb-feedback.mjs first')
  process.exit(2)
}

const feedback = JSON.parse(readFileSync(FEEDBACK, 'utf8'))

// ── pick the cluster ────────────────────────────────────────────────

function pickCluster() {
  if (CLUSTER_OVERRIDE) return { key: CLUSTER_OVERRIDE, count: 0, kind: 'override' }
  // Combine scaffold-gap + routing-error clusters; pick highest count.
  const candidates = [
    ...Object.entries(feedback.topScaffoldGaps ?? {}).map(([k, n]) => ({ key: k, count: n, kind: 'scaffold-gap' })),
    ...Object.entries(feedback.topRoutingErrors ?? {}).map(([k, n]) => ({ key: k, count: n, kind: 'routing-error' })),
  ]
  candidates.sort((a, b) => b.count - a.count)
  return candidates.find((c) => c.count >= 3) ?? null
}

const cluster = pickCluster()
if (!cluster) {
  console.error('no cluster with ≥3 failures; nothing to dispatch')
  process.exit(2)
}

console.log(`cluster=${cluster.key} count=${cluster.count} kind=${cluster.kind}`)

// ── load representative samples ─────────────────────────────────────

function loadSampleFailures(clusterKey, kind) {
  // Walk the latest detail jsonl for sessions matching the cluster.
  const detailDir = join(REPO, '.evolve/vb-feedback')
  if (!existsSync(detailDir)) return []
  const detailFiles = readdirSync(detailDir)
    .filter((f) => f.endsWith('.jsonl'))
    .sort()
    .slice(-1) // newest
  if (detailFiles.length === 0) return []
  const rows = readFileSync(join(detailDir, detailFiles[0]), 'utf8').trim().split('\n').map((l) => {
    try { return JSON.parse(l) } catch { return null }
  }).filter(Boolean)
  if (kind === 'scaffold-gap') {
    return rows.filter((r) => r.attribution === 'scaffold-gap' && `${r.scaffold?.family ?? 'no-family'}/${r.verticalId}` === clusterKey).slice(0, 3)
  }
  return rows.filter((r) => r.attribution === 'routing-error' && r.verticalId === clusterKey).slice(0, 3)
}

const samples = loadSampleFailures(cluster.key, cluster.kind)
if (samples.length === 0) {
  console.error(`no detail rows match cluster ${cluster.key}`)
  process.exit(2)
}

// ── build agent brief ───────────────────────────────────────────────

function buildBrief(cluster, samples) {
  const sampleLines = samples.map((s, i) => `  Sample ${i + 1}: leafId=${s.leafId} verticalId=${s.verticalId} ` +
    `family=${s.scaffold?.family ?? 'null'} layers=[${(s.scaffold?.layers ?? []).join(',')}] ` +
    `partner=${s.scaffold?.partner ?? 'null'} fileCount=${s.scaffold?.fileCount ?? 0} ` +
    `signals=${s.signals?.join('; ') ?? 'none'}`).join('\n')

  const failurePattern = cluster.kind === 'scaffold-gap'
    ? 'agents extending this scaffold consistently fail at install / typecheck / build on shot 1 — implies the scaffold ships content the agent has to fight'
    : "this consumer's leaves in this vertical route to family=null (no SF family matched) — implies the prompt-planner needs better signals for this vertical"

  return [
    `# starter-foundry registry fix dispatch`,
    ``,
    `**Cluster:** ${cluster.key} (${cluster.count} failures, kind=${cluster.kind})`,
    ``,
    `**Failure pattern:** ${failurePattern}`,
    ``,
    `## Representative failures`,
    sampleLines,
    ``,
    `## Your task`,
    ``,
    `Read the registry under ./registry/ to understand current SF taxonomy. Then propose ONE structural change:`,
    ``,
    `- For scaffold-gap clusters: edit a family or capability manifest + files to ship the missing content. Pick the SMALLEST change that closes the cluster — not a rewrite.`,
    `- For routing-error clusters: edit src/lib/prompt-planner.ts or a registry signals file to teach SF to route this vertical's prompts.`,
    ``,
    `## Output requirements`,
    ``,
    `1. Make the file edits in this workspace (we'll diff-audit them).`,
    `2. Briefly explain in your final message why this fix closes the cluster.`,
    `3. Do NOT add new families or capabilities; this dispatch is for tightening existing ones.`,
    ``,
    `## Validation gates that will run after your changes`,
    ``,
    `- schema validation (registry manifests must match JSON schemas)`,
    `- compose (the cluster's failing leaf prompts must compose successfully)`,
    `- judge fleet (compiler + test + lint + security against the composed scaffold)`,
    `- sandbox harness (install + typecheck + build via BuilderSession)`,
    ``,
    `Budget: 5 iterations, $1 USD, 10 min wall. Pick the change with highest closure-per-edit ratio.`,
  ].join('\n')
}

const brief = buildBrief(cluster, samples)

// ── dry-run exits here ──────────────────────────────────────────────

if (DRY_RUN) {
  console.log('--- BRIEF ---')
  console.log(brief)
  console.log('--- /BRIEF ---')
  process.exit(0)
}

// ── dispatch ────────────────────────────────────────────────────────

const workspaceDir = mkdtempSync(join(tmpdir(), 'sf-dispatch-fix-'))
// Copy the registry into the workspace so the agent can edit it. Keep
// a backup so we can diff after.
spawnSync('cp', ['-R', join(REPO, 'registry'), workspaceDir], { encoding: 'utf8' })
spawnSync('cp', ['-R', join(REPO, 'src/lib/prompt-planner.ts'), workspaceDir], { encoding: 'utf8' })

const candidate = { id: `cluster-${cluster.key.replace(/\W+/g, '-')}` }
const profile = {
  // Match agentic-proposer's existing profile shape (briefly described
  // in scripts/_lib/agentic-proposer.mjs). Kept minimal — the brief
  // carries the actual instruction.
  goal: `Fix the ${cluster.kind} cluster: ${cluster.key}`,
  systemPrompt: 'You are a registry-maintenance agent for starter-foundry. Your job is to make the smallest registry change that closes a cluster of failures. Read first, edit second, explain third.',
}
const criteria = [
  { name: 'edits-made', check: 'agent must produce at least one file edit' },
  { name: 'no-new-families', check: 'agent must not add new family manifests; only tighten existing ones' },
  { name: 'rationale-present', check: 'agent must explain why the edit closes the cluster' },
]
const budget = { iterations: 5, wallSec: 600, usd: 1 }

const startTs = Date.now()
let outcome
try {
  const res = await dispatchAgenticProposal({
    candidate,
    brief,
    profile,
    criteria,
    budget,
    workspaceDir,
    onEvent: (ev) => {
      if (ev.type === 'verdict' || ev.type === 'criterion.check') {
        appendFileSync(DISPATCH_LOG, JSON.stringify({
          ts: new Date().toISOString(), source: 'dispatch-scaffold-fix', event: ev.type, cluster: cluster.key, payload: ev,
        }) + '\n')
      }
    },
  })
  outcome = {
    success: true,
    cluster: cluster.key,
    iterations: res.iterations,
    criterionOutcomes: res.criterionOutcomes,
    wallMs: Date.now() - startTs,
    workspaceDir,
  }
} catch (err) {
  outcome = {
    success: false,
    cluster: cluster.key,
    error: String(err.message ?? err).slice(0, 500),
    wallMs: Date.now() - startTs,
    workspaceDir,
  }
}

// ── persist outcome ─────────────────────────────────────────────────

appendFileSync(DISPATCH_LOG, JSON.stringify({
  ts: new Date().toISOString(),
  source: 'dispatch-scaffold-fix',
  action: 'dispatch-fix',
  cluster: cluster.key,
  outcome,
}) + '\n')

console.log(JSON.stringify(outcome, null, 2))
if (!outcome.success) process.exit(1)
