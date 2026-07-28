#!/usr/bin/env node
// Gen-6 R6: capability gap detector (mirror of detect-family-gaps.mjs).
//
// Unlike families — which are routed via taxonomy + tier1 — capabilities
// compose additively. A capability gap is a recurring buildout signal where
// the prompt asks for a feature (e.g. "passkey onboarding", "NFT mint page",
// "hedging UI") but no existing capability's keywords cover it.
//
// Detection: tokenize every scenario prompt's feature phrases and compare
// against the union of all capability keywords (tier1 + tier2 + keywords).
// Scenarios whose token set has zero/weak overlap with any capability are
// flagged as gaps. Demand-weighted priority: occurrence count × coverage gap.
//
// Output: priority-sorted ProposeCapabilityInput-shaped records that
// propose-capability-candidates.mjs consumes directly.
//
// Usage:
//   node scripts/detect-capability-gaps.ts              # top-10 gaps
//   node scripts/detect-capability-gaps.ts --json       # machine-readable
//   node scripts/detect-capability-gaps.ts --top 5 --min-count 3

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TRACES = join(REPO, '.evolve/traces/buildouts.jsonl')
const CAPS_DIR = join(REPO, 'registry/layers/capability')
const FAMS_DIR = join(REPO, 'registry/families')

const argv = process.argv.slice(2)
const arg = (flag, fallback) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : fallback
}
const JSON_OUT = argv.includes('--json')
const TOP_N = Number(arg('--top', '10')) || 10
const MIN_COUNT = Number(arg('--min-count', '3')) || 3

function tokenize(s) {
  return String(s)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2)
}

// ── Build capability keyword lookup ──────────────────────────────────
const capKeywords = new Set()
const capAppliesIndex = new Map() // family-id → [capability-ids] that apply
for (const id of readdirSync(CAPS_DIR)) {
  if (id.startsWith('.') || id.startsWith('_')) continue
  const mp = join(CAPS_DIR, id, 'manifest.json')
  if (!existsSync(mp)) continue
  try {
    const m = JSON.parse(readFileSync(mp, 'utf8'))
    for (const kw of [
      ...(m.tieredKeywords?.tier1 ?? []),
      ...(m.tieredKeywords?.tier2 ?? []),
      ...(m.keywords ?? []),
    ]) {
      capKeywords.add(String(kw).toLowerCase())
    }
    for (const fam of m.appliesTo ?? []) {
      const arr = capAppliesIndex.get(fam) ?? []
      arr.push(id)
      capAppliesIndex.set(fam, arr)
    }
  } catch {
    /* skip malformed */
  }
}

if (capKeywords.size === 0) {
  console.error('no capability keywords loaded — registry/layers/capability/ missing or empty')
  process.exit(2)
}

// ── Identify which families exist (for appliesTo recommendations) ────
const existingFamilies = new Set(
  readdirSync(FAMS_DIR).filter(
    (f) => existsSync(join(FAMS_DIR, f, 'manifest.json')) && !f.startsWith('.'),
  ),
)

// ── Load buildouts + feature-phrase extraction ───────────────────────
if (!existsSync(TRACES)) {
  console.error('no buildouts trace at', TRACES)
  process.exit(0)
}
const scenarios = new Map() // scenarioId → { count, prompts[], partner }
for (const line of readFileSync(TRACES, 'utf8').split('\n').filter(Boolean)) {
  try {
    const r = JSON.parse(line)
    if (!r.scenarioId) continue
    const s = scenarios.get(r.scenarioId) ?? {
      scenarioId: r.scenarioId,
      partner: r.partnerGuess ?? null,
      prompts: [],
      count: 0,
    }
    s.count += 1
    if (r.initialPrompt && s.prompts.length < 2) s.prompts.push(r.initialPrompt.slice(0, 1000))
    scenarios.set(r.scenarioId, s)
  } catch {
    /* skip */
  }
}

// ── Score each scenario for capability coverage ──────────────────────
// Heuristic: scenarioId tokens that don't appear in any capability's
// keyword set, combined with feature-phrase tokens from the prompt,
// flag a scenario as likely-missing-a-capability.
const gaps = []
for (const s of scenarios.values()) {
  if (s.count < MIN_COUNT) continue
  const scenarioTokens = new Set(tokenize(s.scenarioId))
  // Which scenarioId tokens don't appear anywhere in capability keywords?
  const uncoveredTokens = []
  for (const t of scenarioTokens) {
    let covered = false
    for (const kw of capKeywords) {
      if (kw === t || kw.includes(t) || t.includes(kw)) {
        covered = true
        break
      }
    }
    if (!covered) uncoveredTokens.push(t)
  }
  // If nothing is uncovered, this scenario is already covered.
  if (uncoveredTokens.length === 0) continue
  const coverageScore = Math.min(1, uncoveredTokens.length / 3) // 3+ uncovered = full gap
  const demandScore = Math.min(1, s.count / 10)
  const priority = coverageScore * 0.6 + demandScore * 0.4

  gaps.push({
    scenarioId: s.scenarioId,
    partner: s.partner,
    occurrences: s.count,
    uncoveredTokens,
    priority,
    promptHead: (s.prompts[0] ?? '').slice(0, 400),
  })
}
gaps.sort((a, b) => b.priority - a.priority)
const top = gaps.slice(0, TOP_N)

// ── Convert gaps → ProposeCapabilityInput-shaped candidates ──────────
function appliesForGap(g) {
  // Partner-aware: if partner implies a family, recommend it first.
  const partnerHints = {
    'ethereum-l1': ['react-vite-ts', 'nextjs-ts', 'forge-contracts'],
    'base-defi': ['react-vite-ts', 'nextjs-ts', 'forge-contracts'],
    'arbitrum-stylus': ['stylus-contracts', 'react-vite-ts'],
    'coinbase-smart-wallet': ['react-vite-ts', 'nextjs-ts'],
    'fintech-mixed': ['fintech-ledger-backend', 'fullstack-ts'],
    'tangle-network': ['agent-service-ts', 'react-vite-ts'],
    'polymarket-prediction': ['polymarket-portfolio-hedging', 'react-vite-ts'],
    deno: ['deno-edge'],
  }
  const hinted = g.partner && partnerHints[g.partner] ? partnerHints[g.partner] : []
  const fallback = ['react-vite-ts', 'nextjs-ts', 'fullstack-ts'] // safe frontend default
  const candidates = [...hinted, ...fallback].filter((f) => existingFamilies.has(f))
  // Dedup + cap at 3
  const seen = new Set()
  const out = []
  for (const f of candidates) {
    if (seen.has(f)) continue
    seen.add(f)
    out.push(f)
    if (out.length >= 3) break
  }
  return out
}

function describeFor(g) {
  const feature = g.uncoveredTokens.slice(0, 3).join(' ')
  const demand = `recurring ${g.occurrences}× in buildout demand signal${g.partner ? ` (partner: ${g.partner})` : ''}`
  return `${feature} capability — adds ${feature} slot files to an existing family. Derived from ${demand}.`
}

function slotFilesFor(g) {
  const base = g.uncoveredTokens.slice(0, 2).join('-') || g.scenarioId.slice(0, 30)
  // Capabilities typically ship 2-4 files: a config JSON, a component/module,
  // and a markdown doc. Keep minimal — the proposer expands.
  return [
    `src/${base}-config.json`,
    `src/components/${base
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('')}.tsx`,
    `${base}.md`,
  ]
}

const candidates = top.map((g) => ({
  id: g.scenarioId
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()
    .slice(0, 48),
  description: describeFor(g),
  appliesTo: appliesForGap(g),
  slotFiles: slotFilesFor(g),
  priority: g.priority,
  occurrences: g.occurrences,
  partner: g.partner,
  uncoveredTokens: g.uncoveredTokens,
  productCues: [
    `Real user demand: "${g.scenarioId}" recurred ${g.occurrences}× in buildout traces`,
    ...(g.partner ? [`Associated partner: ${g.partner}`] : []),
    `Capability gap tokens: ${g.uncoveredTokens.join(', ')}`,
  ],
}))

if (JSON_OUT) {
  console.log(JSON.stringify({ topN: TOP_N, minCount: MIN_COUNT, candidates }, null, 2))
} else {
  console.log(`\n━━━━ Top ${TOP_N} capability-proposal candidates ━━━━`)
  console.log(
    `(from ${scenarios.size} scenarios in ${TRACES}, ${capKeywords.size} existing capability keywords)\n`,
  )
  for (const c of candidates) {
    console.log(`  priority=${c.priority.toFixed(2)}  id=${c.id}`)
    console.log(
      `    occ=${c.occurrences} partner=${c.partner ?? '(none)'} appliesTo=${c.appliesTo.join(', ') || '(no families)'}`,
    )
    console.log(`    uncovered: ${c.uncoveredTokens.join(', ')}`)
    console.log(`    slot files: ${c.slotFiles.join(', ')}`)
    console.log('')
  }
  console.log('Drive the proposer with:')
  console.log(`  node scripts/detect-capability-gaps.ts --json --top 3 \\`)
  console.log(`    | node scripts/propose-capability-candidates.ts`)
}
