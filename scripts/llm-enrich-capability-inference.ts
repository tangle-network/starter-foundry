#!/usr/bin/env node
// LLM capability inferrer — reads corpus prompts with their current
// planner-attached layers, asks the LLM whether capabilities got
// missed or over-attached, emits a diff proposal per prompt to
// .evolve/proposals/capability-inference.json.
//
// Hot path stays deterministic (keyword match + archetype signals).
// This is OFFLINE enrichment — proposals feed back into the next
// training round for the planner + into manual review where signals
// should be added to implicit-caps.ts.
//
// Usage:
//   node scripts/llm-enrich-capability-inference.ts [--sample 30] [--corpus <path>]
//
// Requires TANGLE_API_KEY / ANTHROPIC_API_KEY. No-op without.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(REPO, '.evolve/proposals/capability-inference.json')

const args = process.argv.slice(2)
function arg(k, fb) {
  const i = args.indexOf(k)
  return i >= 0 ? args[i + 1] : fb
}
const SAMPLE_SIZE = parseInt(arg('--sample', '30'), 10)
const CORPUS_PATH = arg('--corpus') ?? join(REPO, 'corpus/ideasai-prompts.json')

if (!process.env['TANGLE_API_KEY'] && !process.env['ANTHROPIC_API_KEY']) {
  console.log('no LLM key — skipping capability enrichment')
  process.exit(0)
}

if (!existsSync(CORPUS_PATH)) {
  console.error(`corpus not found: ${CORPUS_PATH}`)
  process.exit(1)
}

const corpus = JSON.parse(readFileSync(CORPUS_PATH, 'utf8'))
const prompts = Array.isArray(corpus) ? corpus : (corpus.prompts ?? corpus.entries ?? [])

// Deterministic sample (same seed → same picks).
prompts.sort((a, b) => (a.prompt ?? a.text ?? '').localeCompare(b.prompt ?? b.text ?? ''))
const sample = prompts.slice(0, SAMPLE_SIZE)
if (sample.length === 0) {
  console.log('no corpus prompts to analyze')
  process.exit(0)
}

// Load capability catalog so the LLM picks from real ids.
const capDir = join(REPO, 'registry/layers/capability')
const capCatalog = readdirSync(capDir).map((id) => {
  const manifest = JSON.parse(readFileSync(join(capDir, id, 'manifest.json'), 'utf8'))
  return { id, description: (manifest.description ?? '').slice(0, 120) }
})

const { planPrompt } = await import('../dist/lib/prompt-planner.js')
const { selectReviewerRoute, reviewerJsonCall } = await import('../dist/lib/reviewer-route.js')

const route = selectReviewerRoute()
if (!route) {
  console.log('no reviewer route — skipping')
  process.exit(0)
}

console.log(`enriching ${sample.length} prompts via ${route.style}/${route.model}`)

const proposals = []
for (const p of sample) {
  const prompt = p.prompt ?? p.text ?? ''
  if (!prompt) continue
  const plan = await planPrompt({ prompt })
  const spec = plan.spec
  const projectSpec = spec.projects?.[0]?.spec ?? spec
  const attachedCaps = (projectSpec.layers ?? [])
    .filter((l) => String(l).startsWith('capability:'))
    .map((l) => String(l).replace('capability:', ''))

  const llmPrompt = `Prompt: "${prompt.slice(0, 400)}"
Family: ${projectSpec.family}
Currently attached capabilities: ${attachedCaps.join(', ') || '(none)'}

Capability catalog (id — description):
${capCatalog
  .map((c) => `  ${c.id}: ${c.description}`)
  .join('\n')
  .slice(0, 3500)}

Question: Given this prompt, what capability set SHOULD be attached? Output JSON:
{
  "shouldAdd": ["<capability id>", ...],
  "shouldRemove": ["<capability id>", ...],
  "rationale": "<one sentence>"
}

Only include ids that appear in the catalog. Empty arrays when nothing should change.`

  try {
    const response = await reviewerJsonCall(route, {
      system: 'Emit ONLY JSON matching the schema in the prompt. No prose.',
      user: llmPrompt,
    })
    const parsed = typeof response === 'string' ? JSON.parse(response) : response
    if ((parsed.shouldAdd ?? []).length === 0 && (parsed.shouldRemove ?? []).length === 0) continue
    proposals.push({
      promptPreview: prompt.slice(0, 120),
      family: projectSpec.family,
      attachedCaps,
      shouldAdd: parsed.shouldAdd ?? [],
      shouldRemove: parsed.shouldRemove ?? [],
      rationale: parsed.rationale ?? '',
    })
  } catch (err) {
    console.error(`  prompt "${prompt.slice(0, 40)}": ${err.message}`)
    // Sleep on 429 to respect TPM.
    if (err.message.includes('rate_limit')) {
      await new Promise((r) => setTimeout(r, 60000))
    }
  }
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      model: `${route.style}/${route.model}`,
      sampleSize: sample.length,
      proposalCount: proposals.length,
      proposals,
    },
    null,
    2,
  ),
)

console.log(`\nwrote ${OUT} (${proposals.length} proposals from ${sample.length} prompts)`)
