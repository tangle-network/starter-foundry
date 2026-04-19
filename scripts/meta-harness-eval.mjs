#!/usr/bin/env node
// Meta-harness eval: runs all scenarios across every corpus against a
// pluggable planner module, emitting per-scenario JSONL for diagnosis.
//
// Usage:
//   node scripts/meta-harness-eval.mjs --out .evolve/meta-harness/runs/baseline.jsonl
//   node scripts/meta-harness-eval.mjs --planner .evolve/meta-harness/variants/foo.js --out ...
//
// Per-scenario line shape:
//   {"scenario":"<id>","corpus":"...","prompt":"...","expected":"...","actual":"...",
//    "kindMatch":bool,"familyMatch":bool,"capabilityHit":0..1,"latencyMs":number,"passed":bool}
//
// Aggregate trailer line:
//   {"_aggregate":true,"scenarios":N,"passRate":...,"p50":...,"p95":...,"meanMs":...,"dims":{...}}

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'

const argv = process.argv.slice(2)
function arg(k, fallback) {
  const i = argv.indexOf(k)
  return i >= 0 ? argv[i + 1] : fallback
}

const plannerPath = arg('--planner', 'dist/lib/prompt-planner.js')
const outPath = arg('--out', '.evolve/meta-harness/runs/current.jsonl')
const smoke = argv.includes('--smoke')
const useRewriter = argv.includes('--rewriter')
const useBrief = argv.includes('--brief')
const configLabel = arg('--label', useBrief ? 'brief' : useRewriter ? 'rewriter' : 'baseline')

const plannerMod = await import(resolve(plannerPath))
const planPrompt = plannerMod.planPrompt

// Optional brief loader for multi-pursue variants. When provided, the loader
// module must export `installLoader({ optimizedPath })` which replaces the
// default brief agent via product-brief's __setTestBrief hook.
const briefLoaderPath = arg('--brief-loader', null)
const briefOptimizedPath = process.env.STARTER_FOUNDRY_BRIEF_OPTIMIZED
if (briefLoaderPath) {
  const loader = await import(resolve(briefLoaderPath))
  if (typeof loader.installLoader !== 'function') {
    console.error(`brief loader ${briefLoaderPath} does not export installLoader`)
    process.exit(3)
  }
  await loader.installLoader({ optimizedPath: briefOptimizedPath })
}
if (typeof planPrompt !== 'function') {
  console.error('planner module does not export planPrompt:', plannerPath)
  process.exit(2)
}

function loadCorpora() {
  const held = JSON.parse(readFileSync('corpus/held-out-validation.json', 'utf8'))
  const ideas = JSON.parse(readFileSync('corpus/ideasai-prompts.json', 'utf8'))
  const vibe = JSON.parse(readFileSync('corpus/vibecoder-prompts.json', 'utf8'))

  const scenarios = []
  for (const s of held.scenarios) {
    scenarios.push({
      id: s.id,
      corpus: 'held-out',
      prompt: s.prompt,
      partner: s.partner ?? null,
      expectedKind: s.expected?.kind ?? 'starter',
      expectedFamily: s.expected?.family ?? null,
      expectedCapabilities: s.expected?.capabilities ?? [],
    })
  }
  for (const s of ideas) {
    scenarios.push({
      id: s.id,
      corpus: 'ideasai',
      prompt: s.prompt,
      partner: null,
      expectedKind: 'starter',
      expectedFamily: s.expectedFamily,
      expectedCapabilities: s.expectedCapabilities ?? [],
    })
  }
  // vibecoder: uncategorized expectations — track only latency + stability
  for (const [cat, list] of Object.entries(vibe.categories)) {
    for (let i = 0; i < list.length; i++) {
      scenarios.push({
        id: `vibe-${cat}-${i}`,
        corpus: 'vibecoder',
        prompt: list[i],
        partner: null,
        expectedKind: null,
        expectedFamily: null,
        expectedCapabilities: [],
      })
    }
  }
  return scenarios
}

function extractActual(plan) {
  if (!plan) return { kind: null, family: null, capabilities: [] }
  if (plan.kind === 'starter') {
    return {
      kind: 'starter',
      family: plan.spec?.family ?? null,
      capabilities: (plan.spec?.layers ?? []).map((l) => l),
    }
  }
  if (plan.kind === 'workspace') {
    return {
      kind: 'workspace',
      family: 'workspace',
      capabilities: (plan.spec?.projects ?? []).flatMap((p) => p.layers ?? []),
    }
  }
  return { kind: plan.kind ?? null, family: null, capabilities: [] }
}

function jaccard(a, b) {
  const A = new Set(a)
  const B = new Set(b)
  if (A.size === 0 && B.size === 0) return 1
  const inter = [...A].filter((x) => B.has(x)).length
  const union = A.size + B.size - inter
  return union === 0 ? 1 : inter / union
}

const scenarios = smoke ? loadCorpora().slice(0, 5) : loadCorpora()

// warm-up — always without rewriter to avoid paying LLM on the warmup
await planPrompt({ prompt: scenarios[0].prompt, partner: scenarios[0].partner })

mkdirSync(dirname(outPath), { recursive: true })
const lines = []
const latencies = []
const perCorpus = {}

for (const s of scenarios) {
  const t = performance.now()
  let plan = null
  let error = null
  try {
    plan = await planPrompt({ prompt: s.prompt, partner: s.partner, rewriter: useRewriter, brief: useBrief })
  } catch (err) {
    error = String(err?.message ?? err)
  }
  const latencyMs = performance.now() - t
  latencies.push(latencyMs)

  const actual = extractActual(plan)
  const kindMatch = s.expectedKind ? actual.kind === s.expectedKind : true
  const familyMatch = s.expectedFamily ? actual.family === s.expectedFamily : true
  const capabilityHit = s.expectedCapabilities.length
    ? jaccard(actual.capabilities, s.expectedCapabilities)
    : 1
  const passed = kindMatch && familyMatch && !error

  perCorpus[s.corpus] ??= { total: 0, pass: 0, sumCapHit: 0, sumLatency: 0 }
  perCorpus[s.corpus].total++
  if (passed) perCorpus[s.corpus].pass++
  perCorpus[s.corpus].sumCapHit += capabilityHit
  perCorpus[s.corpus].sumLatency += latencyMs

  lines.push(
    JSON.stringify({
      scenario: s.id,
      corpus: s.corpus,
      prompt: s.prompt,
      expectedKind: s.expectedKind,
      expectedFamily: s.expectedFamily,
      expectedCapabilities: s.expectedCapabilities,
      actualKind: actual.kind,
      actualFamily: actual.family,
      actualCapabilities: actual.capabilities,
      kindMatch,
      familyMatch,
      capabilityHit,
      latencyMs,
      passed,
      error,
    }),
  )
}

latencies.sort((a, b) => a - b)
const sum = latencies.reduce((a, b) => a + b, 0)
const mean = sum / latencies.length
const p = (q) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))]
const pass = lines.filter((l) => JSON.parse(l).passed).length
const overall = pass / lines.length

const corporaOut = {}
for (const [k, v] of Object.entries(perCorpus)) {
  corporaOut[k] = {
    passRate: v.pass / v.total,
    meanCapHit: v.sumCapHit / v.total,
    meanLatencyMs: v.sumLatency / v.total,
    total: v.total,
  }
}

const agg = {
  _aggregate: true,
  planner: plannerPath,
  config: { label: configLabel, rewriter: useRewriter, brief: useBrief },
  scenarios: lines.length,
  passRate: overall,
  meanMs: mean,
  p50Ms: p(0.5),
  p95Ms: p(0.95),
  p99Ms: p(0.99),
  maxMs: latencies[latencies.length - 1],
  dims: {
    accuracy: overall,
    latencyP95: p(0.95),
    capabilityHitMean:
      Object.values(perCorpus).reduce((a, v) => a + v.sumCapHit, 0) / lines.length,
  },
  perCorpus: corporaOut,
  timestamp: new Date().toISOString(),
}
lines.push(JSON.stringify(agg))

writeFileSync(outPath, lines.join('\n') + '\n')

// Human summary
console.log(`planner: ${plannerPath}`)
console.log(`scenarios: ${lines.length - 1}`)
console.log(`passRate: ${overall.toFixed(4)}`)
console.log(`latency p50/p95/p99: ${p(0.5).toFixed(3)} / ${p(0.95).toFixed(3)} / ${p(0.99).toFixed(3)} ms`)
console.log(`mean: ${mean.toFixed(3)} ms`)
for (const [k, v] of Object.entries(corporaOut)) {
  console.log(`  ${k}: pass=${v.passRate.toFixed(3)} capHit=${v.meanCapHit.toFixed(3)} meanMs=${v.meanLatencyMs.toFixed(3)} (n=${v.total})`)
}
console.log(`wrote: ${outPath}`)
