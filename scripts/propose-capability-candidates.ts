#!/usr/bin/env node
// Capability proposer driver — agentic by default, RLM fallback on --mode=rlm.
//
// Agentic path (default):
//   For each gap candidate, dispatch through `@tangle-network/tcloud-agent`'s
//   Agent run-loop primitive. The agent gets a sandboxed workspace, a rich
//   brief, and completion criteria that mirror the promoter's Gen 9 dogfood
//   gates. It iterates up to 8 times within a 15min / $2 budget, self-
//   verifying each draft before writing. On verified, we copy the scratch
//   workspace into `.evolve/capability-proposals/<id>/`. On blocked / budget-
//   exhausted / error, we still persist a `blocker.md` so a human can see
//   what the agent got stuck on.
//
// RLM path (--mode=rlm):
//   Routes through the original `proposeCapabilityWithRLMToDisk` code path.
//   Kept live as an escape hatch for environments without the sandbox bridge
//   (no unlock token, bridge offline, CI) AND for empirical comparison in
//   nightly runs — the two modes land drafts in the same dir under different
//   `mode` tags on the impact-log event so the scorecard can A/B them.
//
// Usage:
//   node scripts/detect-capability-gaps.ts --json --top 3 \
//     | node scripts/propose-capability-candidates.ts
//   node scripts/propose-capability-candidates.ts --max-iterations 8 --top 1
//   node scripts/propose-capability-candidates.ts --mode=rlm --max-shots 2
//   node scripts/propose-capability-candidates.ts --full-boot   # enable scaffold-runs gate

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  buildAgentProfile,
  buildCapabilityBrief,
  buildCapabilityCriteria,
  commitDraft,
  createScratchWorkspace,
  dispatchAgenticProposal,
  logImpactEvent,
  parseArg,
  readStdin,
  writeBlocker,
} from './_lib/agentic-proposer.ts'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const IMPACT_LOG = join(REPO, '.evolve/generation-impact.jsonl')
const PROPOSALS_DIR = join(REPO, '.evolve/capability-proposals')

const argv = process.argv.slice(2)
const MODE = parseArg(argv, '--mode', 'agent') // 'agent' | 'rlm'
const MAX_ITER = Number(parseArg(argv, '--max-iterations', '8')) || 8
const WALL_SEC = Number(parseArg(argv, '--wall-sec', '900')) || 900
const USD = Number(parseArg(argv, '--usd', '2.00')) || 2.0
const MAX_SHOTS = Number(parseArg(argv, '--max-shots', '2')) || 2
const TOP_N = Number(parseArg(argv, '--top', '3')) || 3
const DRY_RUN = argv.includes('--dry-run')
const FULL_BOOT = argv.includes('--full-boot')
const EXPERIMENT_ID = parseArg(
  argv,
  '--experiment',
  `capability-proposer-${new Date().toISOString().slice(0, 10)}`,
)

// ── Collect candidates ──────────────────────────────────────────────
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
  const res = spawnSync(
    'node',
    ['scripts/detect-capability-gaps.ts', '--json', '--top', String(TOP_N)],
    {
      cwd: REPO,
      encoding: 'utf8',
    },
  )
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

console.log(
  `Proposing ${candidates.length} capability candidates ` +
    `(mode=${MODE}, max-iter=${MAX_ITER}, wall=${WALL_SEC}s, usd=$${USD}, experiment=${EXPERIMENT_ID})`,
)
for (const c of candidates) {
  console.log(
    `  - ${c.id} (priority=${(c.priority ?? 0).toFixed(2)}, appliesTo=${(c.appliesTo ?? []).join(',')})`,
  )
}

if (DRY_RUN) {
  console.log('\n--dry-run — not invoking proposer')
  process.exit(0)
}

// ── Dispatch ────────────────────────────────────────────────────────
const results = []
for (const c of candidates) {
  if (MODE === 'rlm') {
    results.push(await proposeViaRLM(c))
  } else {
    results.push(await proposeViaAgent(c))
  }
}

const ok = results.filter((r) => r.ok).length
console.log(`\nCapability propose complete: ${ok}/${results.length} drafts written`)
console.log(
  `Next: run \`node scripts/promote-capability-proposal.ts --all\` to validate + promote.`,
)

// ────────────────────────────────────────────────────────────────────
// Agentic path
// ────────────────────────────────────────────────────────────────────

async function proposeViaAgent(c) {
  const t0 = Date.now()
  const scratchDir = createScratchWorkspace('capability-proposer-')
  const destDir = join(PROPOSALS_DIR, c.id)

  try {
    // Load promoter-gates at dispatch time (not at import time) — the
    // .ts source compiles to dist/lib/promoter-gates.js via the
    // standard `pnpm build` path the scorecard already runs.
    const gatesPath = join(REPO, 'dist/lib/promoter-gates.js')
    if (!existsSync(gatesPath)) {
      throw new Error(
        `dist/lib/promoter-gates.js missing — run \`pnpm build\` first. ` +
          `The agentic proposer's criteria depend on the compiled promoter gates.`,
      )
    }
    const gates = await import(gatesPath)

    const peerCapabilities = loadPeerCapabilities(c.appliesTo ?? [], 3)
    const brief = buildCapabilityBrief({
      candidate: c,
      workspaceDir: scratchDir,
      peerCapabilities,
      repoRoot: REPO,
    })
    const criteria = buildCapabilityCriteria({ gates, candidate: c, fullBoot: FULL_BOOT })
    const profile = buildAgentProfile({
      name: `capability-proposer-${c.id}`,
      systemPrompt:
        'You are the capability proposer agent for starter-foundry. You scaffold a new ' +
        'capability draft by reading library sources and reference capabilities, then writing ' +
        'the draft into the mounted workspace. You self-verify by running the completion ' +
        'criteria the promoter will also run. Never emit TODO/FIXME. Never declare a ' +
        "package dep you don't import. On any criterion failure, read the reason, fix the " +
        'underlying issue, and retry.',
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
            event: 'capability-proposer-iteration',
            id: c.id,
            experimentId: EXPERIMENT_ID,
            iteration: ev.iteration,
            mode: 'agent',
          })
        }
        if (ev.type === 'criterion.check') {
          logImpactEvent(IMPACT_LOG, {
            event: 'capability-proposer-criterion',
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
        event: 'capability-proposed',
        id: c.id,
        experimentId: EXPERIMENT_ID,
        mode: 'agent',
        iterations: result.iterations,
        wallMs: result.wallMs,
        usd: result.usd,
        priority: c.priority,
        occurrences: c.occurrences,
        appliesTo: c.appliesTo,
        durationMs,
        criterionOutcomes,
      })
      console.log(`  ✓ ${c.id}: verified in ${iterations} iter (${durationMs}ms) → ${destDir}`)
      return { id: c.id, ok: true, mode: 'agent', durationMs, iterations }
    }

    // Not verified — still persist a blocker.md so a human can triage.
    mkdirSync(destDir, { recursive: true })
    writeBlocker({ destDir, result })
    logImpactEvent(IMPACT_LOG, {
      event: 'capability-proposed-failed',
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
      appliesTo: c.appliesTo,
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
      event: 'capability-proposed-failed',
      id: c.id,
      experimentId: EXPERIMENT_ID,
      mode: 'agent',
      verdict: 'error',
      priority: c.priority,
      occurrences: c.occurrences,
      appliesTo: c.appliesTo,
      durationMs,
      error: String(err?.message ?? err),
    })
    console.error(`  ✗ ${c.id} (agent dispatch error): ${err?.message ?? err}`)
    return { id: c.id, ok: false, mode: 'agent', durationMs, error: String(err?.message ?? err) }
  } finally {
    // Scratch dir is inside tmpdir — cleanup is best-effort. On verified we've
    // already copied the contents out. On blocked we keep it for forensics if
    // KEEP_SCRATCH is set.
    if (!process.env.KEEP_SCRATCH) {
      try {
        rmSync(scratchDir, { recursive: true, force: true })
      } catch {
        /* noop */
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────────
// RLM fallback path (unchanged logic from pre-agentic version)
// ────────────────────────────────────────────────────────────────────

async function proposeViaRLM(c) {
  const t0 = Date.now()
  try {
    const { proposeCapabilityWithRLMToDisk } =
      await import('../dist/training/capability_proposer/propose.js')
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
    logImpactEvent(IMPACT_LOG, {
      event: 'capability-proposed',
      id: c.id,
      experimentId: EXPERIMENT_ID,
      mode: `rlm-${proposal.mode}`,
      templateFileCount: proposal.templateFiles.length,
      peerCapabilities: proposal.peerCapabilities,
      priority: c.priority,
      occurrences: c.occurrences,
      appliesTo: c.appliesTo,
      durationMs,
    })
    console.log(
      `  ✓ ${c.id}: mode=${proposal.mode} files=${proposal.templateFiles.length} dir=${proposal.proposalDir}`,
    )
    return { id: c.id, ok: true, mode: `rlm-${proposal.mode}`, durationMs }
  } catch (err) {
    const durationMs = Date.now() - t0
    logImpactEvent(IMPACT_LOG, {
      event: 'capability-proposed-failed',
      id: c.id,
      experimentId: EXPERIMENT_ID,
      mode: 'rlm',
      priority: c.priority,
      appliesTo: c.appliesTo,
      durationMs,
      error: String(err?.message ?? err),
    })
    console.error(`  ✗ ${c.id}: ${err?.message ?? err}`)
    return { id: c.id, ok: false, mode: 'rlm', durationMs, error: String(err?.message ?? err) }
  }
}

// ────────────────────────────────────────────────────────────────────
// Peer-capability discovery — same ranking as the RLM path
// ────────────────────────────────────────────────────────────────────

function loadPeerCapabilities(appliesTo, limit) {
  const root = join(REPO, 'registry/layers/capability')
  if (!existsSync(root)) return []
  const rows = []
  for (const id of readdirSync(root)) {
    if (id.startsWith('.') || id.startsWith('_')) continue
    const mp = join(root, id, 'manifest.json')
    if (!existsSync(mp)) continue
    try {
      const m = JSON.parse(readFileSync(mp, 'utf8'))
      rows.push({ id: m.id, appliesTo: m.appliesTo ?? [] })
    } catch {
      /* skip malformed */
    }
  }
  return rows
    .map((r) => ({ r, score: r.appliesTo.filter((f) => appliesTo.includes(f)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ r }) => r.id)
}
