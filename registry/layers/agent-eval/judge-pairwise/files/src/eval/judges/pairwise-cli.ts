#!/usr/bin/env tsx
/**
 * Pairwise eval CLI.
 *
 *   tsx pairwise-cli.ts <variant-a-dir> <variant-b-dir> [--judge-family <id>]
 *
 * Each variant dir is expected to contain `outputs.json`:
 *   {
 *     "variantId": "v1",
 *     "family": "claude-opus-4",
 *     "scenarios": [{ "scenarioId": "s1", "output": "...", "bundle": {...},
 *                     "score": {...RunScore}, "metadata": {...} }]
 *   }
 *
 * Emits a markdown report to stdout + a structured JSON sidecar for CI.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

import {
  runPairwise,
  type PairwiseJudge,
  type PairwiseReport,
  type VariantOutputs,
} from './pairwise-runner.js'

const parseArgs = (argv: string[]): { aDir: string; bDir: string; judgeFamily?: string } => {
  const args = argv.slice(2)
  const positional: string[] = []
  let judgeFamily: string | undefined
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]
    if (a === '--judge-family') {
      judgeFamily = args[++i]
    } else if (a === '--help' || a === '-h') {
      console.log('Usage: pairwise-cli.ts <variant-a-dir> <variant-b-dir> [--judge-family <id>]')
      process.exit(0)
    } else {
      positional.push(a)
    }
  }
  if (positional.length !== 2) {
    console.error('error: expected exactly two positional args (variant-a-dir, variant-b-dir)')
    process.exit(2)
  }
  return { aDir: positional[0], bDir: positional[1], judgeFamily }
}

const loadVariant = (dir: string): VariantOutputs => {
  const path = resolve(dir, 'outputs.json')
  const raw = readFileSync(path, 'utf8')
  const parsed = JSON.parse(raw) as VariantOutputs
  if (!parsed.variantId || !Array.isArray(parsed.scenarios)) {
    throw new Error(`invalid variant outputs at ${path}: missing variantId or scenarios[]`)
  }
  return parsed
}

const renderMarkdown = (r: PairwiseReport): string => {
  const lines: string[] = []
  lines.push(`# Pairwise eval — ${r.variantA} vs ${r.variantB}`)
  lines.push('')
  lines.push(`## Wins  A: ${r.winCounts.a}  B: ${r.winCounts.b}  ties: ${r.winCounts.tie}`)
  lines.push('')
  lines.push(`Optimizer recommends: **${r.optimizer.recommendedVariantId}**`)
  lines.push(`> ${r.optimizer.rationale}`)
  lines.push('')
  lines.push('## Bias diagnostics')
  lines.push(`- **positional**: avgDelta=${r.bias.position.avgDelta.toFixed(4)} (n=${r.bias.position.n})`)
  lines.push(`- **verbosity**: pearson=${r.bias.verbosity.pearson.toFixed(4)} (n=${r.bias.verbosity.n})`)
  if (r.bias.selfPreference) {
    const sp = r.bias.selfPreference
    lines.push(`- **self-preference**: deltaMean=${sp.deltaMean.toFixed(4)} (in=${sp.inFamilyMean.toFixed(3)}, out=${sp.outOfFamilyMean.toFixed(3)}, n=${sp.n})`)
  }
  lines.push('')
  lines.push('## Per-scenario verdicts')
  for (const s of r.perScenario) {
    lines.push(`- ${s.scenarioId}: **${s.verdict}** (A=${s.meanA.toFixed(3)}, B=${s.meanB.toFixed(3)}, Δ=${s.positionDelta.toFixed(3)})`)
  }
  return lines.join('\n')
}

/**
 * CLI judge: replays the pre-computed `score.success` from each variant's
 * outputs.json. Because the score is precomputed (rubric eval already ran
 * per-variant), there is no presentation-order signal to recover at this
 * stage — both orderings will return the same numbers, position-bias will
 * be reported as 0, and the verdict reflects only the rubric-score gap.
 *
 * To exercise REAL position-bias correction at the CLI layer, callers
 * must run a true pairwise judge (e.g. invokeMetaJudge with both outputs
 * in a single prompt) and write a CLI variant that wraps it. The library
 * `runPairwise` is the integration point.
 */
const replayJudge: PairwiseJudge = async ({ first, second }) => ({
  firstScore: first.score.success,
  secondScore: second.score.success,
})

const main = async (): Promise<void> => {
  const { aDir, bDir, judgeFamily } = parseArgs(process.argv)
  const variantA = loadVariant(aDir)
  const variantB = loadVariant(bDir)
  const report = await runPairwise({ variantA, variantB, judge: replayJudge, judgeFamily })
  process.stdout.write(renderMarkdown(report) + '\n')
  // Write structured sidecar for CI ingestion.
  const jsonOut = process.env.PAIRWISE_JSON_OUT
  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify(report, null, 2))
  }
}

main().catch((err) => {
  console.error('[pairwise-cli] fatal:', err)
  process.exit(2)
})
