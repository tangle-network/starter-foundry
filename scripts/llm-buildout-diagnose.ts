#!/usr/bin/env node
// LLM buildout diagnoser — reads .evolve/buildout-analysis.json and
// .evolve/traces/buildouts.jsonl, asks the LLM to produce a ranked
// diagnosis of failure patterns with concrete fix hypotheses.
//
// Offline-only — runs nightly from measurement workflow. Does NOT
// alter any registry files; emits .evolve/reports/llm-diagnosis.md
// and .evolve/reports/llm-diagnosis.json for the operator + next
// pursuit cycle.
//
// Why LLM: regex-based failure classification (`classifyFailure`)
// buckets errors into a fixed taxonomy. An LLM reading the actual
// failure text + the context of which packages/files are involved
// can surface root causes the taxonomy misses — "agent added
// codemirror 15× because capability:code-editor didn't attach on
// the hl-builder scenario" — as a one-shot diagnosis instead of a
// grep-through-traces-and-correlate human job.
//
// Usage:
//   node scripts/llm-buildout-diagnose.ts           # runs LLM, writes reports
//   node scripts/llm-buildout-diagnose.ts --dry-run # compute input only
//
// Env: TANGLE_API_KEY or ANTHROPIC_API_KEY required. Exits 0
// with a no-op message when no key is configured (safe in CI).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ANALYSIS = join(REPO, '.evolve/buildout-analysis.json')
const TRACES = join(REPO, '.evolve/traces/buildouts.jsonl')
const OUT_MD = join(REPO, '.evolve/reports/llm-diagnosis.md')
const OUT_JSON = join(REPO, '.evolve/reports/llm-diagnosis.json')

const DRY_RUN = process.argv.includes('--dry-run')

if (!existsSync(ANALYSIS)) {
  console.log('no buildout-analysis.json — run scripts/run-buildout-pipeline.ts first')
  process.exit(0)
}

const hasKey =
  process.env['TANGLE_API_KEY'] || process.env['ANTHROPIC_API_KEY'] || process.env['GROQ_API_KEY']

if (!hasKey && !DRY_RUN) {
  console.log('no LLM key (TANGLE_API_KEY / ANTHROPIC_API_KEY / GROQ_API_KEY) — skipping')
  process.exit(0)
}

const analysis = JSON.parse(readFileSync(ANALYSIS, 'utf8'))

// Slice the 20 failures with the most signal: ranked by failingOnFail
// count across top packages + file rewrites on fail. Plus the per-
// scenario pass-rate outliers (scenarios that pass 0%).
const topFailPackages = (analysis.topAddedPackages ?? [])
  .filter((p) => p.addedOnFail > 0)
  .sort((a, b) => b.addedOnFail - a.addedOnFail)
  .slice(0, 15)

const topFailFiles = (analysis.topRewrittenFiles ?? [])
  .filter((f) => (f.rewrittenOnFail ?? 0) > 0)
  .sort((a, b) => (b.rewrittenOnFail ?? 0) - (a.rewrittenOnFail ?? 0))
  .slice(0, 10)

// #35: passRate=0 with withOutcome=0 means "no measurements yet", not
// "we measured zero passes". The VB analyzer conflates the two by
// emitting passRate=0 on unmeasured rows — filtering these out prevents
// the diagnoser from hallucinating root causes against no-signal
// scenarios. Only treat a scenario as failing when it has measurements.
const failingScenarios = (analysis.perScenario ?? [])
  .filter((s) => (s.withOutcome ?? 0) > 0 && (s.passRate ?? 1) < 0.3)
  .sort((a, b) => (a.passRate ?? 0) - (b.passRate ?? 0))
  .slice(0, 20)

// Sample up to 3 trace events per failing scenario — bounded so prompt
// stays under ~30k tokens even with many scenarios.
const sampledTraces = []
if (existsSync(TRACES)) {
  const failingIds = new Set(failingScenarios.map((s) => s.scenarioId))
  const lines = readFileSync(TRACES, 'utf8').split('\n').filter(Boolean)
  const perScenario = {}
  for (const line of lines) {
    try {
      const e = JSON.parse(line)
      if (!failingIds.has(e.scenarioId)) continue
      perScenario[e.scenarioId] ??= []
      if (perScenario[e.scenarioId].length < 3) {
        perScenario[e.scenarioId].push({
          scenarioId: e.scenarioId,
          partnerGuess: e.partnerGuess,
          addedPackages: (e.addedPackages ?? []).slice(0, 10),
          addedDirs: (e.addedDirs ?? []).slice(0, 5),
          rewrittenFiles: (e.rewrittenFiles ?? []).slice(0, 10),
          outcomeShort: e.outcome
            ? {
                allPass: e.outcome.allPass,
                failingLayers: e.outcome.failingLayers,
                shotsRun: e.outcome.shotsRun,
              }
            : null,
        })
      }
    } catch {
      /* skip malformed */
    }
  }
  for (const arr of Object.values(perScenario)) sampledTraces.push(...arr)
}

const prompt = `You are a senior starter-scaffold quality analyst. Given this build-out analysis
from real AI-agent sessions on starter-foundry scaffolds, produce a ranked list of the
TOP 5 root causes and a specific fix hypothesis for each.

Each root cause should name:
  - The capability/layer/family involved (when identifiable)
  - The file, package, or path that shows the signal
  - Why the agent is doing this work (what the scaffold is missing)
  - The concrete fix (what to edit in which file to eliminate the signal)
  - Expected impact in gap-installs or rewrite-count eliminated

## Top-added packages on fail (package, addedOnFail count)
${topFailPackages.map((p) => `  ${p.key}: ${p.addedOnFail} failed sessions (${p.timesAdded} total)`).join('\n')}

## Top-rewritten files on fail (path, rewrittenOnFail)
${topFailFiles.map((f) => `  ${f.file}: ${f.rewrittenOnFail ?? '?'} failed sessions (${f.timesRewritten} total)`).join('\n')}

## Lowest pass-rate scenarios
${failingScenarios.map((s) => `  ${s.partner}/${s.scenarioId}: ${s.pass}/${s.withOutcome} passed (score ${s.meanScore?.toFixed(3) ?? '?'})`).join('\n')}

## Sampled trace events (up to 3 per failing scenario)
${JSON.stringify(sampledTraces, null, 2).slice(0, 2500)}

## Output format

Emit JSON only, no prose wrapper. Shape:
{
  "diagnoses": [
    {
      "rank": 1,
      "title": "<short root-cause title>",
      "capability": "<capability:foo or null>",
      "file": "<path or null>",
      "evidence": "<one-sentence pointer to the signal above>",
      "rootCause": "<2-3 sentences, specific>",
      "fix": "<file to edit + concrete change>",
      "expectedImpact": "<# of gap-installs or rewrites eliminated>",
      "confidence": "<high | medium | low>"
    },
    ...
  ],
  "meta": {
    "analyzedAt": "<iso>",
    "scenariosAnalyzed": <count>,
    "tracesAnalyzed": <count>
  }
}
`

if (DRY_RUN) {
  console.log('=== prompt ===')
  console.log(prompt.slice(0, 2000))
  console.log('...')
  console.log(`\nprompt length: ${prompt.length} chars`)
  process.exit(0)
}

// Issue the call via the shared reviewer-route — uses whatever provider
// the env exposes, falls back cleanly when none.
const { selectReviewerRoute, reviewerJsonCall } = await import('../dist/lib/reviewer-route.js')
const route = selectReviewerRoute()
if (!route) {
  console.error('no reviewer route available (should not happen given key check above)')
  process.exit(1)
}

console.log(`llm diagnoser: ${route.style} → ${route.model}`)
console.log(`analyzing ${failingScenarios.length} scenarios, ${sampledTraces.length} traces...`)

let response
try {
  response = await reviewerJsonCall(route, {
    system:
      'You are a senior starter-scaffold quality analyst. Emit ONLY JSON matching the schema in the prompt. No prose, no markdown fences.',
    user: prompt,
  })
} catch (err) {
  console.error('LLM call failed:', err.message)
  process.exit(1)
}

let parsed
try {
  parsed = typeof response === 'string' ? JSON.parse(response) : response
} catch (err) {
  console.error('LLM response was not valid JSON:', err.message)
  console.error('Raw response (first 500 chars):', String(response).slice(0, 500))
  process.exit(1)
}

parsed.meta = parsed.meta ?? {}
parsed.meta.analyzedAt = new Date().toISOString()
parsed.meta.scenariosAnalyzed = failingScenarios.length
parsed.meta.tracesAnalyzed = sampledTraces.length
parsed.meta.route = { style: route.style, model: route.model }

mkdirSync(dirname(OUT_MD), { recursive: true })
writeFileSync(OUT_JSON, JSON.stringify(parsed, null, 2))

// Render markdown for human review.
const md = [
  '# LLM buildout diagnosis',
  '',
  `**Analyzed:** ${parsed.meta.analyzedAt}`,
  `**Scenarios:** ${parsed.meta.scenariosAnalyzed}  **Traces sampled:** ${parsed.meta.tracesAnalyzed}`,
  `**Model:** \`${parsed.meta.route.style}/${parsed.meta.route.model}\``,
  '',
  '## Ranked root causes',
  '',
  ...(parsed.diagnoses ?? []).map((d, i) => {
    return [
      `### ${i + 1}. ${d.title}  _(confidence: ${d.confidence ?? '?'})_`,
      '',
      `**Capability**: ${d.capability ?? '(none specified)'}  `,
      `**File**: ${d.file ?? '(none specified)'}  `,
      `**Evidence**: ${d.evidence ?? '—'}`,
      '',
      `**Root cause**: ${d.rootCause ?? '—'}`,
      '',
      `**Fix**: ${d.fix ?? '—'}`,
      '',
      `**Expected impact**: ${d.expectedImpact ?? '—'}`,
      '',
    ].join('\n')
  }),
].join('\n')

writeFileSync(OUT_MD, md)

console.log(`\nwrote:`)
console.log(`  ${OUT_MD}`)
console.log(`  ${OUT_JSON}`)
console.log(`\n${(parsed.diagnoses ?? []).length} diagnoses emitted`)
