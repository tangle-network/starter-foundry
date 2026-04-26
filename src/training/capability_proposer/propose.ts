// Gen-6 Track C: capability proposer with RLM refinement.
//
// Capabilities are the lower-blast-radius complement to families. A family
// owns the root of a project (package.json, tsconfig, entrypoint). A
// capability slots into one or more families, adding a feature. The
// promotion bar is lower — a capability that doesn't compose is easy to
// remove; a broken family takes a whole project down.
//
// Schema mirrors registry/layers/capability/<id>/manifest.json:
//   { id, description, appliesTo[], defaults, files[], contextHints,
//     capabilityRequires[], keywords[], tieredKeywords }
//
// Propose surface: { id, description, appliesTo[], slotFiles[] }. RLM
// refines via the same ax propose→verify→review loop as family-proposer.

import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
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
const PROPOSALS_DIR = join(REPO, '.evolve/capability-proposals')

export interface ProposeCapabilityInput {
  id: string
  description: string
  /** Family ids this capability slots into. Must reference existing families. */
  appliesTo: string[]
  /** Files the capability provides. Kept small — real capabilities ship 1-4 files. */
  slotFiles?: string[]
  productCues?: string[]
}

export interface CapabilityProposal {
  id: string
  proposalDir: string
  manifest: Record<string, unknown>
  templateFiles: { path: string; body: string }[]
  peerCapabilities: string[]
  mode: 'llm' | 'llm-rlm' | 'deterministic'
  reasoning: string
}

interface PeerSummary {
  id: string
  description: string
  appliesTo: string[]
  keywords: string[]
}

function loadPeerCapabilities(appliesTo: string[], limit: number): PeerSummary[] {
  const root = join(REPO, 'registry/layers/capability')
  if (!existsSync(root)) return []
  const rows: PeerSummary[] = []
  for (const id of readdirSync(root)) {
    if (id.startsWith('.') || id.startsWith('_')) continue
    const mp = join(root, id, 'manifest.json')
    if (!existsSync(mp)) continue
    try {
      const m = JSON.parse(readFileSync(mp, 'utf8')) as {
        id: string
        description?: string
        appliesTo?: string[]
        keywords?: string[]
      }
      rows.push({
        id: m.id,
        description: m.description ?? '',
        appliesTo: m.appliesTo ?? [],
        keywords: m.keywords ?? [],
      })
    } catch {
      /* skip */
    }
  }
  // Rank by appliesTo overlap with the target — closest analogs first.
  return rows
    .map((r) => ({ r, score: r.appliesTo.filter((f) => appliesTo.includes(f)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ r }) => r)
}

const hintsAuthor = ax(
  'capabilityId:string, capabilityDescription:string, appliesToFamilies:string, slotFilesSummary:string, productCues:string, peerCapabilitiesSummary:string -> whenToUse:string, extensionPoints:string[], capabilityRequires:string[], keywordsTier1:string[], keywordsTier2:string[], defaultsJson:string, reasoning:string',
)

const fileAuthor = ax(
  'capabilityId:string, capabilityDescription:string, appliesToFamilies:string, filePath:string, fileRole:string, peerCapabilitiesSummary:string -> fileBody:string',
)

function slotForFile(filePath: string): string {
  if (filePath.endsWith('.json')) return 'configuration or data JSON the capability wires in'
  if (filePath.endsWith('.md'))
    return 'capability documentation — when to use, extension points, gotchas'
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx'))
    return 'TypeScript source — a component, route, or handler the capability drops in'
  return `${filePath} — slot file for the capability`
}

function slotFilesForCapability(input: ProposeCapabilityInput): { path: string; role: string }[] {
  const explicit = input.slotFiles ?? []
  if (explicit.length > 0) return explicit.map((p) => ({ path: p, role: slotForFile(p) }))
  // Default: one config json + one markdown doc. Agent extends from there.
  return [
    { path: `${input.id}-config.json`, role: slotForFile(`${input.id}-config.json`) },
    { path: `${input.id}.md`, role: slotForFile(`${input.id}.md`) },
  ]
}

async function proposeViaLLM(
  input: ProposeCapabilityInput,
  peers: PeerSummary[],
): Promise<CapabilityProposal | null> {
  if (!isLLMAvailable()) return null
  const llm = createLLM({ fallback: true })
  const peerSummary = peers
    .map((p) => `- ${p.id} (${p.appliesTo.join(', ') || '*'}): ${p.description}`)
    .join('\n')
  const slotFiles = slotFilesForCapability(input)
  try {
    const hints = (await hintsAuthor.forward(llm, {
      capabilityId: input.id,
      capabilityDescription: input.description,
      appliesToFamilies: input.appliesTo.join(', '),
      slotFilesSummary: slotFiles.map((f) => `${f.path} — ${f.role}`).join('\n'),
      productCues: (input.productCues ?? []).join('\n- ') || '(none)',
      peerCapabilitiesSummary: peerSummary || '(no peers found)',
    })) as {
      whenToUse?: string
      extensionPoints?: string[]
      capabilityRequires?: string[]
      keywordsTier1?: string[]
      keywordsTier2?: string[]
      defaultsJson?: string
      reasoning?: string
    }
    const templateFiles: { path: string; body: string }[] = []
    for (const f of slotFiles) {
      try {
        const body = (await fileAuthor.forward(llm, {
          capabilityId: input.id,
          capabilityDescription: input.description,
          appliesToFamilies: input.appliesTo.join(', '),
          filePath: f.path,
          fileRole: f.role,
          peerCapabilitiesSummary: peerSummary,
        })) as { fileBody?: string }
        if (body.fileBody && body.fileBody.length > 10) {
          templateFiles.push({ path: f.path, body: body.fileBody })
        }
      } catch (err) {
        console.error(`[capability-propose] file ${f.path} failed: ${(err as Error).message}`)
      }
    }
    let parsedDefaults: Record<string, unknown> = {}
    try {
      parsedDefaults = JSON.parse(hints.defaultsJson ?? '{}') as Record<string, unknown>
    } catch {
      /* tolerate bad JSON; defaults are optional */
    }
    const manifest = {
      id: input.id,
      description:
        input.description.length >= 20 ? input.description : `${input.description} — capability`,
      appliesTo: input.appliesTo,
      defaults: parsedDefaults,
      files: templateFiles.map((f) => ({ source: `files/${f.path}`, target: f.path })),
      contextHints: {
        extensionPoints: hints.extensionPoints ?? templateFiles.map((f) => f.path),
      },
      capabilityRequires: hints.capabilityRequires ?? [],
      keywords: [...(hints.keywordsTier1 ?? []), ...(hints.keywordsTier2 ?? [])],
      tieredKeywords: {
        tier1: hints.keywordsTier1 ?? [input.id],
        tier2: hints.keywordsTier2 ?? [],
      },
      buildHints: {
        whenToUse: hints.whenToUse ?? input.description,
      },
    }
    return {
      id: input.id,
      proposalDir: join(PROPOSALS_DIR, input.id),
      manifest,
      templateFiles,
      peerCapabilities: peers.map((p) => p.id),
      mode: 'llm',
      reasoning: hints.reasoning ?? '',
    }
  } catch (err) {
    console.error(`[capability-propose] LLM call failed: ${(err as Error).message}`)
    return null
  }
}

function proposeDeterministic(
  input: ProposeCapabilityInput,
  peers: PeerSummary[],
): CapabilityProposal {
  const manifest = {
    id: input.id,
    description: `${input.description} — capability (regenerate before shipping)`,
    appliesTo: input.appliesTo,
    defaults: {},
    files: [],
    contextHints: { extensionPoints: [] },
    capabilityRequires: [],
    keywords: [input.id],
    tieredKeywords: { tier1: [input.id], tier2: [] },
    buildHints: {
      whenToUse: `TODO: when to use ${input.id}. Peers: ${peers
        .slice(0, 3)
        .map((p) => p.id)
        .join(', ')}`,
    },
  }
  return {
    id: input.id,
    proposalDir: join(PROPOSALS_DIR, input.id),
    manifest,
    templateFiles: [],
    peerCapabilities: peers.map((p) => p.id),
    mode: 'deterministic',
    reasoning: 'No LLM provider available — emitting TODO skeleton.',
  }
}

interface CapabilityDraftState {
  manifest: Record<string, unknown> | null
  templateFiles: { path: string; body: string }[]
  reasoning: string
}

function validateCapabilityDraft(
  state: CapabilityDraftState,
  id: string,
  appliesTo: string[],
): string[] {
  const errors: string[] = []
  const m = state.manifest
  if (!m) return ['manifest is null']
  if (m.id !== id) errors.push(`id mismatch: manifest.id=${String(m.id)} but expected ${id}`)
  const desc = typeof m.description === 'string' ? m.description : ''
  if (!desc || desc.length < 20) errors.push('description missing or <20 chars')
  const applies = m.appliesTo
  if (!Array.isArray(applies) || applies.length === 0)
    errors.push('appliesTo must be non-empty array')
  else {
    for (const fam of appliesTo) {
      if (!applies.includes(fam)) errors.push(`appliesTo must include ${fam}`)
    }
  }
  const serialized = JSON.stringify(m)
  if (serialized.includes('TODO:') || serialized.includes('TODO '))
    errors.push('TODO placeholders present')
  const tier1 = (m.tieredKeywords as Record<string, unknown> | undefined)?.tier1
  if (!Array.isArray(tier1) || tier1.length < 2)
    errors.push('tieredKeywords.tier1 must have ≥2 entries')
  if (state.templateFiles.length === 0) errors.push('no template files generated')
  for (const f of state.templateFiles) {
    if (typeof f.body !== 'string' || f.body.length < 20) {
      errors.push(`file ${f.path} body <20 chars (stub)`)
    }
  }
  return errors
}

const capabilityReviewer = ax(
  '"Direct the next shot of a capability proposer. You do NOT grade — the verifier flagged failures. Identify root cause (missing appliesTo? weak description? stub file bodies?) and emit a concrete next-shot instruction. Do not restate failures." goal:string, currentDraftSummary:string, verificationFailures:string[], priorShotsMemory:string -> observations:string, diagnosis:string, nextShotInstruction:string, shouldContinue:boolean, confidence:number',
)

export interface ProposeCapabilityOptions {
  maxShots?: number
}

async function proposeCapabilityWithRLM(
  input: ProposeCapabilityInput,
  opts: ProposeCapabilityOptions = {},
): Promise<CapabilityProposal | null> {
  if (!isLLMAvailable()) return null
  const peers = loadPeerCapabilities(input.appliesTo, 5)
  const llm = createLLM({ fallback: true })
  const maxShots = opts.maxShots ?? 3

  const propose: ProposeFn<CapabilityDraftState> = async ({ priorReview }) => {
    const cues = priorReview?.nextShotInstruction
      ? [...(input.productCues ?? []), `REVIEWER DIRECTIVE: ${priorReview.nextShotInstruction}`]
      : (input.productCues ?? [])
    const p = await proposeViaLLM({ ...input, productCues: cues }, peers)
    if (!p) {
      return { state: { manifest: null, templateFiles: [], reasoning: '(proposer returned null)' } }
    }
    return {
      state: { manifest: p.manifest, templateFiles: p.templateFiles, reasoning: p.reasoning },
    }
  }

  const verify: VerifyFn<CapabilityDraftState> = async (state) => {
    const errors = validateCapabilityDraft(state, input.id, input.appliesTo)
    const pass = errors.length === 0
    const score = pass ? 1 : Math.max(0, 1 - errors.length / 8)
    const result: Verification = { pass, score, failingLayers: errors.slice(0, 5), details: errors }
    return result
  }

  const review: ReviewFn<CapabilityDraftState> = async ({
    state,
    verification,
    memory,
    shot,
    goal,
  }) => {
    const failures = (verification.details as string[] | undefined) ?? []
    const priorMem =
      memory
        .map(
          (m) =>
            `shot ${m.shot} conf=${m.confidence.toFixed(2)} instr="${m.nextShotInstruction.slice(0, 200)}"`,
        )
        .join('\n') || '(none)'
    const tier1 = (state.manifest?.tieredKeywords as Record<string, unknown> | undefined)?.tier1
    const tier1Len = Array.isArray(tier1) ? tier1.length : 0
    const desc = typeof state.manifest?.description === 'string' ? state.manifest.description : ''
    const applies = state.manifest?.appliesTo
    const summary = `id=${String(state.manifest?.id)} desc="${desc.slice(0, 120)}" applies=${Array.isArray(applies) ? applies.join(',') : '?'} files=${state.templateFiles.length} tier1=${tier1Len}`
    const raw = (await capabilityReviewer.forward(llm, {
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
    return {
      observations: String(raw.observations ?? `shot ${shot} had ${failures.length} failures`),
      diagnosis: String(raw.diagnosis ?? 'no diagnosis'),
      nextShotInstruction: String(raw.nextShotInstruction ?? 'fix failures'),
      shouldContinue:
        typeof raw.shouldContinue === 'boolean' ? raw.shouldContinue : shot < maxShots,
      confidence: Number.isFinite(raw.confidence) ? Number(raw.confidence) : 0.5,
    }
  }

  const initialState: CapabilityDraftState = { manifest: null, templateFiles: [], reasoning: '' }
  const report = await runProposeReview<CapabilityDraftState>({
    goal: `Generate a complete, promotable capability registry entry for ${input.id}: ${input.description}`,
    initialState,
    propose,
    verify,
    review,
    maxShots,
    scenarioId: 'capability-proposer',
    projectId: input.id,
  })

  if (!report.finalState.manifest) return null

  return {
    id: input.id,
    proposalDir: join(PROPOSALS_DIR, input.id),
    manifest: report.finalState.manifest,
    templateFiles: report.finalState.templateFiles,
    peerCapabilities: peers.map((p) => p.id),
    mode: 'llm-rlm',
    reasoning: `RLM ${report.shots.length} shot(s), pass=${report.finalVerification.pass}, score=${report.score.toFixed(2)}. ${report.finalState.reasoning}`,
  }
}

export async function proposeCapabilityWithRLMToDisk(
  input: ProposeCapabilityInput,
  opts: ProposeCapabilityOptions = {},
): Promise<CapabilityProposal> {
  const rlmProposal = await proposeCapabilityWithRLM(input, opts)
  const peers = loadPeerCapabilities(input.appliesTo, 5)
  const proposal = rlmProposal ?? proposeDeterministic(input, peers)

  mkdirSync(proposal.proposalDir, { recursive: true })
  writeFileSync(
    join(proposal.proposalDir, 'manifest.json'),
    JSON.stringify(proposal.manifest, null, 2) + '\n',
  )
  writeFileSync(
    join(proposal.proposalDir, '.meta.json'),
    JSON.stringify(
      {
        id: proposal.id,
        appliesTo: input.appliesTo,
        peerCapabilities: proposal.peerCapabilities,
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
  const filesDir = join(proposal.proposalDir, 'files')
  mkdirSync(filesDir, { recursive: true })
  const stat = statSync(filesDir)
  if (stat.isDirectory()) {
    const keep = join(filesDir, '.gitkeep')
    if (!existsSync(keep)) writeFileSync(keep, '')
  }
  return proposal
}
