#!/usr/bin/env node
// Family proposer driver — agentic by default, RLM fallback on --mode=rlm.
//
// Mirrors scripts/propose-capability-candidates.mjs; see that file for the
// design rationale. Families own the root of a project (package.json,
// tsconfig, entrypoint) — higher blast radius than capabilities — so we
// default to enforcing the scaffold-runs gate on the agentic path via
// --full-boot off by default but strongly recommended in nightly runs.
//
// Usage:
//   node scripts/detect-family-gaps.mjs --json --top 3 \
//     | node scripts/propose-family-candidates.mjs
//   node scripts/propose-family-candidates.mjs --mode=rlm --max-shots 2
//   node scripts/propose-family-candidates.mjs --full-boot      # enable scaffold-runs

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  buildAgentProfile,
  buildFamilyBrief,
  buildFamilyCriteria,
  commitDraft,
  createScratchWorkspace,
  dispatchAgenticProposal,
  logImpactEvent,
  parseArg,
  readStdin,
  writeBlocker,
} from './_lib/agentic-proposer.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const IMPACT_LOG = join(REPO, '.evolve/generation-impact.jsonl')
const PROPOSALS_DIR = join(REPO, '.evolve/family-proposals')

const argv = process.argv.slice(2)
const MODE = parseArg(argv, '--mode', 'agent')
const MAX_ITER = Number(parseArg(argv, '--max-iterations', '8')) || 8
const WALL_SEC = Number(parseArg(argv, '--wall-sec', '900')) || 900
const USD = Number(parseArg(argv, '--usd', '2.00')) || 2.00
const MAX_SHOTS = Number(parseArg(argv, '--max-shots', '2')) || 2
const TOP_N = Number(parseArg(argv, '--top', '3')) || 3
const DRY_RUN = argv.includes('--dry-run')
const PARALLEL = argv.includes('--parallel')
const FULL_BOOT = argv.includes('--full-boot')
const EXPERIMENT_ID = parseArg(argv, '--experiment', `family-proposer-${new Date().toISOString().slice(0, 10)}`)

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

console.log(
  `Proposing ${candidates.length} family candidates ` +
    `(mode=${MODE}, max-iter=${MAX_ITER}, wall=${WALL_SEC}s, usd=$${USD}, experiment=${EXPERIMENT_ID})`,
)
for (const c of candidates) {
  console.log(`  - ${c.id} (priority=${(c.priority ?? 0).toFixed(2)}, ${c.reason ?? c.description ?? ''})`)
}

if (DRY_RUN) {
  console.log('\n--dry-run — not invoking proposer')
  process.exit(0)
}

async function run() {
  const results = []
  if (PARALLEL && MODE === 'rlm') {
    const all = await Promise.all(candidates.map((c) => proposeViaRLM(c)))
    results.push(...all)
  } else {
    // Agentic mode intentionally runs serially — sandbox bridges rate-limit
    // concurrent sessions and we want deterministic log ordering.
    for (const c of candidates) {
      results.push(MODE === 'rlm' ? await proposeViaRLM(c) : await proposeViaAgent(c))
    }
  }

  const ok = results.filter((r) => r.ok).length
  console.log(`\nPropose complete: ${ok}/${results.length} drafts written`)
  console.log(`Next: run \`node scripts/promote-family-proposal.mjs --all\` to validate + promote.`)
}

await run()

// ────────────────────────────────────────────────────────────────────
// Agentic path
// ────────────────────────────────────────────────────────────────────

async function proposeViaAgent(c) {
  const t0 = Date.now()
  const scratchDir = createScratchWorkspace('family-proposer-')
  const destDir = join(PROPOSALS_DIR, c.id)

  try {
    const gatesPath = join(REPO, 'dist/lib/promoter-gates.js')
    if (!existsSync(gatesPath)) {
      throw new Error(
        `dist/lib/promoter-gates.js missing — run \`pnpm build\` first. ` +
          `The agentic proposer's criteria depend on the compiled promoter gates.`,
      )
    }
    const gates = await import(gatesPath)

    const peerFamilies = loadPeerFamilies(c.taxonomy ?? {}, 3)
    const brief = buildFamilyBrief({
      candidate: c,
      workspaceDir: scratchDir,
      peerFamilies,
      repoRoot: REPO,
    })
    const criteria = buildFamilyCriteria({ gates, fullBoot: FULL_BOOT })
    const profile = buildAgentProfile({
      name: `family-proposer-${c.id}`,
      systemPrompt:
        'You are the family proposer agent for starter-foundry. You scaffold a new family ' +
        '(project root: package.json, tsconfig, entrypoint) by reading reference families and ' +
        'writing the draft into the mounted workspace. Self-verify with the completion criteria ' +
        "the promoter will run. Never emit TODO/FIXME. Never declare a dep you don't import. " +
        'On criterion failure, fix the underlying issue and retry.',
    })

    const { result, iterations, criterionOutcomes } = await dispatchAgenticProposal({
      candidate: c,
      brief,
      profile,
      criteria,
      budget: { iterations: MAX_ITER, wallSec: WALL_SEC, usd: USD },
      workspaceDir: scratchDir,
      onEvent: (ev) => {
        if (ev.type === 'iteration.complete') {
          logImpactEvent(IMPACT_LOG, {
            event: 'family-proposer-iteration',
            id: c.id,
            experimentId: EXPERIMENT_ID,
            iteration: ev.iteration,
            mode: 'agent',
          })
        }
        if (ev.type === 'criterion.check') {
          logImpactEvent(IMPACT_LOG, {
            event: 'family-proposer-criterion',
            id: c.id,
            experimentId: EXPERIMENT_ID,
            iteration: ev.iteration,
            name: ev.name,
            ok: ev.ok,
            reason: ev.reason,
            mode: 'agent',
          })
        }
      },
    })

    const durationMs = Date.now() - t0

    if (result.verdict === 'verified') {
      commitDraft({ scratchDir, destDir })
      logImpactEvent(IMPACT_LOG, {
        event: 'proposed',
        id: c.id,
        experimentId: EXPERIMENT_ID,
        mode: 'agent',
        iterations: result.iterations,
        wallMs: result.wallMs,
        usd: result.usd,
        priority: c.priority,
        occurrences: c.occurrences,
        taxonomy: c.taxonomy,
        durationMs,
        criterionOutcomes,
      })
      console.log(`  ✓ ${c.id}: verified in ${iterations} iter (${durationMs}ms) → ${destDir}`)
      return { id: c.id, ok: true, mode: 'agent', durationMs, iterations }
    }

    mkdirSync(destDir, { recursive: true })
    writeBlocker({ destDir, result })
    logImpactEvent(IMPACT_LOG, {
      event: 'proposed-failed',
      id: c.id,
      experimentId: EXPERIMENT_ID,
      mode: 'agent',
      verdict: result.verdict,
      blockedBy: result.blockedBy,
      iterations: result.iterations,
      wallMs: result.wallMs,
      usd: result.usd,
      priority: c.priority,
      occurrences: c.occurrences,
      taxonomy: c.taxonomy,
      durationMs,
      criterionOutcomes,
      error: result.error,
    })
    console.error(
      `  ✗ ${c.id}: ${result.verdict} (blockedBy=${result.blockedBy ?? 'n/a'}, iter=${result.iterations}) → ${destDir}/blocker.md`,
    )
    return { id: c.id, ok: false, mode: 'agent', durationMs, verdict: result.verdict }
  } catch (err) {
    const durationMs = Date.now() - t0
    logImpactEvent(IMPACT_LOG, {
      event: 'proposed-failed',
      id: c.id,
      experimentId: EXPERIMENT_ID,
      mode: 'agent',
      verdict: 'error',
      priority: c.priority,
      occurrences: c.occurrences,
      taxonomy: c.taxonomy,
      durationMs,
      error: String(err?.message ?? err),
    })
    console.error(`  ✗ ${c.id} (agent dispatch error): ${err?.message ?? err}`)
    return { id: c.id, ok: false, mode: 'agent', durationMs, error: String(err?.message ?? err) }
  } finally {
    if (!process.env.KEEP_SCRATCH) {
      try { rmSync(scratchDir, { recursive: true, force: true }) } catch { /* noop */ }
    }
  }
}

// ────────────────────────────────────────────────────────────────────
// RLM fallback — original logic preserved
// ────────────────────────────────────────────────────────────────────

async function proposeViaRLM(c) {
  const t0 = Date.now()
  try {
    const { proposeFamilyWithRLMToDisk } = await import('../dist/training/family_proposer/propose.js')
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
    logImpactEvent(IMPACT_LOG, {
      event: 'proposed',
      id: c.id,
      experimentId: EXPERIMENT_ID,
      mode: `rlm-${proposal.mode}`,
      templateFileCount: proposal.templateFiles.length,
      peerFamilies: proposal.peerFamilies,
      priority: c.priority,
      occurrences: c.occurrences,
      taxonomy: c.taxonomy,
      durationMs,
    })
    console.log(`  ✓ ${c.id}: mode=${proposal.mode} files=${proposal.templateFiles.length} dir=${proposal.proposalDir}`)
    return { id: c.id, ok: true, mode: `rlm-${proposal.mode}`, durationMs }
  } catch (err) {
    const durationMs = Date.now() - t0
    logImpactEvent(IMPACT_LOG, {
      event: 'proposed-failed',
      id: c.id,
      experimentId: EXPERIMENT_ID,
      mode: 'rlm',
      priority: c.priority,
      occurrences: c.occurrences,
      taxonomy: c.taxonomy,
      durationMs,
      error: String(err?.message ?? err),
    })
    console.error(`  ✗ ${c.id}: ${err?.message ?? err}`)
    return { id: c.id, ok: false, mode: 'rlm', durationMs, error: String(err?.message ?? err) }
  }
}

// ────────────────────────────────────────────────────────────────────
// Peer-family discovery — by taxonomy.language + .runtime overlap
// ────────────────────────────────────────────────────────────────────

function loadPeerFamilies(taxonomy, limit) {
  const root = join(REPO, 'registry/families')
  if (!existsSync(root)) return []
  const rows = []
  for (const id of readdirSync(root)) {
    if (id.startsWith('.') || id.startsWith('_')) continue
    const mp = join(root, id, 'manifest.json')
    if (!existsSync(mp)) continue
    try {
      const m = JSON.parse(readFileSync(mp, 'utf8'))
      rows.push({ id: m.id, taxonomy: m.taxonomy ?? {} })
    } catch { /* skip malformed */ }
  }
  return rows
    .map((r) => {
      let score = 0
      if (r.taxonomy.language && r.taxonomy.language === taxonomy.language) score += 2
      if (r.taxonomy.runtime && r.taxonomy.runtime === taxonomy.runtime) score += 1
      if (r.taxonomy.surface && r.taxonomy.surface === taxonomy.surface) score += 1
      return { r, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ r }) => r.id)
}
