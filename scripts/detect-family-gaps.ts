#!/usr/bin/env node
// Gap detector — mines real-user demand signal (.evolve/traces/buildouts.jsonl)
// against current registry coverage to propose (taxonomy, description, cues)
// candidates for the family proposer.
//
// Signal: each buildout trace is a real session where a user asked to scaffold
// something. The scenarioId + partnerGuess + initialPrompt together are the
// demand. We compare scenario-token overlap with every family's tier1 +
// keywords. Scenarios with zero/weak overlap AND a recurring pattern in the
// corpus are high-value gaps — real users asked for them, and no family is
// obviously positioned to answer.
//
// This does NOT use the live router — that would require LLM calls for all
// 292 traces. Token-overlap is a crude first pass that's fast and
// deterministic; the proposer + promoter are the expensive validation layer
// and will reject bad picks via the schema/compose/build gates.
//
// Usage:
//   node scripts/detect-family-gaps.ts              # print top-10 gaps
//   node scripts/detect-family-gaps.ts --json       # machine-readable
//   node scripts/detect-family-gaps.ts --top 20     # configurable top-N
//   node scripts/detect-family-gaps.ts --min-count 3 # require N occurrences

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TRACES = join(REPO, '.evolve/traces/buildouts.jsonl')
const FAMILIES_DIR = join(REPO, 'registry/families')

const argv = process.argv.slice(2)
const arg = (flag, fallback) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : fallback
}
const JSON_OUT = argv.includes('--json')
const TOP_N = Number(arg('--top', '10')) || 10
const MIN_COUNT = Number(arg('--min-count', '1')) || 1

function tokenize(s) {
  return String(s).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2)
}

// ── Build family lookup ──────────────────────────────────────────────
const families = {}
for (const id of readdirSync(FAMILIES_DIR)) {
  if (id.startsWith('.') || id.startsWith('_')) continue
  const mp = join(FAMILIES_DIR, id, 'manifest.json')
  if (!existsSync(mp)) continue
  try {
    const m = JSON.parse(readFileSync(mp, 'utf8'))
    const kw = [
      ...(m.tieredKeywords?.tier1 ?? []),
      ...(m.tieredKeywords?.tier2 ?? []),
      ...(m.keywords ?? []),
      ...(m.tags ?? []),
    ].map((k) => String(k).toLowerCase())
    families[id] = {
      keywords: new Set(kw),
      taxonomy: m.taxonomy ?? {},
    }
  } catch {
    /* skip malformed */
  }
}

if (Object.keys(families).length === 0) {
  console.error('no families found at', FAMILIES_DIR)
  process.exit(2)
}

// ── Load buildout traces ─────────────────────────────────────────────
if (!existsSync(TRACES)) {
  console.error('no buildouts trace at', TRACES)
  process.exit(2)
}

const lines = readFileSync(TRACES, 'utf8').split('\n').filter(Boolean)
const scenarios = new Map() // scenarioId → { partner, promptHead, count }
for (const line of lines) {
  try {
    const r = JSON.parse(line)
    if (!r.scenarioId) continue
    const prev = scenarios.get(r.scenarioId)
    if (prev) {
      prev.count += 1
    } else {
      scenarios.set(r.scenarioId, {
        scenarioId: r.scenarioId,
        partner: r.partnerGuess ?? null,
        promptHead: String(r.initialPrompt ?? '').slice(0, 400),
        count: 1,
      })
    }
  } catch {
    /* skip malformed */
  }
}

// ── Score each scenario's coverage ───────────────────────────────────
const gaps = []
for (const s of scenarios.values()) {
  if (s.count < MIN_COUNT) continue
  const tokens = [...new Set([...tokenize(s.scenarioId), ...tokenize(s.partner)])]
  const candidates = []
  for (const [fid, fam] of Object.entries(families)) {
    let hits = 0
    for (const t of tokens) {
      for (const kw of fam.keywords) {
        if (kw === t || kw.includes(t) || t.includes(kw)) {
          hits += 1
          break
        }
      }
    }
    if (hits > 0) candidates.push({ fid, hits })
  }
  candidates.sort((a, b) => b.hits - a.hits)
  const bestHits = candidates[0]?.hits ?? 0

  // Gap score: weak match + repeat occurrences = higher priority.
  // bestHits=0 → 1.0 floor. bestHits=1 → 0.6 (might be weak match).
  // bestHits≥2 → 0.2 (probably covered).
  const coverageScore = bestHits === 0 ? 1.0 : bestHits === 1 ? 0.6 : 0.2
  const demandScore = Math.min(1, s.count / 5) // 5+ occurrences = max demand
  const priority = coverageScore * 0.6 + demandScore * 0.4

  gaps.push({
    scenarioId: s.scenarioId,
    partner: s.partner,
    occurrences: s.count,
    tokens,
    bestMatch: candidates[0] ?? null,
    coverageScore,
    demandScore,
    priority,
    promptHead: s.promptHead,
  })
}

gaps.sort((a, b) => b.priority - a.priority)
const top = gaps.slice(0, TOP_N)

// ── Emit proposer-shaped candidates ──────────────────────────────────
// Convert each gap into a (id, description, taxonomy, cues) bundle the
// proposer can consume directly. Taxonomy guessing uses simple heuristics
// over the prompt head; the proposer's RLM loop is tolerant of weak
// guesses (it'll refine).
function proposeInputFor(gap) {
  const id = gap.scenarioId
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()
    .slice(0, 40)
  const head = gap.promptHead.toLowerCase()
  // Language/runtime/surface guessing — defensive, proposer can override.
  const language = /\brust\b|cargo|tokio/.test(head)
    ? 'rust'
    : /\bpython\b|pytorch|numpy|pip install/.test(head)
    ? 'python'
    : /\bgo\b|go\s+mod|gopath/.test(head)
    ? 'go'
    : 'typescript'
  const surface = /\bdashboard|mint page|swap|ui|frontend|react|next\b/.test(head)
    ? 'frontend'
    : /\bapi|endpoint|rest|graphql\b/.test(head)
    ? 'api'
    : /\bcli|command-line/.test(head)
    ? 'cli'
    : /\bpipeline|job|worker|agent\b/.test(head)
    ? 'agent'
    : 'frontend'
  const runtime = language === 'rust'
    ? 'cargo'
    : language === 'python'
    ? 'python'
    : language === 'go'
    ? 'go'
    : /\bbun\b/.test(head)
    ? 'bun'
    : /\bdeno\b/.test(head)
    ? 'deno'
    : /cloudflare.?worker|cf\s+worker/.test(head)
    ? 'cloudflare-worker'
    : 'node'
  const description = `${gap.scenarioId} starter — derived from ${gap.occurrences}× real demand signal${
    gap.partner ? ` (partner: ${gap.partner})` : ''
  }. Taxonomy guess: ${language}/${runtime}/${surface}.`
  return {
    id,
    description,
    taxonomy: { language, runtime, surface },
    priority: gap.priority,
    reason: gap.bestMatch
      ? `nearest family ${gap.bestMatch.fid} has only ${gap.bestMatch.hits} token overlap`
      : 'no family has any keyword overlap',
    occurrences: gap.occurrences,
    partner: gap.partner,
    tokens: gap.tokens,
    cues: [
      `Real user demand: this pattern occurred ${gap.occurrences}× in buildout traces`,
      ...(gap.partner ? [`Associated partner: ${gap.partner}`] : []),
    ],
  }
}

const candidates = top.map(proposeInputFor)

if (JSON_OUT) {
  console.log(JSON.stringify({ topN: TOP_N, minCount: MIN_COUNT, candidates }, null, 2))
} else {
  console.log(`\n━━━━ Top ${TOP_N} family-proposal candidates ━━━━`)
  console.log(`(from ${scenarios.size} scenarios in ${TRACES}, against ${Object.keys(families).length} registered families)\n`)
  for (const c of candidates) {
    console.log(`  priority=${c.priority.toFixed(2)}  id=${c.id}`)
    console.log(`    occ=${c.occurrences} partner=${c.partner ?? '(none)'} taxonomy=${c.taxonomy.language}/${c.taxonomy.runtime}/${c.taxonomy.surface}`)
    console.log(`    reason: ${c.reason}`)
    console.log(`    desc: ${c.description}`)
    console.log('')
  }
  console.log('To propose one:')
  console.log(`  pnpm propose:family --rlm --id <id> --description "<desc>" --language <lang> --runtime <rt> --surface <sfc>`)
  console.log('')
  console.log('Or drive all via (nightly):')
  console.log('  node scripts/detect-family-gaps.ts --json | node scripts/propose-family-candidates.ts')
}
