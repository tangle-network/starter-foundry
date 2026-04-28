// Shared helpers for the agentic proposer scripts (capability + family).
//
// The agentic path dispatches through `@tangle-network/tcloud-agent`'s
// Agent run-loop primitive instead of a single-shot RLM call. The agent
// gets a workspace, a rich brief, and completion criteria that mirror the
// promoter's Gen 9 dogfood gates — so the proposer self-verifies what the
// promoter will verify. That's the whole point: symmetry, not duplication.
//
// This module is pure .mjs so the `.mjs` driver scripts can import it
// directly without a tsc step, and it's side-effect-free so tests can
// exercise the pure helpers (brief construction, criterion wrappers,
// event shape) without touching the network.

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, cpSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'

const requireFromHere = createRequire(import.meta.url)

// ──────────────────────────────────────────────────────────────────
// Dynamic tcloud-agent loader
// ──────────────────────────────────────────────────────────────────
//
// tcloud-agent ships from the tangle/tcloud workspace via a `link:` ref
// in package.json. If that link is broken or the dep is absent (CI
// environment without the sibling workspace), we surface a clear error
// with the --mode=rlm fallback as the remediation — we do NOT silently
// fall back. Silent-fallback is the Gen 8 failure pattern we spent a
// week ripping out; keep the gate honest.

let _tcloudAgent = null
let _tcloudClient = null

export async function loadTcloudAgent() {
  if (_tcloudAgent) return _tcloudAgent
  try {
    _tcloudAgent = await import('@tangle-network/tcloud-agent')
    return _tcloudAgent
  } catch (err) {
    throw new Error(
      `@tangle-network/tcloud-agent is not installed or resolvable. ` +
        `Install it (pnpm add @tangle-network/tcloud-agent) or use --mode=rlm to route through the legacy path. ` +
        `Original error: ${err?.message ?? err}`,
    )
  }
}

export async function loadTcloudClient() {
  if (_tcloudClient) return _tcloudClient
  try {
    _tcloudClient = await import('@tangle-network/tcloud')
    return _tcloudClient
  } catch (err) {
    throw new Error(`@tangle-network/tcloud is not installed: ${err?.message ?? err}`)
  }
}

// ──────────────────────────────────────────────────────────────────
// Brief construction
// ──────────────────────────────────────────────────────────────────
//
// The brief is the single biggest quality lever on the final scaffold.
// It's structured so the agent can grep for section headings and pull
// out the library source paths, reference capabilities, and exit
// criteria without re-parsing natural language. Every section is
// labeled with a short prefix that looks like a file-path to nudge
// the agent toward `Read`-ing those paths directly.

/**
 * Build a rich brief for a capability proposal.
 *
 * @param {object} args
 * @param {object} args.candidate       Gap candidate from detect-capability-gaps
 * @param {string} args.workspaceDir    Absolute path where the agent writes the draft
 * @param {string[]} args.peerCapabilities  IDs of reference capabilities (closest analogs)
 * @param {string} args.repoRoot        Absolute path to the starter-foundry repo root
 * @returns {string}
 */
export function buildCapabilityBrief(args) {
  const { candidate, workspaceDir, peerCapabilities, repoRoot } = args
  const family = candidate.appliesTo?.[0] ?? 'agent-service-ts'
  const familyManifest = join(repoRoot, 'registry/families', family, 'manifest.json')
  const peerPaths = peerCapabilities
    .map((id) => `  - registry/layers/capability/${id}/ (${join(repoRoot, 'registry/layers/capability', id)})`)
    .join('\n')

  // Library pointers — resolve-or-skip. If the package isn't in
  // node_modules we still emit the path the agent can try. Absolute
  // paths let the agent Read them without computing anything.
  const agentEvalSrc = '/home/drew/code/agent-eval/src/'
  const agentEvalDts = join(repoRoot, 'node_modules/@tangle-network/agent-eval/dist/index.d.ts')
  const tcloudSrc = '/home/drew/code/tcloud/packages/tcloud/src/'
  const tcloudDts = join(repoRoot, 'node_modules/@tangle-network/tcloud/dist/index.d.ts')

  const tokens = candidate.productCues?.slice(0, 6).join(', ') ?? candidate.cues?.slice(0, 6).join(', ') ?? '(none)'

  return `CAPABILITY TO SCAFFOLD: ${candidate.id}
TARGET FAMILY: ${family}
DOMAIN: ${candidate.appliesTo?.join(', ') ?? 'unknown'}

CANDIDATE CONTEXT:
  - Derived from ${candidate.occurrences ?? 0}x real-user demand signal
  - Gap reason: ${candidate.description ?? candidate.reason ?? '(none)'}
  - Tokens the router should attach on: ${tokens}

LIBRARIES YOU MUST USE (read before writing code):
  - @tangle-network/agent-eval
      src: ${agentEvalSrc}
      types: ${agentEvalDts}
      Key exports to consider: runTestGradedScenario, InMemoryTraceStore, SubprocessSandboxDriver, createCustomJudge
  - @tangle-network/tcloud
      src: ${tcloudSrc}
      types: ${tcloudDts}
      Key exports: TCloudClient, BridgeOptions

REFERENCE CAPABILITIES (pattern-match shape + packageDeps discipline):
  - registry/layers/capability/agent-eval/ (library-backed, clean shape)
${peerPaths}

TARGET FAMILY MANIFEST:
  ${familyManifest}

COMPLETION CRITERIA (these match the promoter's Gen 9 dogfood gates):
  1. schema-valid: manifest.json parses, id matches dir, no TODO/FIXME strings
  2. declared-dep-used: every packageDeps.dependencies entry has at least one \`import ... from '<pkg>'\` in an emitted file
  3. scaffold-runs: composed scaffold boots via \`pnpm start\`, /health responds 200 (skip if not applicable to family/surface)
  4. eval-scores: if you layer capability:agent-eval, its own run-eval.mjs must return aggregate >= threshold
  5. test-suite: all unit tests in the composed scaffold pass

FAIL-CLOSED RULES:
  - No TODO/FIXME strings in emitted files
  - No \`|| true\` or silent-fallback in any emitted test/build command
  - No declared deps you don't actually import
  - No runtime.js eval() or similar silent-error surfaces

OUTPUT:
  Write the capability draft to ${workspaceDir}:
    - manifest.json
    - files/<scaffolded files matching target paths in manifest>
  When all criteria pass, exit successfully. On any criterion failure, iterate -
  try up to 8 iterations within your 15min / $2 wall-budget. On exhaustion,
  surface what blocked you in a blocker.md at the draft root.
`
}

/**
 * Build a rich brief for a family proposal. Families are the root of a
 * project (package.json, tsconfig, entrypoint) — higher blast radius
 * than capabilities, so the scaffold-runs gate is non-negotiable.
 *
 * @param {object} args
 * @param {object} args.candidate       Gap candidate from detect-family-gaps
 * @param {string} args.workspaceDir    Absolute path where the agent writes the draft
 * @param {string[]} args.peerFamilies  IDs of reference families
 * @param {string} args.repoRoot        Absolute path to the starter-foundry repo root
 * @returns {string}
 */
export function buildFamilyBrief(args) {
  const { candidate, workspaceDir, peerFamilies, repoRoot } = args
  const taxonomy = candidate.taxonomy ?? {}
  const peerPaths = peerFamilies
    .map((id) => `  - registry/families/${id}/ (${join(repoRoot, 'registry/families', id)})`)
    .join('\n')

  const tokens = candidate.cues?.slice(0, 6).join(', ') ?? candidate.productCues?.slice(0, 6).join(', ') ?? '(none)'

  return `FAMILY TO SCAFFOLD: ${candidate.id}
DOMAIN: ${taxonomy.language ?? '?'}/${taxonomy.runtime ?? '?'}/${taxonomy.surface ?? '?'}

CANDIDATE CONTEXT:
  - Derived from ${candidate.occurrences ?? 0}x real-user demand signal
  - Gap reason: ${candidate.reason ?? candidate.description ?? '(none)'}
  - Tokens the router should attach on: ${tokens}

LIBRARIES YOU MUST USE (read before writing code — the family picks its runtime lib):
  - Web frameworks: whichever matches the surface — express/fastify for service,
    vite/astro for static, remix/next for app. Read the peer families' package.json
    to see what the existing fleet standardized on.
  - Any domain-specific library the candidate implies (langgraph, viem, pg, etc.)

REFERENCE FAMILIES (pattern-match shape + package.json discipline):
${peerPaths}

COMPLETION CRITERIA (these match the promoter's Gen 9 dogfood gates):
  1. schema-valid: manifest.json + framework.manifest.json parse, id matches dir, no TODO/FIXME strings
  2. declared-dep-used: every packageDeps entry has at least one \`import ... from '<pkg>'\` in an emitted file
  3. scaffold-runs: composed scaffold boots via \`pnpm start\`, /health responds 200
  4. test-suite: all unit tests in the composed scaffold pass

FAIL-CLOSED RULES:
  - No TODO/FIXME strings in emitted files
  - No \`|| true\` or silent-fallback in any emitted test/build command
  - No declared deps you don't actually import

OUTPUT:
  Write the family draft to ${workspaceDir}:
    - manifest.json
    - framework.manifest.json
    - files/<scaffolded files matching target paths in manifest>
  When all criteria pass, exit successfully. On any criterion failure, iterate
  up to 8 iterations within 15min / $2 wall-budget. On exhaustion, surface what
  blocked you in a blocker.md at the draft root.
`
}

// ──────────────────────────────────────────────────────────────────
// Criterion wrappers — adapt promoter-gates.ts to AgentRunCriterion
// ──────────────────────────────────────────────────────────────────
//
// The promoter gates return `{ gate, status, ...detail }` with status
// being 'pass' | 'fail' | 'skipped'. The agent runner wants `{ok, reason?}`.
// Translation table:
//   pass    -> { ok: true }
//   skipped -> { ok: true }                 (the gate chose not to apply)
//   fail    -> { ok: false, reason: msg }   (drives next iteration)
//
// The workspaceDir handed to each criterion is the scratch directory the
// agent is writing into. We expect the agent to emit the composed shape
// directly — manifest.json at root and files/ alongside — so the gate
// runs against the in-progress draft. A full "compose + install + start"
// sanity check for gates 2/3 is strictly opt-in via options.fullBoot
// because it adds >30s per iteration. Gate 1 (declared-dep-used) is
// cheap and always on.

/**
 * Build the ordered list of AgentRunCriterion for a capability draft.
 *
 * @param {object} args
 * @param {object} args.gates        The promoter-gates module (dist/lib/promoter-gates.js)
 * @param {object} args.candidate    Gap candidate (used to decide whether to enable eval-scores)
 * @param {boolean} [args.fullBoot]  If true, also run scaffold-runs + eval-scores (slow). Default false.
 * @returns {Array<{name: string, check: Function}>}
 */
export function buildCapabilityCriteria(args) {
  const { gates, candidate, fullBoot = false } = args

  const schemaValid = {
    name: 'schema-valid',
    check: async (ctx) => {
      const manifestPath = join(ctx.workspaceDir ?? '', 'manifest.json')
      if (!existsSync(manifestPath)) {
        return { ok: false, reason: `manifest.json not found at ${manifestPath}` }
      }
      let manifest
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      } catch (err) {
        return { ok: false, reason: `manifest.json parse error: ${err?.message ?? err}` }
      }
      if (!manifest.id) return { ok: false, reason: 'manifest.json missing `id`' }
      if (!Array.isArray(manifest.appliesTo) || manifest.appliesTo.length === 0) {
        return { ok: false, reason: 'manifest.json missing `appliesTo`' }
      }
      // No TODO/FIXME in any emitted file
      const todos = findTodoStrings(ctx.workspaceDir ?? '')
      if (todos.length > 0) {
        return { ok: false, reason: `TODO/FIXME strings found in: ${todos.slice(0, 3).join(', ')}` }
      }
      return { ok: true }
    },
  }

  const declaredDepUsed = {
    name: 'declared-dep-used',
    check: async (ctx) => {
      const manifestPath = join(ctx.workspaceDir ?? '', 'manifest.json')
      if (!existsSync(manifestPath)) {
        return { ok: false, reason: 'manifest.json not found — schema-valid gate should have caught this' }
      }
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      // The promoter gate expects a composed scaffold dir. For an
      // in-progress capability draft, the actual code lives under
      // files/; manifest.json at the root is the declaration, not
      // proof-of-use, and would false-pass the regex-based scan (the
      // dep name appears as a JSON key inside packageDeps). Scan
      // files/ only when it exists — otherwise fall back to the draft
      // root, which is still safer than scanning manifest.json.
      const filesDir = join(ctx.workspaceDir ?? '', 'files')
      const scanDir = existsSync(filesDir) ? filesDir : (ctx.workspaceDir ?? '')
      const result = gates.checkDeclaredDepUsed({ manifest, composedDir: scanDir })
      if (result.status === 'pass' || result.status === 'skipped') return { ok: true }
      return { ok: false, reason: result.message ?? `unused deps: ${result.unusedDeps?.join(', ')}` }
    },
  }

  const criteria = [schemaValid, declaredDepUsed]

  if (fullBoot) {
    criteria.push({
      name: 'scaffold-runs',
      check: async (ctx) => {
        const manifestPath = join(ctx.workspaceDir ?? '', 'manifest.json')
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
        const result = await gates.checkScaffoldRuns({
          composedDir: ctx.workspaceDir,
          manifest,
          options: { readyTimeoutMs: 20_000 },
        })
        if (result.status === 'pass' || result.status === 'skipped') return { ok: true }
        return { ok: false, reason: result.message ?? result.reason ?? 'scaffold did not boot' }
      },
    })

    // Eval-scores only runs if the candidate's surface is an agent
    // (one of its appliesTo family ids starts with `agent-`) OR it
    // explicitly requires capability:agent-eval. Heuristic: an agent
    // family like `agent-service-ts` / `agent-swarm-ts` is where an
    // eval harness is meaningful; a `react-webapp-ts` family is not.
    const composesAgentEval =
      (candidate.capabilityRequires ?? []).some((c) => c.endsWith(':agent-eval')) ||
      (candidate.appliesTo ?? []).some((a) => a.startsWith('agent-'))
    if (composesAgentEval) {
      criteria.push({
        name: 'eval-scores',
        check: async (ctx) => {
          const manifestPath = join(ctx.workspaceDir ?? '', 'manifest.json')
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
          const result = await gates.checkEvalScores({
            composedDir: ctx.workspaceDir,
            manifest,
            composedLayers: ['capability:agent-eval'],
            options: { port: 3100, timeoutMs: 120_000 },
          })
          if (result.status === 'pass' || result.status === 'skipped') return { ok: true }
          return { ok: false, reason: result.message ?? `aggregate ${result.aggregate} < ${result.threshold}` }
        },
      })
    }
  }

  return criteria
}

/**
 * Build the ordered list of AgentRunCriterion for a family draft.
 * Same structure as capability criteria; scaffold-runs matters more
 * for families (they own the `start` script) but stays behind fullBoot
 * because we want the cheap path fast-iterable.
 */
export function buildFamilyCriteria(args) {
  const { gates, fullBoot = false } = args

  const schemaValid = {
    name: 'schema-valid',
    check: async (ctx) => {
      const manifestPath = join(ctx.workspaceDir ?? '', 'manifest.json')
      if (!existsSync(manifestPath)) return { ok: false, reason: `manifest.json missing at ${manifestPath}` }
      let manifest
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      } catch (err) {
        return { ok: false, reason: `manifest.json parse error: ${err?.message ?? err}` }
      }
      if (!manifest.id) return { ok: false, reason: 'manifest.json missing `id`' }

      const fm = join(ctx.workspaceDir ?? '', 'framework.manifest.json')
      if (existsSync(fm)) {
        try {
          JSON.parse(readFileSync(fm, 'utf8'))
        } catch (err) {
          return { ok: false, reason: `framework.manifest.json parse error: ${err?.message ?? err}` }
        }
      }
      const todos = findTodoStrings(ctx.workspaceDir ?? '')
      if (todos.length > 0) {
        return { ok: false, reason: `TODO/FIXME strings found in: ${todos.slice(0, 3).join(', ')}` }
      }
      return { ok: true }
    },
  }

  const declaredDepUsed = {
    name: 'declared-dep-used',
    check: async (ctx) => {
      const manifestPath = join(ctx.workspaceDir ?? '', 'manifest.json')
      if (!existsSync(manifestPath)) return { ok: false, reason: 'manifest.json not found' }
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      const result = gates.checkDeclaredDepUsed({ manifest, composedDir: ctx.workspaceDir })
      if (result.status === 'pass' || result.status === 'skipped') return { ok: true }
      return { ok: false, reason: result.message ?? `unused deps: ${result.unusedDeps?.join(', ')}` }
    },
  }

  const criteria = [schemaValid, declaredDepUsed]
  if (fullBoot) {
    criteria.push({
      name: 'scaffold-runs',
      check: async (ctx) => {
        const manifestPath = join(ctx.workspaceDir ?? '', 'manifest.json')
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
        const result = await gates.checkScaffoldRuns({ composedDir: ctx.workspaceDir, manifest, options: {} })
        if (result.status === 'pass' || result.status === 'skipped') return { ok: true }
        return { ok: false, reason: result.message ?? result.reason ?? 'scaffold did not boot' }
      },
    })
  }

  return criteria
}

// ──────────────────────────────────────────────────────────────────
// Event logging
// ──────────────────────────────────────────────────────────────────

/**
 * Append a JSONL event to .evolve/generation-impact.jsonl.
 * Same shape the RLM proposer used — preserving funnel analytics.
 */
export function logImpactEvent(impactLogPath, entry) {
  mkdirSync(dirname(impactLogPath), { recursive: true })
  appendFileSync(impactLogPath, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n')
}

// ──────────────────────────────────────────────────────────────────
// Workspace helpers
// ──────────────────────────────────────────────────────────────────

export function createScratchWorkspace(prefix = 'agentic-proposer-') {
  const id = randomBytes(6).toString('hex')
  const dir = join(tmpdir(), `${prefix}${id}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Copy the agent's scratch workspace into the final destination under
 * .evolve/capability-proposals/ (or family-proposals/). Overwrites.
 */
export function commitDraft({ scratchDir, destDir }) {
  if (!existsSync(scratchDir)) {
    throw new Error(`scratchDir does not exist: ${scratchDir}`)
  }
  mkdirSync(destDir, { recursive: true })
  cpSync(scratchDir, destDir, { recursive: true })
}

/**
 * Write a blocker.md into the dest directory when the run failed.
 * Captures the verdict + blockedBy reason + last transcript turn so a
 * human can tell at a glance what the agent got stuck on.
 */
export function writeBlocker({ destDir, result }) {
  mkdirSync(destDir, { recursive: true })
  const lastTurn = result.transcript?.at(-1)?.content ?? '(no transcript)'
  const body = `# Agentic proposer blocked

verdict: ${result.verdict}
iterations: ${result.iterations}
wallMs: ${result.wallMs}
usd: ${result.usd ?? 'null'}
blockedBy: ${result.blockedBy ?? '(none)'}
error: ${result.error ?? '(none)'}

## Last assistant turn

${lastTurn}
`
  writeFileSync(join(destDir, 'blocker.md'), body)
}

// ──────────────────────────────────────────────────────────────────
// AgentProfile builder
// ──────────────────────────────────────────────────────────────────
//
// Inline profile tailored to the candidate's language. Read/write on
// the workspace; bash for install/build/test; no broad network beyond
// package registries (the sandbox bridge enforces that out-of-band).
// Model is env-driven so nightly can bisect models without code change.

/**
 * Resolve the proposer model. Order:
 *   1. EVOLVE_MODEL env (explicit override)
 *   2. .evolve/profiles/default-proposer.profile.json via loadProfile() —
 *      this returns `<alias>@<snapshot>` form when the lock is populated.
 *   3. Fall back to the bare alias when neither is available (pre-`--apply`
 *      bootstrap state). Loud stderr when this branch is taken.
 */
function resolveProposerModel() {
  if (process.env.EVOLVE_MODEL) return process.env.EVOLVE_MODEL
  try {
    // Lazy import — agentic-proposer.ts runs from `scripts/_lib/` so dist/
    // resolves to `../../dist/`.
    const { loadProfile } = requireFromHere('../../dist/lib/profile-loader.js')
    return loadProfile('default-proposer').model
  } catch (e) {
    process.stderr.write(`agentic-proposer: profile resolution failed (${(e instanceof Error ? e.message : String(e))}) — falling back to bare alias\n`)
    return 'claude-sonnet-4-6'
  }
}

export function buildAgentProfile({ name, systemPrompt }) {
  return {
    name,
    description: `Agentic proposer: ${name}`,
    prompt: { systemPrompt },
    model: {
      provider: 'anthropic',
      default: resolveProposerModel(),
    },
    permissions: { Bash: 'allow', Read: 'allow', Write: 'allow', Edit: 'allow', Grep: 'allow' },
    tools: { Bash: true, Read: true, Write: true, Edit: true, Grep: true },
  }
}

// ──────────────────────────────────────────────────────────────────
// Dispatch
// ──────────────────────────────────────────────────────────────────
//
// Given a candidate + criteria + budget, instantiate an Agent and
// stream its events. Returns the final AgentRunResult plus a list of
// per-iteration and per-criterion events for the scorecard.

/**
 * Run one agentic proposal end-to-end. Streams events to stdout for
 * live observability and collects them for post-run analytics.
 *
 * @param {object} args
 * @param {object} args.candidate
 * @param {string} args.brief
 * @param {object} args.profile
 * @param {Array} args.criteria
 * @param {object} args.budget         { iterations, wallSec, usd }
 * @param {string} args.workspaceDir   Scratch dir the agent writes into
 * @param {string} [args.unlock]       BRIDGE_UNLOCK override
 * @param {function} [args.onEvent]    Per-event callback (used for impact-log funnel)
 * @returns {Promise<object>}          { result, iterations, criterionOutcomes }
 */
export async function dispatchAgenticProposal(args) {
  const { candidate, brief, profile, criteria, budget, workspaceDir, unlock, onEvent } = args
  const { agent } = await loadTcloudAgent()
  const { TCloud } = await loadTcloudClient()

  const client = new TCloud({ apiKey: process.env.TCLOUD_API_KEY })
  const stream = agent(client, {
    profile,
    brief,
    workspace: { dir: workspaceDir },
    criteria,
    budget,
    unlock: unlock ?? process.env.BRIDGE_UNLOCK,
  }).stream()

  let result = null
  const criterionOutcomes = []
  let iterationsSeen = 0

  for await (const ev of stream) {
    if (onEvent) onEvent(ev)
    switch (ev.type) {
      case 'iteration.start':
        process.stdout.write(`\n  [${candidate.id}] iter ${ev.iteration}\n`)
        iterationsSeen = ev.iteration
        break
      case 'message.delta':
        process.stdout.write(ev.text)
        break
      case 'criterion.check':
        process.stdout.write(`\n  [${candidate.id}] gate ${ev.ok ? 'pass' : 'fail'}: ${ev.name}${ev.reason ? ` - ${ev.reason}` : ''}\n`)
        criterionOutcomes.push({ iteration: ev.iteration, name: ev.name, ok: ev.ok, reason: ev.reason })
        break
      case 'verdict':
        process.stdout.write(
          `\n  [${candidate.id}] verdict=${ev.verdict} iterations=${ev.iterations} wallMs=${ev.wallMs}\n`,
        )
        result = {
          verdict: ev.verdict,
          iterations: ev.iterations,
          wallMs: ev.wallMs,
          usd: ev.usd,
          transcript: ev.transcript,
          blockedBy: ev.blockedBy,
          error: ev.error,
        }
        break
      default:
        /* iteration.complete, tool.call.* — no-op for now */
        break
    }
  }

  if (!result) {
    throw new Error('Agent stream ended without a verdict event')
  }

  return { result, iterations: iterationsSeen, criterionOutcomes }
}

// ──────────────────────────────────────────────────────────────────
// Internals
// ──────────────────────────────────────────────────────────────────

const SCANNABLE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.py', '.rs', '.go', '.sol', '.yml', '.yaml',
])

function findTodoStrings(rootDir) {
  if (!rootDir || !existsSync(rootDir)) return []
  const found = []
  const walk = (dir) => {
    let entries
    try { entries = readdirSync(dir) } catch { return }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue
      const full = join(dir, entry)
      let s
      try { s = statSync(full) } catch { continue }
      if (s.isDirectory()) { walk(full); continue }
      if (!SCANNABLE_EXTS.has(extLower(entry))) continue
      let text
      try { text = readFileSync(full, 'utf8') } catch { continue }
      if (/\b(?:TODO|FIXME)\b/.test(text)) {
        found.push(relative(rootDir, full))
      }
    }
  }
  walk(rootDir)
  return found
}

function extLower(name) {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i).toLowerCase()
}

// ──────────────────────────────────────────────────────────────────
// CLI-arg helpers (shared between capability + family drivers)
// ──────────────────────────────────────────────────────────────────

export function parseArg(argv, flag, fallback) {
  // Supports both `--flag value` and `--flag=value` forms. The latter is
  // more robust for shell pipelines where space-separated args can get
  // mangled; both shapes are tested in the smoke tests below.
  const eqForm = argv.find((a) => a.startsWith(`${flag}=`))
  if (eqForm) return eqForm.slice(flag.length + 1)
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : fallback
}

export async function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('')
    let data = ''
    process.stdin.on('data', (c) => (data += c))
    process.stdin.on('end', () => resolve(data))
  })
}

// ──────────────────────────────────────────────────────────────────
// Library-source pointer helpers (pure; testable)
// ──────────────────────────────────────────────────────────────────

/**
 * Section-level assertion helper used by tests — returns the list of
 * top-level section prefixes the brief must contain. Single source of
 * truth, so both the builder and the test agree.
 */
export const REQUIRED_BRIEF_SECTIONS = Object.freeze([
  'CANDIDATE CONTEXT:',
  'LIBRARIES YOU MUST USE',
  'REFERENCE',
  'COMPLETION CRITERIA',
  'FAIL-CLOSED RULES:',
  'OUTPUT:',
])

export function briefContainsAllSections(brief) {
  const missing = REQUIRED_BRIEF_SECTIONS.filter((s) => !brief.includes(s))
  return { ok: missing.length === 0, missing }
}
