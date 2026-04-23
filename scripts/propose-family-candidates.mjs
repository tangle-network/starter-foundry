#!/usr/bin/env node
// Gap-driven proposer — consumes detect-family-gaps JSON output and drives
// the RLM proposer for each candidate. This is the nightly "expand the
// registry from real demand" entrypoint.
//
// Usage:
//   node scripts/detect-family-gaps.mjs --json --top 3 | node scripts/propose-family-candidates.mjs
//   node scripts/propose-family-candidates.mjs --top 3
//   node scripts/propose-family-candidates.mjs --max-shots 2 --top 1 --dry-run
//
// Emits event records to .evolve/generation-impact.jsonl shared with the
// promoter — schema is `{ ts, event: 'proposed' | 'proposed-failed', id, ... }`
// so refresh-scorecard.mjs can compute the proposer→promoter funnel.
//
// The proposer is I/O-heavy (LLM calls). By default we serialize to avoid
// rate limits; use --parallel to run concurrently if your provider allows.

import { appendFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { proposeFamilyWithRLMToDisk } from '../dist/training/family_proposer/propose.js'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const IMPACT_LOG = join(REPO, '.evolve/generation-impact.jsonl')

const argv = process.argv.slice(2)
const arg = (flag, fallback) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : fallback
}
const MAX_SHOTS = Number(arg('--max-shots', '2')) || 2
const TOP_N = Number(arg('--top', '3')) || 3
const DRY_RUN = argv.includes('--dry-run')
const PARALLEL = argv.includes('--parallel')
const EXPERIMENT_ID = arg('--experiment', `family-proposer-${new Date().toISOString().slice(0, 10)}`)

function logRun(entry) {
  appendFileSync(IMPACT_LOG, JSON.stringify(entry) + '\n')
}

// ── Collect candidates ───────────────────────────────────────────────
// Two sources: stdin JSON (from detect-family-gaps --json) or invoke it.
let candidates
async function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('')
    let data = ''
    process.stdin.on('data', (c) => (data += c))
    process.stdin.on('end', () => resolve(data))
  })
}
const stdinRaw = await readStdin()
if (stdinRaw.trim().length > 0) {
  try {
    const parsed = JSON.parse(stdinRaw)
    candidates = parsed.candidates ?? []
  } catch (err) {
    console.error('failed to parse stdin JSON:', err.message)
    process.exit(2)
  }
} else {
  const res = spawnSync('node', ['scripts/detect-family-gaps.mjs', '--json', '--top', String(TOP_N)], {
    cwd: REPO,
    encoding: 'utf8',
  })
  if (res.status !== 0) {
    console.error('detect-family-gaps failed:', res.stderr)
    process.exit(2)
  }
  candidates = JSON.parse(res.stdout).candidates ?? []
}
candidates = candidates.slice(0, TOP_N)

if (candidates.length === 0) {
  console.log('propose-family-candidates: no gap candidates')
  process.exit(0)
}

console.log(`Proposing ${candidates.length} family candidates (max-shots=${MAX_SHOTS}, experiment=${EXPERIMENT_ID})`)
for (const c of candidates) {
  console.log(`  - ${c.id} (priority=${c.priority.toFixed(2)}, ${c.reason})`)
}

if (DRY_RUN) {
  console.log('\n--dry-run — not invoking proposer')
  process.exit(0)
}

// ── Drive the proposer ───────────────────────────────────────────────
async function proposeOne(c) {
  const t0 = Date.now()
  try {
    const proposal = await proposeFamilyWithRLMToDisk(
      {
        id: c.id,
        description: c.description,
        taxonomy: c.taxonomy,
        productCues: c.cues ?? [],
      },
      { maxShots: MAX_SHOTS },
    )
    const durationMs = Date.now() - t0
    logRun({
      ts: new Date().toISOString(),
      event: 'proposed',
      id: c.id,
      experimentId: EXPERIMENT_ID,
      mode: proposal.mode,
      templateFileCount: proposal.templateFiles.length,
      peerFamilies: proposal.peerFamilies,
      priority: c.priority,
      occurrences: c.occurrences,
      taxonomy: c.taxonomy,
      durationMs,
    })
    console.log(
      `  ✓ ${c.id}: mode=${proposal.mode} files=${proposal.templateFiles.length} dir=${proposal.proposalDir}`,
    )
    return { id: c.id, ok: true, mode: proposal.mode, durationMs }
  } catch (err) {
    const durationMs = Date.now() - t0
    logRun({
      ts: new Date().toISOString(),
      event: 'proposed-failed',
      id: c.id,
      experimentId: EXPERIMENT_ID,
      priority: c.priority,
      occurrences: c.occurrences,
      taxonomy: c.taxonomy,
      durationMs,
      error: String(err?.message ?? err),
    })
    console.error(`  ✗ ${c.id}: ${err?.message ?? err}`)
    return { id: c.id, ok: false, error: String(err?.message ?? err), durationMs }
  }
}

const results = []
if (PARALLEL) {
  const all = await Promise.all(candidates.map(proposeOne))
  results.push(...all)
} else {
  for (const c of candidates) {
    results.push(await proposeOne(c))
  }
}

const ok = results.filter((r) => r.ok).length
console.log(`\nPropose complete: ${ok}/${results.length} drafts written`)
console.log(`Next: run \`node scripts/promote-family-proposal.mjs --all\` to validate + promote.`)
