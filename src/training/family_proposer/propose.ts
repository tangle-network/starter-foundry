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
import { createLLM, isLLMAvailable } from '../../lib/llm.js'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const PROPOSALS_DIR = join(REPO, '.evolve/family-proposals')

export interface ProposeFamilyInput {
  id: string
  description: string
  taxonomy: { language: string; runtime: string; surface: string }
  /** Optional: rough list of what the scaffold must ship. */
  productCues?: string[]
}

export interface FamilyProposal {
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
  if (filePath === 'docker-compose.yml') return 'docker compose with the primary service + volume'
  if (filePath === 'requirements.txt') return 'Python deps pinned to current major versions'
  if (filePath === 'pyproject.toml') return 'Python package metadata + deps'
  if (filePath.endsWith('.mjs')) return 'Node validator asserting key files + deps structure'
  if (filePath === 'README.md') return 'Quickstart + agent-facing extension guide'
  return `${filePath} — agent-extensible entry file`
}

function filesForTaxonomy(taxonomy: { language: string; runtime: string; surface: string }): Array<{ path: string; role: string }> {
  const lang = taxonomy.language
  const runtime = taxonomy.runtime
  const surface = taxonomy.surface
  // Minimal file sets per common (lang, runtime, surface). Agent still edits
  // the bodies — we just give the scaffolding list.
  if (lang === 'typescript' && runtime === 'node' && surface === 'frontend') {
    return ['package.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'src/main.ts'].map((p) => ({
      path: p,
      role: slotForFile(p, runtime),
    }))
  }
  if (lang === 'typescript' && (surface === 'api' || surface === 'inference')) {
    return ['package.json', 'tsconfig.json', 'src/index.ts', `validate-${taxonomy.runtime}.mjs`].map((p) => ({
      path: p,
      role: slotForFile(p, runtime),
    }))
  }
  if (lang === 'python') {
    return ['requirements.txt', 'src/main.py', '.env.example', `validate-${taxonomy.runtime}.mjs`].map((p) => ({
      path: p,
      role: slotForFile(p, runtime),
    }))
  }
  // Generic fallback: just a README + validator, agent fills the rest.
  return [{ path: 'README.md', role: slotForFile('README.md', runtime) }]
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
