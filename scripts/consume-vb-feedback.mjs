#!/usr/bin/env node
// consume-vb-feedback — augment any vibecoder/blueprint-agent's
// vertical-bench output with scaffold-side attribution. Reads sessions
// produced by ANY consumer that follows the BA layout:
//
//   <source>/<gen>/<variant>/<runId>/
//     manifest.json          { leafId, verticalId, outcome, ... }
//     scaffold-compose.json  { family, layers, partner, fileCount }
//     verification-shot-N.json { layers: [{layer, status, findings: []}] }
//
// For each leaf, attribute failure to:
//   - routing-error    : SF picked the wrong family/no family
//   - scaffold-gap     : SF's scaffold composed but agent failed at a
//                        layer that points to missing scaffold content
//                        (e.g. install fail = missing dep, typecheck
//                        fail on agent-untouched file = scaffold typo)
//   - agent-error      : scaffold was sound; agent's edits broke it
//   - unknown          : no signal to attribute
//
// Emit:
//   .evolve/vb-feedback/<consumer>-<gen>.json   (per-run rollup)
//   .evolve/vb-feedback/scorecard.json          (latest aggregate)
//
// Usage:
//   node scripts/consume-vb-feedback.mjs \
//     --source ~/webb/blueprint-agent/scripts/experiments/results/sessions \
//     --consumer blueprint-agent \
//     --since-gen 40
//
// Pluggable: --source can point at any consumer's session output. The
// shape is the contract; BA is the first consumer not the contract.

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const FEEDBACK_DIR = join(REPO, '.evolve/vb-feedback')

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}

const SOURCE = arg('source')
const CONSUMER = arg('consumer', 'unknown')
const SINCE_GEN = Number(arg('since-gen', '0'))
const DRY_RUN = process.argv.includes('--dry-run')
const QUIET = process.argv.includes('--quiet')

if (!SOURCE) {
  console.error('Usage: consume-vb-feedback --source <path> [--consumer <name>] [--since-gen N] [--dry-run]')
  process.exit(2)
}
if (!existsSync(SOURCE)) {
  console.error(`source not found: ${SOURCE}`)
  process.exit(2)
}

// ── readers ──────────────────────────────────────────────────────────

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

function listSessions(root) {
  // Walk root → gen-or-variant → runId. Tolerate either flat (variant
  // dirs at top) or nested (gen / variant) layouts. A "session dir" is
  // any dir that contains manifest.json.
  const sessions = []
  const walk = (dir, depth) => {
    let entries
    try { entries = readdirSync(dir) } catch { return }
    for (const entry of entries) {
      const sub = join(dir, entry)
      let st
      try { st = statSync(sub) } catch { continue }
      if (!st.isDirectory()) continue
      if (existsSync(join(sub, 'manifest.json'))) {
        sessions.push(sub)
      } else if (depth < 4) {
        walk(sub, depth + 1)
      }
    }
  }
  walk(root, 0)
  return sessions
}

// ── attribution ──────────────────────────────────────────────────────

/**
 * Given a session directory, classify whether the failure (if any) is
 * SF's scaffold's responsibility, the agent's, or unknown. Returns
 * { leafId, verticalId, generation, scaffold, outcome, attribution, signals }.
 *
 * Attribution heuristics (deliberate, conservative — only attribute
 * scaffold-gap when there's POSITIVE signal pointing at the scaffold,
 * not just absence of agent signal):
 *
 *   1. scaffold-compose.json missing or available=false
 *      → routing-error (SF couldn't compose for this leaf)
 *
 *   2. scaffold-compose.family === null AND outcome != 'satisfied'
 *      → routing-error (free-text leaf, SF didn't pick a family)
 *
 *   3. verification's first layer (install) failed AND agent made 0 edits
 *      to package.json → scaffold-gap (the scaffold's deps don't install)
 *
 *   4. verification's lint/typecheck failed on a layer with a finding
 *      mentioning a file the scaffold ships verbatim (untouched by agent)
 *      → scaffold-gap. Approximated here by "first verification's
 *      install passed but typecheck/build/lint failed on shot 1" —
 *      shot 1 is the agent's first attempt; failures there often
 *      reflect scaffold quality more than agent mistakes. NOTE: this
 *      heuristic is approximate; refine with edit-trace integration.
 *
 *   5. outcome === 'satisfied' OR final verification allPass → no failure
 *
 *   6. anything else → agent-error (scaffold composed, agent broke it)
 */
function attribute(sessionDir) {
  const manifest = readJson(join(sessionDir, 'manifest.json'))
  if (!manifest) return null

  const scaffold = readJson(join(sessionDir, 'scaffold-compose.json'))
  const verifyShots = readdirSync(sessionDir)
    .filter((f) => /^verification-shot-\d+\.json$/.test(f))
    .sort()
    .map((f) => readJson(join(sessionDir, f)))
    .filter(Boolean)

  const lastVerify = verifyShots[verifyShots.length - 1]
  const firstVerify = verifyShots[0]
  const passed = lastVerify?.allPass === true || manifest.outcome === 'satisfied'

  // Default to unknown; promote to a more specific bucket below.
  let attribution = 'unknown'
  const signals = []

  if (passed) {
    attribution = 'pass'
    signals.push('outcome=satisfied or allPass')
  } else if (!scaffold || scaffold.available === false) {
    attribution = 'routing-error'
    signals.push('scaffold-compose unavailable: ' + (scaffold?.error ?? 'no scaffold-compose.json'))
  } else if (scaffold.family === null && (manifest.outcome === 'failed' || manifest.outcome === 'unknown')) {
    attribution = 'routing-error'
    signals.push('scaffold-compose returned family=null on a non-satisfied outcome (free-text routing miss)')
  } else if (firstVerify) {
    const install = firstVerify.layers?.find((l) => l.layer === 'install')
    const typecheck = firstVerify.layers?.find((l) => l.layer === 'typecheck')
    const build = firstVerify.layers?.find((l) => l.layer === 'build')
    const lint = firstVerify.layers?.find((l) => l.layer === 'lint')

    if (install?.status === 'fail') {
      attribution = 'scaffold-gap'
      signals.push('install failed on shot 1 — scaffold deps did not install')
    } else if (typecheck?.status === 'fail' && verifyShots.length === 1) {
      // First-shot typecheck fail = often scaffold typo; multi-shot
      // typecheck fail = agent broke it. Conservative: only first-shot.
      attribution = 'scaffold-gap'
      signals.push('shot-1 typecheck failed before agent had edit budget — likely scaffold-side TS error')
    } else if (build?.status === 'fail' || lint?.status === 'fail' || typecheck?.status === 'fail') {
      attribution = 'agent-error'
      signals.push('verification failed on layer the agent had time to fix — agent-side')
    } else {
      attribution = 'unknown'
      signals.push('verification did not surface a clear bottleneck')
    }
  }

  return {
    leafId: manifest.leafId,
    verticalId: manifest.verticalId,
    generation: manifest.generation,
    runId: manifest.runId,
    outcome: manifest.outcome,
    wallMs: manifest.wallMs,
    completenessScore: manifest.extra?.completenessScore ?? null,
    previewSucceeded: manifest.extra?.previewSucceeded ?? null,
    scaffold: scaffold ? {
      available: scaffold.available !== false,
      family: scaffold.family,
      layers: scaffold.layers ?? [],
      partner: scaffold.partner,
      fileCount: scaffold.fileCount,
      sfVersion: scaffold.starterFoundryVersion,
    } : null,
    attribution,
    signals,
  }
}

// ── main ─────────────────────────────────────────────────────────────

const sessions = listSessions(SOURCE)
if (!QUIET) console.error(`scanning ${sessions.length} session dirs under ${SOURCE}`)

const results = []
for (const dir of sessions) {
  const r = attribute(dir)
  if (!r) continue
  if (r.generation < SINCE_GEN) continue
  results.push(r)
}

const buckets = { 'pass': 0, 'routing-error': 0, 'scaffold-gap': 0, 'agent-error': 0, 'unknown': 0 }
for (const r of results) buckets[r.attribution] = (buckets[r.attribution] ?? 0) + 1

const totalNonPass = results.length - buckets.pass
const scaffoldAttributable = buckets['routing-error'] + buckets['scaffold-gap']
const scaffoldAttributableRate = totalNonPass > 0 ? scaffoldAttributable / totalNonPass : 0

const summary = {
  consumer: CONSUMER,
  source: SOURCE,
  generatedAt: new Date().toISOString(),
  sinceGen: SINCE_GEN,
  totalSessions: results.length,
  buckets,
  scaffoldAttributableNonPass: scaffoldAttributable,
  totalNonPass,
  scaffoldAttributableRate: Number(scaffoldAttributableRate.toFixed(4)),
  topScaffoldGaps: results
    .filter((r) => r.attribution === 'scaffold-gap')
    .reduce((acc, r) => {
      const k = `${r.scaffold?.family ?? 'no-family'}/${r.verticalId}`
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {}),
  topRoutingErrors: results
    .filter((r) => r.attribution === 'routing-error')
    .reduce((acc, r) => {
      const k = r.verticalId ?? 'no-vertical'
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {}),
}

if (DRY_RUN) {
  console.log(JSON.stringify(summary, null, 2))
  process.exit(0)
}

mkdirSync(FEEDBACK_DIR, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const detailPath = join(FEEDBACK_DIR, `${CONSUMER}-${stamp}.jsonl`)
writeFileSync(detailPath, results.map((r) => JSON.stringify(r)).join('\n') + '\n')

const summaryPath = join(FEEDBACK_DIR, `${CONSUMER}-${stamp}.json`)
writeFileSync(summaryPath, JSON.stringify(summary, null, 2))

const latestPath = join(FEEDBACK_DIR, 'latest.json')
writeFileSync(latestPath, JSON.stringify(summary, null, 2))

console.log([
  `consumer=${CONSUMER}`,
  `sessions=${results.length}`,
  `pass=${buckets.pass}`,
  `routing-error=${buckets['routing-error']}`,
  `scaffold-gap=${buckets['scaffold-gap']}`,
  `agent-error=${buckets['agent-error']}`,
  `unknown=${buckets.unknown}`,
  `scaffoldAttributableRate=${(scaffoldAttributableRate * 100).toFixed(1)}%`,
].join(' '))
