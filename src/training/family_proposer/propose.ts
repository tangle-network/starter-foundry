// family_proposer/propose.ts — given a target family id + taxonomy +
// rough description, reads N peer families (closest by taxonomy),
// asks the LLM to synthesize a full manifest + the listed template
// files, writes them into .evolve/family-proposals/<id>/ for review.
//
// The scaffolded proposal is NOT auto-promoted. A human runs
// `pnpm promote:family-proposal <id>` to merge it into registry/.
//
// When a router key is present, the LLM drafts fresh manifests +
// real template bodies. Without a key, we fall back to the existing
// `scripts/new-family.mjs` skeleton (deterministic TODO stubs).

import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ax } from '@ax-llm/ax'
import {
  runProposeReview,
  type ProposeFn,
  type VerifyFn,
  type ReviewFn,
  type Verification,
} from '@tangle-network/agent-eval'
import { createLLM, isLLMAvailable } from '../../lib/llm.js'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const PROPOSALS_DIR = join(REPO, '.evolve/family-proposals')

interface ProposeFamilyInput {
  id: string
  description: string
  taxonomy: { language: string; runtime: string; surface: string }
  /** Optional: rough list of what the scaffold must ship. */
  productCues?: string[]
}

interface FamilyProposal {
  id: string
  proposalDir: string
  manifest: unknown
  frameworkManifest: unknown
  templateFiles: Array<{ path: string; body: string }>
  peerFamilies: string[]
  mode: 'llm' | 'deterministic'
  reasoning: string
}

interface PeerSummary {
  id: string
  description: string
  tags: string[]
  taxonomy: Record<string, string>
  keywordsTier1: string[]
  firstSteps: string[]
}

function taxonomyDistance(
  a: { language: string; runtime: string; surface: string },
  b: Record<string, string | undefined>,
): number {
  let dist = 0
  if (a.language !== b['language']) dist += 1
  if (a.runtime !== b['runtime']) dist += 1
  if (a.surface !== b['surface']) dist += 1
  return dist
}

function loadPeerSummaries(
  targetTaxonomy: { language: string; runtime: string; surface: string },
  limit: number,
): PeerSummary[] {
  const familiesRoot = join(REPO, 'registry/families')
  const rows: PeerSummary[] = []
  for (const id of readdirSync(familiesRoot)) {
    if (id.startsWith('_') || id.startsWith('.')) continue
    const manifestPath = join(familiesRoot, id, 'manifest.json')
    if (!existsSync(manifestPath)) continue
    try {
      const m = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        id: string
        description?: string
        tags?: string[]
        taxonomy?: Record<string, string>
        tieredKeywords?: { tier1?: string[] }
        buildHints?: { firstSteps?: string[] }
      }
      rows.push({
        id: m.id,
        description: m.description ?? '',
        tags: m.tags ?? [],
        taxonomy: m.taxonomy ?? {},
        keywordsTier1: m.tieredKeywords?.tier1 ?? [],
        firstSteps: m.buildHints?.firstSteps ?? [],
      })
    } catch {
      /* skip malformed */
    }
  }
  return rows
    .map((r) => ({ r, d: taxonomyDistance(targetTaxonomy, r.taxonomy) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map(({ r }) => r)
}

// Ask the LLM for primitive fields we assemble into the manifest.
// Strict signature shape prevents the free-form JSON mistakes the LLM
// made when we asked for `manifestJson:string` — it invented its own
// schema (family_id, family_name, etc.) instead of ours.
const hintsAuthor = ax(
  'familyId:string, familyDescription:string, taxonomyLanguage:string, taxonomyRuntime:string, taxonomySurface:string, productCues:string, peerFamiliesSummary:string -> whenToUse:string, firstSteps:string[], gotchas:string[], architectureNotes:string[], keywordsTier1:string[], keywordsTier2:string[], primaryEntrypoint:string, packageDepsCsv:string, reasoning:string',
)

const fileAuthor = ax(
  'familyId:string, familyDescription:string, taxonomyLanguage:string, taxonomyRuntime:string, taxonomySurface:string, filePath:string, fileRole:string, peerFamiliesSummary:string -> fileBody:string',
)

function slotForFile(filePath: string, runtime: string): string {
  if (filePath === 'package.json') return 'package manifest with scripts + pinned deps'
  if (filePath === 'tsconfig.json') return 'strict TS config for bundler module-resolution'
  if (filePath === 'vite.config.ts') return 'Vite config with es2022 + dev port'
  if (filePath === 'index.html') return 'HTML shell loading /src/main.ts'
  if (filePath === 'src/main.ts' || filePath === 'src/index.ts') return `main entrypoint for the ${runtime} starter`
  if (filePath === 'src/cli.ts') return 'commander-based CLI entrypoint with --help surface'
  if (filePath === 'src/agent.ts') return 'agent loop entrypoint — tool registry + chat step function'
  if (filePath === 'src/runner.ts') return 'batch runner that iterates scenarios/ + writes results'
  if (filePath === 'scenarios/example.ts') return 'example scenario file the harness picks up'
  if (filePath === 'judges/example.ts') return 'example rubric judge returning {score, rationale}'
  if (filePath === 'docker-compose.yml') return 'docker compose with the primary service + volume'
  if (filePath === 'requirements.txt') return 'Python deps pinned to current major versions'
  if (filePath === 'pyproject.toml') return 'Python package metadata + deps'
  if (filePath === 'Cargo.toml') return 'Rust crate manifest with pinned deps + binary target'
  if (filePath === 'src/main.rs') return 'Rust binary entrypoint — tokio::main + startup wiring'
  if (filePath === 'src/lib.rs') return 'Rust library entrypoint — public module re-exports'
  if (filePath === 'go.mod') return 'Go module declaration with Go version + deps'
  if (filePath === 'main.go') return 'Go binary entrypoint with main() and top-level wiring'
  if (filePath.endsWith('.mjs')) return 'Node validator asserting key files + deps structure'
  if (filePath === 'README.md') return 'Quickstart + agent-facing extension guide'
  return `${filePath} — agent-extensible entry file`
}

function filesForTaxonomy(taxonomy: { language: string; runtime: string; surface: string }): Array<{ path: string; role: string }> {
  const lang = taxonomy.language
  const runtime = taxonomy.runtime
  const surface = taxonomy.surface
  const validator = `validate-${runtime}.mjs`
  const toFiles = (paths: string[]) => paths.map((p) => ({ path: p, role: slotForFile(p, runtime) }))

  // TypeScript / Node / Bun / Deno / CF-Worker permutations
  if (lang === 'typescript' || lang === 'javascript') {
    if (surface === 'frontend') {
      return toFiles(['package.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'src/main.ts', 'README.md', validator])
    }
    if (surface === 'api' || surface === 'inference') {
      return toFiles(['package.json', 'tsconfig.json', 'src/index.ts', 'README.md', validator])
    }
    if (surface === 'cli') {
      return toFiles(['package.json', 'tsconfig.json', 'src/cli.ts', 'src/index.ts', 'README.md', validator])
    }
    if (surface === 'agent') {
      return toFiles(['package.json', 'tsconfig.json', 'src/agent.ts', 'src/index.ts', 'README.md', validator])
    }
    if (surface === 'tooling') {
      // Eval/test-harness-shaped project: scenarios + judges + runner + validator.
      return toFiles(['package.json', 'tsconfig.json', 'src/runner.ts', 'scenarios/example.ts', 'judges/example.ts', 'README.md', validator])
    }
    // Unknown TS surface: still give a real scaffold, not a bare README.
    return toFiles(['package.json', 'tsconfig.json', 'src/index.ts', 'README.md', validator])
  }

  // Python permutations
  if (lang === 'python') {
    if (surface === 'api') {
      return toFiles(['pyproject.toml', 'requirements.txt', 'src/main.py', '.env.example', 'README.md', validator])
    }
    if (surface === 'cli') {
      return toFiles(['pyproject.toml', 'requirements.txt', 'src/cli.py', 'README.md', validator])
    }
    if (surface === 'agent') {
      return toFiles(['pyproject.toml', 'requirements.txt', 'src/agent.py', 'src/main.py', 'README.md', validator])
    }
    // Default python surface
    return toFiles(['pyproject.toml', 'requirements.txt', 'src/main.py', '.env.example', 'README.md', validator])
  }

  // Rust permutations
  if (lang === 'rust') {
    if (surface === 'api') {
      return toFiles(['Cargo.toml', 'src/main.rs', 'README.md', validator])
    }
    if (surface === 'cli') {
      return toFiles(['Cargo.toml', 'src/main.rs', 'src/lib.rs', 'README.md', validator])
    }
    return toFiles(['Cargo.toml', 'src/main.rs', 'README.md', validator])
  }

  // Go permutations
  if (lang === 'go') {
    if (surface === 'cli') {
      return toFiles(['go.mod', 'main.go', 'README.md', validator])
    }
    return toFiles(['go.mod', 'main.go', 'README.md', validator])
  }

  // Unknown language — at least give README + validator so the scaffold compiles.
  return toFiles(['README.md', validator])
}

async function proposeViaLLM(input: ProposeFamilyInput, peers: PeerSummary[]): Promise<FamilyProposal | null> {
  if (!isLLMAvailable()) return null
  const llm = createLLM()
  const peerSummary = peers
    .map(
      (p) =>
        `- ${p.id} (${p.taxonomy['language'] ?? '?'}/${p.taxonomy['runtime'] ?? '?'}/${p.taxonomy['surface'] ?? '?'}): ${p.description}`,
    )
    .join('\n')
  const cues = (input.productCues ?? []).join('\n- ') || '(none)'

  try {
    const hints = (await hintsAuthor.forward(llm, {
      familyId: input.id,
      familyDescription: input.description,
      taxonomyLanguage: input.taxonomy.language,
      taxonomyRuntime: input.taxonomy.runtime,
      taxonomySurface: input.taxonomy.surface,
      productCues: cues,
      peerFamiliesSummary: peerSummary,
    })) as {
      whenToUse?: string
      firstSteps?: string[]
      gotchas?: string[]
      architectureNotes?: string[]
      keywordsTier1?: string[]
      keywordsTier2?: string[]
      primaryEntrypoint?: string
      packageDepsCsv?: string
      reasoning?: string
    }

    const wantedFiles = filesForTaxonomy(input.taxonomy)
    const templateFiles: Array<{ path: string; body: string }> = []
    for (const f of wantedFiles) {
      try {
        const body = (await fileAuthor.forward(llm, {
          familyId: input.id,
          familyDescription: input.description,
          taxonomyLanguage: input.taxonomy.language,
          taxonomyRuntime: input.taxonomy.runtime,
          taxonomySurface: input.taxonomy.surface,
          filePath: f.path,
          fileRole: f.role,
          peerFamiliesSummary: peerSummary,
        })) as { fileBody?: string }
        if (body.fileBody && body.fileBody.length > 10) {
          templateFiles.push({ path: f.path, body: body.fileBody })
        }
      } catch (err) {
        console.error(`[propose] file ${f.path} LLM call failed:`, (err as Error).message)
      }
    }

    const deps: Record<string, string> = {}
    for (const pair of (hints.packageDepsCsv ?? '').split(',')) {
      const [name, version] = pair.split('@')
      if (name && version && /^[@\w./-]+$/.test(name.trim())) {
        deps[name.trim()] = version.trim()
      }
    }

    const manifest = {
      id: input.id,
      description: input.description.length >= 20 ? input.description : `${input.description} — ${input.taxonomy.runtime} ${input.taxonomy.surface} starter`,
      tags: [input.taxonomy.runtime, input.taxonomy.surface, input.taxonomy.language],
      taxonomy: input.taxonomy,
      defaults: { projectType: input.taxonomy.surface, serviceName: `starter-foundry-${input.id}` },
      files: templateFiles.map((f) => ({ source: `files/${f.path}`, target: f.path })),
      validationChecks: [
        ...templateFiles.slice(0, 3).map((f) => ({ type: 'file-exists' as const, path: f.path })),
      ],
      contextHints: {
        commands: (hints.firstSteps ?? []).slice(0, 3).filter((s) => /^\w.{0,60}$/.test(s)),
        entrypoints: hints.primaryEntrypoint ? [hints.primaryEntrypoint] : [],
        preview: null,
        extensionPoints: [],
      },
      keywords: [...(hints.keywordsTier1 ?? []), ...(hints.keywordsTier2 ?? [])],
      tieredKeywords: {
        tier1: hints.keywordsTier1 ?? [input.id],
        tier2: hints.keywordsTier2 ?? [],
      },
      buildHints: {
        whenToUse: hints.whenToUse ?? input.description,
        firstSteps: hints.firstSteps ?? [],
        gotchas: hints.gotchas ?? [],
        architectureNotes: hints.architectureNotes ?? [],
        placeholders: hints.primaryEntrypoint
          ? [{ path: hints.primaryEntrypoint, description: `Primary entrypoint agents must extend.` }]
          : [],
      },
      ...(Object.keys(deps).length > 0 ? { packageDeps: { dependencies: deps } } : {}),
    }
    const frameworkManifest = {
      id: input.id,
      description: `${input.taxonomy.runtime} framework layer for ${input.id}.`,
      appliesTo: [input.id],
      files: [],
    }

    return {
      id: input.id,
      proposalDir: join(PROPOSALS_DIR, input.id),
      manifest,
      frameworkManifest,
      templateFiles,
      peerFamilies: peers.map((p) => p.id),
      mode: 'llm',
      reasoning: hints.reasoning ?? '',
    }
  } catch (err) {
    console.error(`[propose] LLM call failed: ${(err as Error).message}`)
    return null
  }
}

function proposeDeterministic(input: ProposeFamilyInput, peers: PeerSummary[]): FamilyProposal {
  const manifest = {
    id: input.id,
    description: input.description.length >= 20 ? input.description : `${input.description} — starter (regenerate before shipping)`,
    tags: [input.taxonomy.runtime, input.taxonomy.surface, input.taxonomy.language],
    taxonomy: input.taxonomy,
    defaults: { projectType: input.taxonomy.surface, serviceName: `starter-foundry-${input.id}` },
    files: [],
    validationChecks: [],
    contextHints: { commands: [], entrypoints: [], preview: null, extensionPoints: [] },
    keywords: [input.id],
    tieredKeywords: { tier1: [input.id], tier2: [] },
    buildHints: {
      whenToUse: `TODO: describe when a prompt should route to ${input.id}. Derive from peer families: ${peers.slice(0, 3).map((p) => p.id).join(', ')}.`,
      firstSteps: ['TODO: install command', 'TODO: dev-server command', 'TODO: entrypoint an agent should extend'],
      gotchas: ['TODO: one non-obvious trap specific to this runtime'],
      placeholders: [{ path: 'TODO/entrypoint.xyz', description: 'TODO: primary file agents must replace.' }],
    },
  }
  const frameworkManifest = {
    id: input.id,
    description: `Framework layer for ${input.id}.`,
    appliesTo: [input.id],
    files: [],
  }
  return {
    id: input.id,
    proposalDir: join(PROPOSALS_DIR, input.id),
    manifest,
    frameworkManifest,
    templateFiles: [],
    peerFamilies: peers.map((p) => p.id),
    mode: 'deterministic',
    reasoning: 'No router key available — emitting TODO skeleton; human fills in template files + buildHints.',
  }
}

export async function proposeFamily(input: ProposeFamilyInput): Promise<FamilyProposal> {
  const peers = loadPeerSummaries(input.taxonomy, 5)
  const llmProposal = await proposeViaLLM(input, peers)
  const proposal = llmProposal ?? proposeDeterministic(input, peers)

  mkdirSync(proposal.proposalDir, { recursive: true })
  writeFileSync(join(proposal.proposalDir, 'manifest.json'), JSON.stringify(proposal.manifest, null, 2) + '\n')
  writeFileSync(
    join(proposal.proposalDir, 'framework.manifest.json'),
    JSON.stringify(proposal.frameworkManifest, null, 2) + '\n',
  )
  writeFileSync(
    join(proposal.proposalDir, '.meta.json'),
    JSON.stringify(
      {
        id: proposal.id,
        peerFamilies: proposal.peerFamilies,
        mode: proposal.mode,
        reasoning: proposal.reasoning,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  )
  for (const f of proposal.templateFiles) {
    const abs = join(proposal.proposalDir, 'files', f.path)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, f.body)
  }

  // Ensure the proposal dir stays visible in git even if templateFiles is empty.
  const filesDir = join(proposal.proposalDir, 'files')
  mkdirSync(filesDir, { recursive: true })
  const stat = statSync(filesDir)
  if (stat.isDirectory()) {
    const keep = join(filesDir, '.gitkeep')
    if (!existsSync(keep)) writeFileSync(keep, '')
  }

  return proposal
}

// ─────────────────────────────────────────────────────────────────────
// RLM variant — wraps proposeViaLLM in agent-eval's runProposeReview so
// each draft is verified + critiqued + refined before disk-write. The
// verifier runs the same schema checks as the downstream promoter so a
// draft that passes the RLM loop is already close to promotable. The
// reviewer is a separate LLM call that reads the verification and
// directs the next proposer shot — it cannot downgrade the verifier.
//
// Shape of state carried across shots: the manifest + framework manifest
// + rendered file bodies. This is what gets serialized to disk at the
// end, identical to the single-shot path.
//
// On shots 2+, the reviewer's nextShotInstruction rides along as an
// additional productCue so the proposer sees it explicitly. The LLM
// re-generates from scratch each shot — we are not patching a
// partial draft, we are guiding a fresh attempt. This keeps the
// state model simple + the verification signal clean.

interface ProposalDraftState {
  manifest: Record<string, unknown> | null
  frameworkManifest: Record<string, unknown> | null
  templateFiles: Array<{ path: string; body: string }>
  reasoning: string
}

const proposalReviewer = ax(
  '"Direct the next shot of a registry-family proposer. You do NOT grade — the verifier already flagged the failures. Read the draft summary + failures + prior shots, identify the root cause (missing tier1 keywords? weak description? TODO bodies? wrong taxonomy fields?), and emit a concrete, actionable instruction for the next shot. Do not restate the failures. Direct the worker to fix them in order of blast radius." goal:string, currentDraftSummary:string, verificationFailures:string[], priorShotsMemory:string -> observations:string, diagnosis:string, nextShotInstruction:string, shouldContinue:boolean, confidence:number',
)

function validateDraftForRLM(state: ProposalDraftState, id: string): string[] {
  const errors: string[] = []
  const m = state.manifest
  if (!m) return ['manifest is null']
  if (m['id'] !== id) errors.push(`manifest.id=${String(m['id'])} but expected ${id}`)
  const desc = typeof m['description'] === 'string' ? m['description'] : ''
  if (!desc || desc.length < 20) errors.push('description missing or <20 chars')
  if (!m['taxonomy']) errors.push('missing taxonomy')
  const serialized = JSON.stringify(m)
  if (serialized.includes('TODO:') || serialized.includes('TODO ')) {
    errors.push('TODO placeholders present — proposer emitted a skeleton')
  }
  const tier1 = (m['tieredKeywords'] as Record<string, unknown> | undefined)?.['tier1']
  if (!Array.isArray(tier1) || tier1.length < 3) errors.push('tieredKeywords.tier1 must have ≥3 entries')
  if (state.templateFiles.length === 0) errors.push('no template files generated — proposer produced no file bodies')
  for (const f of state.templateFiles) {
    if (typeof f.body !== 'string' || f.body.length < 20) {
      errors.push(`file ${f.path} body <20 chars (stub)`)
    }
  }
  const fm = state.frameworkManifest
  if (fm) {
    const applies = fm['appliesTo']
    if (!Array.isArray(applies) || !applies.includes(id)) {
      errors.push('frameworkManifest.appliesTo must include family id')
    }
  }
  return errors
}

export interface ProposeWithRLMOptions {
  maxShots?: number
}

export async function proposeFamilyWithRLM(
  input: ProposeFamilyInput,
  opts: ProposeWithRLMOptions = {},
): Promise<FamilyProposal | null> {
  if (!isLLMAvailable()) return null
  const peers = loadPeerSummaries(input.taxonomy, 5)
  const llm = createLLM()
  const maxShots = opts.maxShots ?? 3

  const propose: ProposeFn<ProposalDraftState> = async ({ priorReview }) => {
    const cues = priorReview?.nextShotInstruction
      ? [...(input.productCues ?? []), `REVIEWER DIRECTIVE (shot refinement): ${priorReview.nextShotInstruction}`]
      : (input.productCues ?? [])
    const p = await proposeViaLLM({ ...input, productCues: cues }, peers)
    if (!p) {
      // Proposer failed entirely — return empty state so the verifier flags it.
      return { state: { manifest: null, frameworkManifest: null, templateFiles: [], reasoning: '(proposer returned null)' } }
    }
    return {
      state: {
        manifest: p.manifest as Record<string, unknown>,
        frameworkManifest: p.frameworkManifest as Record<string, unknown>,
        templateFiles: p.templateFiles,
        reasoning: p.reasoning,
      },
    }
  }

  const verify: VerifyFn<ProposalDraftState> = async (state) => {
    const errors = validateDraftForRLM(state, input.id)
    const pass = errors.length === 0
    const score = pass ? 1 : Math.max(0, 1 - errors.length / 10)
    const result: Verification = { pass, score, failingLayers: errors.slice(0, 5), details: errors }
    return result
  }

  const review: ReviewFn<ProposalDraftState> = async ({ state, verification, memory, shot, goal }) => {
    const failures = (verification.details as string[] | undefined) ?? []
    const priorMem = memory
      .map((m) => `shot ${m.shot} conf=${m.confidence.toFixed(2)} instr="${m.nextShotInstruction.slice(0, 200)}"`)
      .join('\n') || '(none)'
    const tier1 = (state.manifest?.['tieredKeywords'] as Record<string, unknown> | undefined)?.['tier1']
    const tier1Len = Array.isArray(tier1) ? tier1.length : 0
    const desc = typeof state.manifest?.['description'] === 'string' ? (state.manifest['description'] as string) : ''
    const summary = `id=${String(state.manifest?.['id'])} desc="${desc.slice(0, 120)}" files=${state.templateFiles.length} tier1=${tier1Len}`
    const raw = (await proposalReviewer.forward(llm, {
      goal,
      currentDraftSummary: summary,
      verificationFailures: failures,
      priorShotsMemory: priorMem,
    })) as {
      observations?: string
      diagnosis?: string
      nextShotInstruction?: string
      shouldContinue?: boolean
      confidence?: number
    }
    // Coerce minimally — agent-eval's coerceReview will re-validate.
    return {
      observations: String(raw.observations ?? `shot ${shot} produced ${failures.length} verification failures`),
      diagnosis: String(raw.diagnosis ?? 'reviewer returned no diagnosis'),
      nextShotInstruction: String(raw.nextShotInstruction ?? 'fix the verification failures in priority order'),
      shouldContinue: typeof raw.shouldContinue === 'boolean' ? raw.shouldContinue : shot < maxShots,
      confidence: Number.isFinite(raw.confidence) ? Number(raw.confidence) : 0.5,
    }
  }

  const initialState: ProposalDraftState = { manifest: null, frameworkManifest: null, templateFiles: [], reasoning: '' }
  const report = await runProposeReview<ProposalDraftState>({
    goal: `Generate a complete, promotable family registry entry for ${input.id}: ${input.description}`,
    initialState,
    propose,
    verify,
    review,
    maxShots,
    scenarioId: 'family-proposer',
    projectId: input.id,
  })

  const final = report.finalState
  if (!final.manifest) {
    console.error(`[propose-rlm] ${input.id}: all ${report.shots.length} shots produced no manifest`)
    return null
  }

  return {
    id: input.id,
    proposalDir: join(PROPOSALS_DIR, input.id),
    manifest: final.manifest,
    frameworkManifest: final.frameworkManifest,
    templateFiles: final.templateFiles,
    peerFamilies: peers.map((p) => p.id),
    mode: 'llm',
    reasoning: `RLM ${report.shots.length} shot(s), verification pass=${report.finalVerification.pass}, score=${report.score.toFixed(2)}. ${final.reasoning}`,
  }
}

/**
 * Same disk-write semantics as proposeFamily, but drives the RLM loop.
 * Writes .meta.json with shot telemetry for debuggability.
 */
export async function proposeFamilyWithRLMToDisk(
  input: ProposeFamilyInput,
  opts: ProposeWithRLMOptions = {},
): Promise<FamilyProposal> {
  const rlmProposal = await proposeFamilyWithRLM(input, opts)
  const peers = loadPeerSummaries(input.taxonomy, 5)
  const proposal = rlmProposal ?? proposeDeterministic(input, peers)

  mkdirSync(proposal.proposalDir, { recursive: true })
  writeFileSync(join(proposal.proposalDir, 'manifest.json'), JSON.stringify(proposal.manifest, null, 2) + '\n')
  writeFileSync(
    join(proposal.proposalDir, 'framework.manifest.json'),
    JSON.stringify(proposal.frameworkManifest, null, 2) + '\n',
  )
  writeFileSync(
    join(proposal.proposalDir, '.meta.json'),
    JSON.stringify(
      {
        id: proposal.id,
        peerFamilies: proposal.peerFamilies,
        mode: proposal.mode === 'llm' ? 'llm-rlm' : proposal.mode,
        reasoning: proposal.reasoning,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  )
  for (const f of proposal.templateFiles) {
    const abs = join(proposal.proposalDir, 'files', f.path)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, f.body)
  }
  const filesDir = join(proposal.proposalDir, 'files')
  mkdirSync(filesDir, { recursive: true })
  const stat = statSync(filesDir)
  if (stat.isDirectory()) {
    const keep = join(filesDir, '.gitkeep')
    if (!existsSync(keep)) writeFileSync(keep, '')
  }
  return proposal
}
