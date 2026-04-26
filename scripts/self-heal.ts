#!/usr/bin/env node
// End-to-end self-heal loop:
//
//   replay-traces  → buildout-analysis-internal.json
//   diagnoser      → ranked proposals per gap cluster   (ax signature, tangle-router)
//   propose        → kimi-for-coding bridge sessions    (tcloud @ router.tangle.tools)
//                     agent edits manifest + verifies + opens PR
//
// Zero external dependencies (no VB sweep, no human-as-harness). Closed
// loop from captured trace corpus → merged PR.
//
// Usage:
//   node scripts/self-heal.ts                         # dry-run (prints proposals, no dispatch)
//   node scripts/self-heal.ts --dispatch              # actually spawn Kimi sessions
//   node scripts/self-heal.ts --top 1 --dispatch      # only dispatch the single highest-impact proposal
//   node scripts/self-heal.ts --min-impact 3          # skip low-impact clusters

import fs from 'node:fs/promises'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)

function parseArgs(argv) {
  const a = { dispatch: false, top: Infinity, minImpact: 2, minConfidence: 0.5 }
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i]
    if (v === '--dispatch') a.dispatch = true
    else if (v === '--top') a.top = Number(argv[++i])
    else if (v === '--min-impact') a.minImpact = Number(argv[++i])
    else if (v === '--min-confidence') a.minConfidence = Number(argv[++i])
  }
  return a
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { loadTraces, replayTrace, buildReport } = await import(path.join(ROOT, 'dist', 'eval', 'replay.js'))
  const { diagnoseGaps } = await import(path.join(ROOT, 'dist', 'eval', 'diagnoser.js'))
  const { proposeEdit } = await import(path.join(ROOT, 'dist', 'eval', 'propose.js'))
  const { loadRegistry } = await import(path.join(ROOT, 'dist', 'lib', 'registry.js'))

  const commit = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim()

  // 1) replay
  process.stdout.write(`[1/3] replay against registry @ ${commit}\n`)
  const traces = await loadTraces(path.join(ROOT, '.evolve', 'traces'))
  const results = []
  for (const t of traces) {
    try { results.push(await replayTrace(t)) } catch {}
  }
  const report = buildReport(results, commit)
  const reportPath = path.join(ROOT, '.evolve', 'buildout-analysis-internal.json')
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
  const s = report.summary
  process.stdout.write(`      ${s.totalPreventedInstalls}/${s.totalHistoricalInstalls} prevented (${(s.preventionRate * 100).toFixed(1)}%)  remaining: ${s.totalRemainingGapInstalls}\n\n`)

  // 2) diagnose
  process.stdout.write(`[2/3] diagnose remaining gaps\n`)
  const registry = await loadRegistry()
  const existingCapabilities = [...registry.layers.values()]
    .filter((l) => l.group === 'capability')
    .map((l) => `capability:${l.id}`)
  const { isLLMAvailable } = await import(path.join(ROOT, 'dist', 'lib', 'llm.js'))
  const { clusterGaps } = await import(path.join(ROOT, 'dist', 'eval', 'diagnoser.js'))
  let proposals = []
  if (!isLLMAvailable()) {
    process.stdout.write(`      no LLM provider configured — emitting deterministic cluster list only\n`)
    process.stdout.write(`      set TANGLE_ROUTER_USER_KEY (preferred) or ANTHROPIC_API_KEY / GROQ_API_KEY to enable LLM diagnosis\n`)
    const clusters = clusterGaps(report).filter((c) => c.totalTimesRemaining >= args.minImpact)
    for (const c of clusters) {
      process.stdout.write(`      [cluster ${c.id}] ${c.totalTimesRemaining} installs: ${c.packages.map((p) => p.name).join(', ')}\n`)
    }
    process.stdout.write(`\n`)
  } else {
    proposals = await diagnoseGaps(report, {
      existingCapabilities,
      scaffoldContext: `starter-foundry @ ${commit}. R1 closed tailwind/shadcn; R2 touched code-editor signals. ${s.totalHistoricalInstalls} historical agent installs captured across ${s.totalBuildouts} buildouts.`,
      minTimesRemaining: args.minImpact,
    })
  }
  for (let i = 0; i < proposals.length; i++) {
    const p = proposals[i]
    process.stdout.write(`      [${i + 1}] ${p.clusterId}  conf=${p.confidence.toFixed(2)}  impact=${p.expectedImpact}  → ${p.suggestedCapability}\n`)
    process.stdout.write(`          ${p.rootCause}\n`)
  }
  process.stdout.write(`\n`)

  // 3) propose (dispatch to kimi-for-coding via bridge)
  const dispatchable = proposals
    .filter((p) => p.expectedImpact >= args.minImpact && p.confidence >= args.minConfidence)
    .slice(0, Number.isFinite(args.top) ? args.top : proposals.length)
  process.stdout.write(`[3/3] propose edits  ${args.dispatch ? '(DISPATCH)' : '(DRY-RUN)'}\n`)
  if (proposals.length === 0) {
    process.stdout.write(`      no LLM proposals available (diagnoser stage was skipped) — nothing to dispatch\n`)
    process.stdout.write(`      to dispatch: set TCLOUD_API_KEY + BRIDGE_UNLOCK then run with --dispatch\n`)
    return
  }
  if (dispatchable.length === 0) {
    process.stdout.write(`      no proposals clear impact/confidence floor (${args.minImpact}/${args.minConfidence})\n`)
    return
  }
  for (const p of dispatchable) {
    const r = await proposeEdit(p, { dryRun: !args.dispatch })
    if (args.dispatch) {
      process.stdout.write(`      ${p.clusterId}  session=${r.resumeKey}\n`)
      process.stdout.write(`      response: ${String(r.response).slice(0, 300).replaceAll('\n', '\n                ')}\n\n`)
    } else {
      process.stdout.write(`      ${p.clusterId}  session=${r.resumeKey}  (dry-run, task queued)\n`)
    }
  }
}

main().catch((err) => {
  process.stderr.write(`self-heal failed: ${err?.stack ?? err}\n`)
  process.exit(1)
})
