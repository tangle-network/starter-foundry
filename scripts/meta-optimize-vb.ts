#!/usr/bin/env node
// Meta-optimization against VB end-to-end — the Branch 5 closer.
//
// Instead of optimizing against corpus-side proxy metrics (jaccard hit,
// routing accuracy), this driver runs the full VB pipeline per variant
// and uses the resulting buildout_pass_rate + cost_usd_per_buildout as
// the signal. Proposers compete against REAL product outcomes, not
// proxies that don't carry over.
//
// Pipeline per variant:
//   1. checkout variant branch
//   2. build (pnpm build)
//   3. dispatch VB sweep on blueprint-agent side (external)
//   4. wait for buildout-analysis.json to land via emitBuildoutEvent
//   5. read scorecard.json for buildout_pass_rate + cost_usd_per_buildout
//   6. score variant = 0.7 * pass_rate - 0.3 * (cost / target_cost)
//   7. write .evolve/multi-pursue/meta-optimize-vb/<variant>.json
//
// This script ORCHESTRATES; the actual VB run happens in blueprint-agent.
// Dispatch happens via a REST call to blueprint-agent's /dispatch endpoint
// (when BLUEPRINT_AGENT_URL env is set) or by writing a dispatch manifest
// the operator picks up manually.
//
// Usage:
//   node scripts/meta-optimize-vb.ts --variants variant_a,variant_b --timeout 1800
//   node scripts/meta-optimize-vb.ts --dry-run

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(REPO, '.evolve/multi-pursue/meta-optimize-vb')

const args = process.argv.slice(2)
function arg(k, fb) {
  const i = args.indexOf(k)
  return i >= 0 ? args[i + 1] : fb
}
const VARIANTS = (arg('--variants') ?? '').split(',').filter(Boolean)
const TIMEOUT_SEC = parseInt(arg('--timeout', '1800'), 10)
const DRY_RUN = args.includes('--dry-run')
const BA_URL = process.env['BLUEPRINT_AGENT_URL'] ?? null

if (VARIANTS.length === 0) {
  console.error('usage: meta-optimize-vb.mjs --variants <a,b,c> [--timeout 1800] [--dry-run]')
  process.exit(2)
}

mkdirSync(OUT_DIR, { recursive: true })

function sh(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8', ...opts })
  if (res.status !== 0 && !opts.allowFail) {
    throw new Error(`${cmd} ${args.join(' ')}: ${res.stderr?.slice(0, 300)}`)
  }
  return res.stdout?.trim() ?? ''
}

async function runVariant(variant) {
  console.log(`\n=== variant: ${variant} ===`)

  // Snapshot HEAD to restore afterwards.
  const origBranch = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'])

  try {
    if (!DRY_RUN) {
      sh('git', ['checkout', variant])
      sh('pnpm', ['build'])
    } else {
      console.log(`  (dry-run) would checkout ${variant} + build`)
    }

    // Dispatch VB sweep.
    const scenarioTarget = 'vb-scenarios-sample' // blueprint-agent side identifier
    const runId = `meta-vb-${variant}-${Date.now()}`
    if (BA_URL && !DRY_RUN) {
      console.log(`  dispatching VB sweep at ${BA_URL}...`)
      const res = await fetch(`${BA_URL}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, variant, scenarioTarget, timeoutSec: TIMEOUT_SEC }),
      })
      if (!res.ok) throw new Error(`dispatch failed: ${res.status}`)
    } else {
      // Write a dispatch manifest the operator picks up manually.
      const manifest = {
        runId,
        variant,
        scenarioTarget,
        timeoutSec: TIMEOUT_SEC,
        instruction: 'Run this VB sweep, emit buildout events via emitBuildoutEvent, then re-run meta-optimize-vb --collect.',
      }
      writeFileSync(join(OUT_DIR, `${variant}.dispatch.json`), JSON.stringify(manifest, null, 2))
      console.log(`  wrote dispatch manifest: ${OUT_DIR}/${variant}.dispatch.json`)
    }

    // Collect metrics from scorecard (works regardless of who ran VB).
    const scorecardPath = join(REPO, '.evolve/scorecard.json')
    if (!existsSync(scorecardPath)) {
      throw new Error('no scorecard.json — run refresh-scorecard after VB lands')
    }
    const scorecard = JSON.parse(readFileSync(scorecardPath, 'utf8'))
    const passRate = scorecard.flows?.find((f) => f.name === 'buildout_pass_rate')?.value ?? 0
    const costPerBuildout = scorecard.flows?.find((f) => f.name === 'cost_usd_per_buildout')?.value ?? null
    const costTarget = 0.5
    const costPenalty = typeof costPerBuildout === 'number' ? costPerBuildout / costTarget : 0

    const score = 0.7 * passRate - 0.3 * costPenalty

    const result = {
      variant,
      runId,
      recordedAt: new Date().toISOString(),
      metrics: { passRate, costPerBuildout, costTarget },
      score,
    }
    writeFileSync(join(OUT_DIR, `${variant}.result.json`), JSON.stringify(result, null, 2))
    console.log(`  score: ${score.toFixed(4)}  (pass ${(passRate * 100).toFixed(1)}%, cost $${costPerBuildout ?? '?'})`)
    return result
  } finally {
    if (!DRY_RUN) {
      sh('git', ['checkout', origBranch], { allowFail: true })
    }
  }
}

const results = []
for (const variant of VARIANTS) {
  try {
    results.push(await runVariant(variant))
  } catch (err) {
    console.error(`  ✗ ${variant}: ${err.message}`)
    results.push({ variant, error: err.message })
  }
}

results.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))

const summary = {
  generatedAt: new Date().toISOString(),
  results,
  winner: results[0]?.variant ?? null,
}
writeFileSync(join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))

console.log('\n=== meta-optimize-vb summary ===')
for (const r of results) {
  if (r.error) console.log(`  ${r.variant}: ERROR (${r.error})`)
  else console.log(`  ${r.variant}: ${r.score.toFixed(4)}`)
}
if (summary.winner) console.log(`\n🏆 winner: ${summary.winner}`)
