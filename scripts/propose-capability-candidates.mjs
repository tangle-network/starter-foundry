#!/usr/bin/env node
// Gen-6 R6: capability proposer driver — mirrors propose-family-candidates.mjs.
//
// Consumes detect-capability-gaps JSON output (or invokes it) and runs the
// RLM capability proposer for each. Emits `event: 'capability-proposed'` or
// `'capability-proposed-failed'` into .evolve/generation-impact.jsonl so the
// scorecard and nightly automation can track the capability funnel the same
// way they track families.
//
// Usage:
//   node scripts/detect-capability-gaps.mjs --json --top 3 \
//     | node scripts/propose-capability-candidates.mjs
//   node scripts/propose-capability-candidates.mjs --max-shots 2 --top 1 --dry-run

import { appendFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { proposeCapabilityWithRLMToDisk } from '../dist/training/capability_proposer/propose.js'

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
const EXPERIMENT_ID = arg('--experiment', `capability-proposer-${new Date().toISOString().slice(0, 10)}`)

function logRun(entry) {
  appendFileSync(IMPACT_LOG, JSON.stringify(entry) + '\n')
}

async function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('')
    let data = ''
    process.stdin.on('data', (c) => (data += c))
    process.stdin.on('end', () => resolve(data))
  })
}

let candidates
const stdinRaw = await readStdin()
if (stdinRaw.trim().length > 0) {
  try {
    candidates = JSON.parse(stdinRaw).candidates ?? []
  } catch (err) {
    console.error('failed to parse stdin JSON:', err.message)
    process.exit(2)
  }
} else {
  const res = spawnSync('node', ['scripts/detect-capability-gaps.mjs', '--json', '--top', String(TOP_N)], {
    cwd: REPO,
    encoding: 'utf8',
  })
  if (res.status !== 0) {
    console.error('detect-capability-gaps failed:', res.stderr)
    process.exit(2)
  }
  candidates = JSON.parse(res.stdout).candidates ?? []
}
candidates = candidates.slice(0, TOP_N)

if (candidates.length === 0) {
  console.log('propose-capability-candidates: no gap candidates')
  process.exit(0)
}

console.log(`Proposing ${candidates.length} capability candidates (max-shots=${MAX_SHOTS}, experiment=${EXPERIMENT_ID})`)
for (const c of candidates) {
  console.log(`  - ${c.id} (priority=${c.priority.toFixed(2)}, appliesTo=${c.appliesTo.join(',')})`)
}

if (DRY_RUN) {
  console.log('\n--dry-run — not invoking proposer')
  process.exit(0)
}

async function proposeOne(c) {
  const t0 = Date.now()
  try {
    const proposal = await proposeCapabilityWithRLMToDisk(
      {
        id: c.id,
        description: c.description,
        appliesTo: c.appliesTo,
        slotFiles: c.slotFiles,
        productCues: c.productCues ?? [],
      },
      { maxShots: MAX_SHOTS },
    )
    const durationMs = Date.now() - t0
    logRun({
      ts: new Date().toISOString(),
      event: 'capability-proposed',
      id: c.id,
      experimentId: EXPERIMENT_ID,
      mode: proposal.mode,
      templateFileCount: proposal.templateFiles.length,
      peerCapabilities: proposal.peerCapabilities,
      priority: c.priority,
      occurrences: c.occurrences,
      appliesTo: c.appliesTo,
      durationMs,
    })
    console.log(`  ✓ ${c.id}: mode=${proposal.mode} files=${proposal.templateFiles.length} dir=${proposal.proposalDir}`)
    return { id: c.id, ok: true, mode: proposal.mode, durationMs }
  } catch (err) {
    const durationMs = Date.now() - t0
    logRun({
      ts: new Date().toISOString(),
      event: 'capability-proposed-failed',
      id: c.id,
      experimentId: EXPERIMENT_ID,
      priority: c.priority,
      appliesTo: c.appliesTo,
      durationMs,
      error: String(err?.message ?? err),
    })
    console.error(`  ✗ ${c.id}: ${err?.message ?? err}`)
    return { id: c.id, ok: false, error: String(err?.message ?? err), durationMs }
  }
}

const results = []
for (const c of candidates) {
  results.push(await proposeOne(c))
}

const ok = results.filter((r) => r.ok).length
console.log(`\nCapability propose complete: ${ok}/${results.length} drafts written`)
console.log(`Next: run \`node scripts/promote-capability-proposal.mjs --all\` to validate + promote.`)
