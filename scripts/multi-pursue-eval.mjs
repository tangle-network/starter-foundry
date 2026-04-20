#!/usr/bin/env node
// Shared eval harness for multi-pursue proposer variants.
//
// Contract each proposer variant MUST satisfy:
//   1. Export a training entrypoint at dist/training/<variant>/train.js with
//      a `runTrainingLoop({ corpusPath, outPath })` async function that
//      writes an AxOptimizedProgram JSON to outPath.
//   2. Update src/lib/product-brief.ts (or a drop-in replacement behind an
//      env var) to load the optimized program from
//      `.evolve/optimized/brief-<variant>.json` when present.
//   3. Optionally expose a generator at dist/training/<variant>/generate.js
//      with `generateIdeas({ registry, traces, outPath })` and a judge at
//      dist/training/<variant>/judge.js with `scoreCandidate({ spec })`.
//
// This script runs each variant end-to-end:
//   a) invoke runTrainingLoop to produce .evolve/optimized/brief-<variant>.json
//   b) set STARTER_FOUNDRY_BRIEF_OPTIMIZED=<path> and rerun the matrix
//   c) invoke generateIdeas (if present) and score against judge
//   d) measure capHit deltas and p95, write .evolve/multi-pursue/runs/<variant>.json

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'

const argv = process.argv.slice(2)
function arg(k, fallback) {
  const i = argv.indexOf(k)
  return i >= 0 ? argv[i + 1] : fallback
}

const variant = arg('--variant', null)
if (!variant) {
  console.error('usage: multi-pursue-eval --variant <name>')
  process.exit(2)
}

const optimizedPath = `.evolve/optimized/brief-${variant}.json`
const matrixOut = `.evolve/multi-pursue/runs/${variant}-matrix.jsonl`
const scoreOut = `.evolve/multi-pursue/runs/${variant}.json`

mkdirSync('.evolve/optimized', { recursive: true })
mkdirSync('.evolve/multi-pursue/runs', { recursive: true })

function run(cmd, args, env = {}) {
  const t0 = performance.now()
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  return { status: res.status ?? -1, durationMs: performance.now() - t0 }
}

// 1. train
console.log(`\n=== [${variant}] TRAIN ===`)
const trainPath = `dist/training/${variant}/train.js`
if (!existsSync(trainPath)) {
  console.error(`missing: ${trainPath} — variant did not compile or entry point missing`)
  writeFileSync(scoreOut, JSON.stringify({ variant, failed: 'no-train-entry' }, null, 2))
  process.exit(3)
}
const trainRes = run(process.execPath, ['-e', `
import('${resolve(trainPath)}').then(async (mod) => {
  if (typeof mod.runTrainingLoop !== 'function') throw new Error('runTrainingLoop not exported');
  await mod.runTrainingLoop({ corpusPath: 'corpus/ideasai-prompts.json', outPath: '${optimizedPath}' });
  console.log('train complete');
}).catch(e => { console.error(e?.stack ?? e); process.exit(1); });
`])
if (trainRes.status !== 0) {
  writeFileSync(scoreOut, JSON.stringify({ variant, failed: 'train-nonzero', durationMs: trainRes.durationMs }, null, 2))
  process.exit(4)
}

// 2. matrix with optimized program loaded
console.log(`\n=== [${variant}] MATRIX (optimized brief loaded) ===`)
const loaderPath = `dist/training/${variant}/brief-loader.js`
const matrixArgs = [
  'scripts/meta-harness-eval.mjs',
  '--brief',
  '--out', matrixOut,
  '--label', variant,
]
if (existsSync(loaderPath)) {
  matrixArgs.push('--brief-loader', loaderPath)
}
const matrixRes = run(process.execPath, matrixArgs, {
  STARTER_FOUNDRY_BRIEF_OPTIMIZED: optimizedPath,
})

// 3. parse aggregate
if (!existsSync(matrixOut)) {
  writeFileSync(scoreOut, JSON.stringify({ variant, failed: 'no-matrix-output' }, null, 2))
  process.exit(5)
}
const lines = readFileSync(matrixOut, 'utf8').trim().split('\n')
const agg = JSON.parse(lines[lines.length - 1])

// 4. idea generation + judge (optional; nullable scores)
let archetypePromotionYield = 0
let judgeAgreement = null
const genPath = `dist/training/${variant}/generate.js`
const judgePath = `dist/training/${variant}/judge.js`
if (existsSync(genPath) && existsSync(judgePath)) {
  console.log(`\n=== [${variant}] GENERATE + JUDGE ===`)
  const ideaOut = `.evolve/ideas/${variant}.json`
  mkdirSync('.evolve/ideas', { recursive: true })
  const genRes = run(process.execPath, ['--input-type=module', '-e', `
    import fs from 'node:fs';
    const g = await import('${resolve(genPath)}');
    const j = await import('${resolve(judgePath)}');
    const ideas = await g.generateIdeas({ registryRoot: 'registry', tracesPath: '.evolve/traces' });
    const scored = [];
    for (const idea of ideas) {
      const score = await j.scoreCandidate({ spec: idea });
      scored.push({ idea, score });
    }
    const promotable = scored.filter(s => s.score?.promotable).length;
    fs.writeFileSync('${ideaOut}', JSON.stringify({ ideas: scored, promotable }, null, 2));
  `.replace(/\n/g, ' ')])
  if (genRes.status === 0 && existsSync(ideaOut)) {
    const ideaData = JSON.parse(readFileSync(ideaOut, 'utf8'))
    archetypePromotionYield = ideaData.promotable ?? 0
  }
}

// 5. write score card
const perCorpus = agg.perCorpus ?? {}
const scores = {
  ideasaiCapHit: perCorpus.ideasai?.meanCapHit ?? null,
  heldOutCapHit: perCorpus['held-out']?.meanCapHit ?? null,
  briefP95Ms: agg.p95Ms ?? null,
  judgeAgreement,
  archetypePromotionYield,
}
writeFileSync(
  scoreOut,
  JSON.stringify({ variant, scores, aggregate: agg, timestamp: new Date().toISOString() }, null, 2),
)

console.log(`\n=== [${variant}] SCORES ===`)
console.log(JSON.stringify(scores, null, 2))
console.log(`wrote: ${scoreOut}`)
