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
// `scripts/new-family.ts` skeleton (deterministic TODO stubs).

import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ax } from '@ax-llm/ax'
import {
  runProposeReview,
  inMemoryReviewStore,
  type ProposeFn,
  type VerifyFn,
  type ReviewFn,
  type Verification,
  type ReviewMemoryEntry,
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
  templateFiles: { path: string; body: string }[]
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
  if (a.language !== b.language) dist += 1
  if (a.runtime !== b.runtime) dist += 1
  if (a.surface !== b.surface) dist += 1
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

// R3: file author now takes refinementHints so the RLM reviewer's
// nextShotInstruction reaches the file-body generation, not just the
// manifest hints. Without this, fileAuthor produced byte-identical
// package.json across shots no matter what guidance was given.
const fileAuthor = ax(
  'familyId:string, familyDescription:string, taxonomyLanguage:string, taxonomyRuntime:string, taxonomySurface:string, filePath:string, fileRole:string, peerFamiliesSummary:string, refinementHints:string[] -> fileBody:string',
)

function slotForFile(filePath: string, runtime: string, surface?: string): string {
  // R3: prescriptive slots — include exact schema requirements (keys, scripts,
  // imports) so the fileAuthor LLM doesn't default to its canned boilerplate
  // (jest + tsc + node src/index.ts). Without this, the file author ignores
  // refinementHints and regenerates the same package.json every shot.
  if (filePath === 'package.json') {
    if (surface === 'frontend') {
      return 'Vite+React package manifest with EXACTLY these scripts: {"dev":"vite","build":"tsc --noEmit && vite build","preview":"vite preview","test":"vitest run"}. Dependencies: react, react-dom. DevDependencies: @types/react, @types/react-dom, @vitejs/plugin-react, typescript ^5, vite, vitest. NO jest, NO start script, NO TypeScript 4.x. Set "type": "module" and "private": true.'
    }
    if (surface === 'api' || surface === 'agent') {
      return 'Node/TS API package manifest with scripts: {"dev":"tsx watch src/index.ts","build":"tsc","start":"node dist/index.js","test":"vitest run"}. DevDependencies: tsx, typescript ^5, vitest, @types/node. Set "type":"module" and "private":true.'
    }
    if (surface === 'cli') {
      return 'Node/TS CLI package manifest with {"dev":"tsx src/cli.ts","build":"tsc","test":"vitest run"} and a "bin" field pointing at dist/cli.js. DevDependencies: tsx, typescript ^5, vitest.'
    }
    if (surface === 'tooling') {
      return 'TS tooling package manifest: {"dev":"tsx src/runner.ts","test":"vitest run","build":"tsc"}. DevDependencies: tsx, vitest, typescript ^5.'
    }
    return 'package manifest with "dev" + "build" + "test" scripts and pinned TypeScript ^5 (NOT ^4.x).'
  }
  if (filePath === 'tsconfig.json')
    return 'strict TS5 config: target es2022, module esnext, moduleResolution bundler, jsx react-jsx (if frontend), strict true, noEmit true, skipLibCheck true, lib ["es2022","dom","dom.iterable"].'
  if (filePath === 'vite.config.ts')
    return 'Vite config importing @vitejs/plugin-react, with defineConfig({ plugins: [react()], server: { port: 5173 } }).'
  if (filePath === 'index.html')
    return 'HTML5 shell: <!doctype html>, <div id="root"></div>, <script type="module" src="/src/main.tsx">, responsive viewport meta.'
  if (filePath === 'src/main.ts' || filePath === 'src/main.tsx') {
    if (surface === 'frontend')
      return 'React entrypoint: import React, ReactDOM; createRoot(document.getElementById("root")).render(<App />). MUST NOT import node:http or createServer — this is browser code.'
    return `main entrypoint for the ${runtime} starter`
  }
  if (filePath === 'src/App.tsx')
    return "React App component — functional component with useState for app-local state, renders a simple UI surfacing the family's domain."
  if (filePath === 'src/index.ts') {
    if (surface === 'api')
      return 'HTTP server entrypoint using Hono or native Node http, /health endpoint returning 200.'
    if (surface === 'agent')
      return 'Agent entrypoint: import agent loop, wire tools, start chat step runner.'
    return `main entrypoint for the ${runtime} starter`
  }
  if (filePath === 'src/cli.ts') return 'commander-based CLI entrypoint with --help surface'
  if (filePath === 'src/agent.ts')
    return 'agent loop entrypoint — tool registry + chat step function'
  if (filePath === 'src/runner.ts') return 'batch runner that iterates scenarios/ + writes results'
  if (filePath === 'scenarios/example.ts') return 'example scenario file the harness picks up'
  if (filePath === 'judges/example.ts') return 'example rubric judge returning {score, rationale}'
  if (filePath === '.env.example')
    return 'Environment variables the app reads. List every var with a short comment. Never include real secrets. Frontend vars use VITE_ prefix.'
  if (filePath === 'docker-compose.yml') return 'docker compose with the primary service + volume'
  if (filePath === 'requirements.txt') return 'Python deps pinned to current major versions'
  if (filePath === 'pyproject.toml') return 'Python package metadata + deps'
  if (filePath === 'Cargo.toml') return 'Rust crate manifest with pinned deps + binary target'
  if (filePath === 'src/main.rs') return 'Rust binary entrypoint — tokio::main + startup wiring'
  if (filePath === 'src/lib.rs') return 'Rust library entrypoint — public module re-exports'
  if (filePath === 'go.mod') return 'Go module declaration with Go version + deps'
  if (filePath === 'main.go') return 'Go binary entrypoint with main() and top-level wiring'
  if (filePath.endsWith('.mjs')) return 'Node validator asserting key files + deps structure'
  if (filePath === 'README.md') {
    if (surface === 'agent-runtime')
      return 'Bundle README with THESE exact sections in order: "## What this bundle is" (one paragraph: this is a system prompt + domain templates + cron/webhook triggers for an agent-in-a-sandbox; no `pnpm build` step), "## How a sandbox spawns it" (what file the agent reads first — system-prompt.md — and how templates/ get resolved), "## Domain capabilities" (bullet list mirroring defaults.declaredCapabilities), "## Extension Points" (the 2-3 files a downstream BA-dispatched agent will edit). NO start scripts, NO npm install instructions for non-Worker bundles.'
    return 'Project README with THESE exact section headers in order: "## Quickstart" (npm/pnpm install + dev command), "## Environment" (list every VITE_ / env var from .env.example with a one-line description + where to obtain the value), "## Architecture" (what src/main and src/App do, what deps are used for), "## Extension Points" (the 2-3 files an agent will most likely edit when building on this starter). Write as if the reader is a staff engineer who has never seen the domain — explain every non-obvious design choice. No marketing fluff, no emojis.'
  }
  // multi-agent-team surface — curated team of role agents with an
  // OpenCode-native subagent registry (agents.json) and an orchestrator
  // AGENTS.md that includes a "## Coordination" section.
  if (surface === 'multi-agent-team') {
    if (filePath === 'AGENTS.md')
      return 'Top-level orchestrator system prompt. MUST start with YAML frontmatter (name / role / domain / team / version). Required sections: "## Role" (one paragraph naming the N roles), "## The team and what each role is for" (bulleted role list with one-line descriptions), "## Delegation protocol" (routing rules + 3-4 concrete examples), "## Coordination" (folds in the team protocol — routing table or rules, handoff format with code block, escalation triggers, joint-decision cadence if applicable, failure modes). The Coordination section is the source of truth for inter-role behavior; when the role training disagrees with it, the protocol wins.'
    if (filePath === 'agents.json')
      return 'OpenCode-native subagent registry consumed by the Tangle sandbox sidecar (apps/sidecar/src/agents/subagents/load-agents-config.ts). Shape: {"<role-id>":{"mode":"subagent","description":"<one-line>","prompt":"<INLINE FULL TEXT of roles/<role-id>/AGENTS.md — not a path>","tools":{"bash":<bool>,"edit":<bool>,"read":<bool>,"write":<bool>,"webfetch":<bool>},"permission":{"edit":"allow|deny","webfetch":"allow|deny","bash":"allow|deny"}}}. Conservative defaults: read+write+webfetch on; bash+edit deny. High-stakes bundles handling PII set webfetch:false + permission.webfetch:"deny" on intake roles.'
    if (filePath.startsWith('roles/') && filePath.endsWith('/AGENTS.md'))
      return 'Per-role system prompt. MUST start with YAML frontmatter (name / role / domain / allowedDomains / allowedEnv / version). MUST reference the orchestrator AGENTS.md Coordination section and the team-wide rules. MUST list initiating + receiving handoffs with concrete triggers. Must declare role-specific authoritative skills loadable from methodology/. The full text becomes the inline `prompt` in agents.json.'
    if (
      filePath.startsWith('roles/') &&
      filePath.includes('/methodology/') &&
      filePath.endsWith('.md')
    )
      return 'Per-role methodology (>=60 lines, no stub). Real craft methodology — diagnostics, procedures, artifact shapes, anti-patterns, when-to-escalate. When the methodology has a cross-medium variant (e.g., scoring for picture, voice signature for cover), include that variant explicitly with concrete examples; do not bury it in prose.'
  }

  // agent-runtime surface — bundles ship a system prompt + domain templates + (CF Worker or local-CLI) triggers.
  if (surface === 'agent-runtime') {
    if (filePath === 'system-prompt.md')
      return 'Layered system prompt for the agent-in-sandbox. MUST start with YAML frontmatter (---\\nname: <id>\\nrole: <one-line>\\ndomain: <one-line>\\nallowedDomains: []\\nallowedEnv: []\\n---) followed by sections: "## Role", "## Authoritative skills" (relative refs to skills/*.md), "## Output blocks" (declares :::<block> grammar the UI parses, e.g. :::proposal, :::filing, :::artifact), "## Refusal & escalation" (when to refuse, when to escalate to a human). Concise, directive, no examples in the prompt body — examples live in templates/.'
    if (filePath === 'templates/index.json')
      return 'JSON index of domain templates. Shape: {"entries":[{"id":"<slug>","capability":"<declared-capability-id>","path":"./<file.md>","tags":["..."],"version":"0.1.0"}]}. Every declared capability in defaults.declaredCapabilities MUST appear as the capability field on at least one entry. Every "path" MUST resolve to an existing file relative to this index.'
    if (filePath.startsWith('templates/') && filePath.endsWith('.md'))
      return 'Domain template (>=40 lines, no stub). Reference content the agent reads at runtime — examples, rule files, form-mappings, persona briefs. Concrete, sourced, dated where applicable. Frontmatter MUST include source + retrieved (ISO date) when citing factual material; no factual claim ships without provenance.'
    if (filePath.startsWith('skills/') && filePath.endsWith('.md'))
      return 'Conditional skill (>=30 lines). Loaded by name from system-prompt.md "Authoritative skills" list. Domain rules + cross-references to templates. No directive that contradicts the base prompt.'
    if (filePath === 'wrangler.toml')
      return 'Cloudflare Worker config for agent-runtime bundle. Sections: [vars] (only allowlisted public vars from defaults.publicVars — NEVER secrets), [[d1_databases]] with binding="DB" + database_name="<replace-me>" + database_id="<replace-me>" placeholder (consumer provisions), [[kv_namespaces]] with binding="VAULT", [triggers] crons = ["<minute> <hour> * * *"] where <minute> is the literal token RANDOM_MINUTE (substituted at compose time per bundleId hash). NO inline secrets, NO `* * * * *` crons.'
    if (filePath === 'src/index.ts')
      return 'CF Worker entrypoint exporting fetch + scheduled handlers. fetch: streaming chat against the agent — POST /api/chat dispatches to the agent loop, reads system-prompt.md + templates index, passes through structured output blocks. scheduled(): wakes on cron, runs deadline/feedback checks declared in defaults.scheduled. Both handlers MUST gate on Authorization unless the route is in defaults.routes with auth: "none".'
    if (filePath === 'agent.config.json')
      return 'Local-CLI bundle config. Shape: {"runtime":"local-cli","triggers":[{"id":"<slug>","cron":"<expr>","cmd":"<argv>"}],"tools":["<sandbox-tool-id>"]}. Substitutes for wrangler.toml on local-CLI variant; same cron-syntax constraints apply.'
  }
  return `${filePath} — agent-extensible entry file`
}

function filesForTaxonomy(taxonomy: {
  language: string
  runtime: string
  surface: string
}): { path: string; role: string }[] {
  const lang = taxonomy.language
  const runtime = taxonomy.runtime
  const surface = taxonomy.surface
  const validator = `validate-${runtime}.mjs`
  const toFiles = (paths: string[]) =>
    paths.map((p) => ({ path: p, role: slotForFile(p, runtime, surface) }))

  // multi-agent-team surface — curated team bundle: harness-native
  // AGENTS.md (orchestrator + Coordination section) + agents.json
  // (OpenCode-native subagent registry consumed by the Tangle sandbox
  // sidecar) + per-role AGENTS.md + per-role methodology files.
  // Markdown + JSON only; no Worker shell.
  if (surface === 'multi-agent-team') {
    return toFiles([
      'AGENTS.md',
      'agents.json',
      'roles/example-role/AGENTS.md',
      'README.md',
      validator,
    ])
  }

  // agent-runtime surface — bundles span markdown + (CF Worker or local-CLI) triggers.
  // Triggered via taxonomy.surface, not language: a bundle whose primary content
  // is markdown still ships a TS Worker shell when runtime=cloudflare-worker.
  if (surface === 'agent-runtime') {
    const baseMd = [
      'system-prompt.md',
      'templates/index.json',
      'templates/example.md',
      'README.md',
      validator,
    ]
    if (runtime === 'cloudflare-worker') {
      return toFiles([...baseMd, 'wrangler.toml', 'src/index.ts', 'package.json', 'tsconfig.json'])
    }
    if (runtime === 'local-cli') {
      return toFiles([...baseMd, 'agent.config.json'])
    }
    return toFiles(baseMd)
  }

  // TypeScript / Node / Bun / Deno / CF-Worker permutations
  if (lang === 'typescript' || lang === 'javascript') {
    if (surface === 'frontend') {
      return toFiles([
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'index.html',
        'src/main.tsx',
        'src/App.tsx',
        '.env.example',
        'README.md',
        validator,
      ])
    }
    if (surface === 'api' || surface === 'inference') {
      return toFiles([
        'package.json',
        'tsconfig.json',
        'src/index.ts',
        '.env.example',
        'README.md',
        validator,
      ])
    }
    if (surface === 'cli') {
      return toFiles([
        'package.json',
        'tsconfig.json',
        'src/cli.ts',
        'src/index.ts',
        'README.md',
        validator,
      ])
    }
    if (surface === 'agent') {
      return toFiles([
        'package.json',
        'tsconfig.json',
        'src/agent.ts',
        'src/index.ts',
        '.env.example',
        'README.md',
        validator,
      ])
    }
    if (surface === 'tooling') {
      // Eval/test-harness-shaped project: scenarios + judges + runner + validator.
      return toFiles([
        'package.json',
        'tsconfig.json',
        'src/runner.ts',
        'scenarios/example.ts',
        'judges/example.ts',
        'README.md',
        validator,
      ])
    }
    // Unknown TS surface: still give a real scaffold, not a bare README.
    return toFiles(['package.json', 'tsconfig.json', 'src/index.ts', 'README.md', validator])
  }

  // Python permutations
  if (lang === 'python') {
    if (surface === 'api') {
      return toFiles([
        'pyproject.toml',
        'requirements.txt',
        'src/main.py',
        '.env.example',
        'README.md',
        validator,
      ])
    }
    if (surface === 'cli') {
      return toFiles(['pyproject.toml', 'requirements.txt', 'src/cli.py', 'README.md', validator])
    }
    if (surface === 'agent') {
      return toFiles([
        'pyproject.toml',
        'requirements.txt',
        'src/agent.py',
        'src/main.py',
        'README.md',
        validator,
      ])
    }
    // Default python surface
    return toFiles([
      'pyproject.toml',
      'requirements.txt',
      'src/main.py',
      '.env.example',
      'README.md',
      validator,
    ])
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

async function proposeViaLLM(
  input: ProposeFamilyInput,
  peers: PeerSummary[],
): Promise<FamilyProposal | null> {
  if (!isLLMAvailable()) return null
  const llm = createLLM()
  const peerSummary = peers
    .map(
      (p) =>
        `- ${p.id} (${p.taxonomy.language ?? '?'}/${p.taxonomy.runtime ?? '?'}/${p.taxonomy.surface ?? '?'}): ${p.description}`,
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
    const templateFiles: { path: string; body: string }[] = []
    // Extract reviewer directives from productCues for the file generator.
    // The RLM wrapper prefixes its directives with "REVIEWER DIRECTIVE" so
    // they're distinguishable from plain product cues. Ax rejects empty
    // string[] inputs as missing — use ['(no refinements yet)'] as the
    // shot-1 sentinel so the field is always populated.
    const directives = (input.productCues ?? []).filter((c) =>
      /REVIEWER DIRECTIVE|REFINEMENT GUIDANCE|prior fidelity rejection/i.test(c),
    )
    const refinementHints =
      directives.length > 0 ? directives : ['(shot 1 — no prior reviewer directives)']
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
          refinementHints,
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
      description:
        input.description.length >= 20
          ? input.description
          : `${input.description} — ${input.taxonomy.runtime} ${input.taxonomy.surface} starter`,
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
          ? [
              {
                path: hints.primaryEntrypoint,
                description: `Primary entrypoint agents must extend.`,
              },
            ]
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
    description:
      input.description.length >= 20
        ? input.description
        : `${input.description} — starter (regenerate before shipping)`,
    tags: [input.taxonomy.runtime, input.taxonomy.surface, input.taxonomy.language],
    taxonomy: input.taxonomy,
    defaults: { projectType: input.taxonomy.surface, serviceName: `starter-foundry-${input.id}` },
    files: [],
    validationChecks: [],
    contextHints: { commands: [], entrypoints: [], preview: null, extensionPoints: [] },
    keywords: [input.id],
    tieredKeywords: { tier1: [input.id], tier2: [] },
    buildHints: {
      whenToUse: `TODO: describe when a prompt should route to ${input.id}. Derive from peer families: ${peers
        .slice(0, 3)
        .map((p) => p.id)
        .join(', ')}.`,
      firstSteps: [
        'TODO: install command',
        'TODO: dev-server command',
        'TODO: entrypoint an agent should extend',
      ],
      gotchas: ['TODO: one non-obvious trap specific to this runtime'],
      placeholders: [
        { path: 'TODO/entrypoint.xyz', description: 'TODO: primary file agents must replace.' },
      ],
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
    reasoning:
      'No router key available — emitting TODO skeleton; human fills in template files + buildHints.',
  }
}

export async function proposeFamily(input: ProposeFamilyInput): Promise<FamilyProposal> {
  const peers = loadPeerSummaries(input.taxonomy, 5)
  const llmProposal = await proposeViaLLM(input, peers)
  const proposal = llmProposal ?? proposeDeterministic(input, peers)

  mkdirSync(proposal.proposalDir, { recursive: true })
  writeFileSync(
    join(proposal.proposalDir, 'manifest.json'),
    JSON.stringify(proposal.manifest, null, 2) + '\n',
  )
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
  templateFiles: { path: string; body: string }[]
  reasoning: string
}

const proposalReviewer = ax(
  '"Direct the next shot of a registry-family proposer. You do NOT grade — the verifier already flagged the failures. Read the draft summary + failures + prior shots, identify the root cause (missing tier1 keywords? weak description? TODO bodies? wrong taxonomy fields?), and emit a concrete, actionable instruction for the next shot. Do not restate the failures. Direct the worker to fix them in order of blast radius." goal:string, currentDraftSummary:string, verificationFailures:string[], priorShotsMemory:string -> observations:string, diagnosis:string, nextShotInstruction:string, shouldContinue:boolean, confidence:number',
)

/**
 * R3: read past `event: 'fidelity-fail'` entries from the generation-impact
 * log for this id and synthesize ReviewMemoryEntry records the RLM reviewer
 * can see as "prior shots." This is the cheap cross-session learning path —
 * the proposer sees what the downstream fidelity judge rejected before and
 * avoids repeating it, without any extra LLM calls per shot.
 *
 * Returns [] when the log is missing, malformed, or has no matching events.
 */
function loadPriorFidelityEntries(id: string): ReviewMemoryEntry[] {
  try {
    const logPath = join(REPO, '.evolve/generation-impact.jsonl')
    const raw = readFileSync(logPath, 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    const entries: ReviewMemoryEntry[] = []
    let shotCounter = 0
    for (const line of lines) {
      let ev: {
        event?: string
        id?: string
        overall?: number
        verdict?: string
        topIssue?: string | null
        ts?: string
      } = {}
      try {
        ev = JSON.parse(line)
      } catch {
        continue
      }
      if (ev.event !== 'fidelity-fail') continue
      if (String(ev.id) !== id) continue
      const ts = Date.parse(ev.ts ?? '') || Date.now()
      const topIssue = ev.topIssue ?? 'fidelity judge rejected this scaffold in a prior session'
      shotCounter += 1
      entries.push({
        shot: shotCounter,
        timestamp: ts,
        observations: `Prior session: fidelity judge returned verdict=${ev.verdict ?? 'fail'}, overall=${(ev.overall ?? 0).toFixed(2)}.`,
        diagnosis:
          'Previous proposer attempt was rejected downstream by the scaffold-fidelity judge.',
        nextShotInstruction: `Prior fidelity rejection: "${topIssue}". Do NOT repeat this defect in the new draft — explicitly address it by adjusting file bodies (e.g., add the missing script, add .env.example, fix taxonomy/implementation mismatch).`,
        shouldContinue: true,
        confidence: 0.5,
        verification: { pass: false, score: ev.overall ?? 0, failingLayers: [topIssue] },
      })
    }
    return entries.slice(-3) // at most 3 prior sessions to keep the memory scan cheap
  } catch {
    return []
  }
}

function validateDraftForRLM(
  state: ProposalDraftState,
  id: string,
  taxonomy?: { language: string; runtime: string; surface: string },
): string[] {
  const errors: string[] = []
  const m = state.manifest
  if (!m) return ['manifest is null']
  if (m.id !== id) errors.push(`manifest.id=${String(m.id)} but expected ${id}`)
  const desc = typeof m.description === 'string' ? m.description : ''
  if (!desc || desc.length < 20) errors.push('description missing or <20 chars')
  if (!m.taxonomy) errors.push('missing taxonomy')
  const serialized = JSON.stringify(m)
  if (serialized.includes('TODO:') || serialized.includes('TODO ')) {
    errors.push('TODO placeholders present — proposer emitted a skeleton')
  }
  const tier1 = (m.tieredKeywords as Record<string, unknown> | undefined)?.tier1
  if (!Array.isArray(tier1) || tier1.length < 3)
    errors.push('tieredKeywords.tier1 must have ≥3 entries')
  // R3: tier1 must be domain-specific, not taxonomy restatements. The LLM
  // loves emitting "TypeScript/Node.js/Frontend" which absorbs generic
  // prompts. Reject tier1 overlap with taxonomy tags.
  const taxonomyTerms = new Set(
    [taxonomy?.language, taxonomy?.runtime, taxonomy?.surface]
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .flatMap((s) => [s.toLowerCase(), s.toLowerCase().replace(/[^a-z]/g, '')]),
  )
  const tier1Lower = Array.isArray(tier1) ? tier1.map((k) => String(k).toLowerCase()) : []
  const tier1TaxonomyOverlap = tier1Lower.filter(
    (k) => taxonomyTerms.has(k) || taxonomyTerms.has(k.replace(/[^a-z]/g, '')),
  )
  if (tier1TaxonomyOverlap.length > 0) {
    errors.push(
      `tier1 keywords must be domain-specific, not taxonomy restatements — found ${tier1TaxonomyOverlap.join(', ')} (these are already in tags)`,
    )
  }
  if (state.templateFiles.length === 0)
    errors.push('no template files generated — proposer produced no file bodies')
  for (const f of state.templateFiles) {
    if (typeof f.body !== 'string' || f.body.length < 20) {
      errors.push(`file ${f.path} body <20 chars (stub)`)
    }
  }
  // R3: structural fidelity checks derived from R2 judge patterns. These
  // catch the common Goodhart-failures (build-passes-but-not-useful) before
  // the build gate + fidelity judge ever run.
  const byPath = Object.fromEntries(state.templateFiles.map((f) => [f.path, f.body]))
  const surface = taxonomy?.surface
  const language = taxonomy?.language
  const pkg = byPath['package.json']
  if (pkg && (language === 'typescript' || language === 'javascript')) {
    try {
      const parsed = JSON.parse(pkg) as {
        scripts?: Record<string, string>
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
      const scripts = parsed.scripts ?? {}
      if (surface === 'frontend' && !scripts.dev) {
        errors.push(
          'package.json missing "dev" script — frontend scaffold must expose a dev server command (e.g. "vite")',
        )
      }
      const allDeps = { ...(parsed.dependencies ?? {}), ...(parsed.devDependencies ?? {}) }
      const tsVersion = allDeps.typescript
      if (tsVersion && /^\^?4\./.test(tsVersion)) {
        errors.push(`typescript pinned to ${tsVersion} — use TypeScript 5.x for new scaffolds`)
      }
      if (surface === 'frontend') {
        // A frontend scaffold should either depend on a UI framework or be a
        // static HTML surface. Node-only deps signal a shape mismatch.
        const uiDeps = ['react', 'vue', 'svelte', 'solid-js', 'preact', '@angular/core', 'astro']
        const hasUiDep = uiDeps.some((d) => d in allDeps)
        const hasHtml = 'index.html' in byPath
        if (!hasUiDep && !hasHtml) {
          errors.push(
            'frontend surface but no UI framework dep and no index.html — shape mismatch with taxonomy',
          )
        }
      }
    } catch {
      errors.push('package.json is not valid JSON')
    }
  }
  // Env-var documentation: frontend/api/agent surfaces should ship either
  // .env.example or mention env vars in README. The R2 judge flagged
  // "no environment variables documented" on every shallow draft.
  if (surface === 'frontend' || surface === 'api' || surface === 'agent') {
    const hasEnv = '.env.example' in byPath
    const readme = byPath['README.md'] ?? ''
    const readmeMentionsEnv = /env(ironment)?|\.env|import\.meta\.env|process\.env/.test(readme)
    if (!hasEnv && !readmeMentionsEnv) {
      errors.push(
        `${surface} surface should document env vars — add .env.example or an "Environment" section to README.md`,
      )
    }
  }
  // agent-runtime surface — structural rules the proposer must obey, mirroring the
  // gate-2 validators (prompt-frontmatter-valid, template-index-valid, cron-syntax-valid).
  // Without these checks the LLM happily ships a markdown bundle that schema-passes
  // but has no frontmatter / dangling templates / a cron storm.
  if (surface === 'agent-runtime') {
    const promptBody = byPath['system-prompt.md']
    if (!promptBody) {
      errors.push(
        'agent-runtime bundle missing system-prompt.md — every bundle must declare its layered base prompt',
      )
    } else if (!promptBody.startsWith('---')) {
      errors.push(
        'system-prompt.md does not begin with YAML frontmatter (---) — gate-2 prompt-frontmatter-valid will fail',
      )
    } else {
      const closeIdx = promptBody.indexOf('\n---', 4)
      if (closeIdx === -1) {
        errors.push('system-prompt.md frontmatter is unterminated (missing closing "---")')
      }
    }
    const indexBody = byPath['templates/index.json']
    if (!indexBody) {
      errors.push(
        'agent-runtime bundle missing templates/index.json — capability ↔ template mapping is required',
      )
    } else {
      try {
        const parsed = JSON.parse(indexBody) as {
          entries?: { id?: string; capability?: string; path?: string }[]
        }
        const entries = parsed.entries ?? []
        if (entries.length === 0) {
          errors.push('templates/index.json has zero entries — bundle ships no domain content')
        }
        for (const entry of entries) {
          if (!entry.path) {
            errors.push(`templates/index.json entry id=${entry.id ?? '?'} has no path`)
            continue
          }
          const normalized = entry.path
            .replace(/^\.?\//, 'templates/')
            .replace(/^templates\/templates\//, 'templates/')
          if (!(normalized in byPath) && !(entry.path in byPath)) {
            errors.push(
              `templates/index.json entry "${entry.path}" does not resolve to a generated file (dangling reference)`,
            )
          }
        }
      } catch {
        errors.push('templates/index.json is not valid JSON')
      }
    }
    const wrangler = byPath['wrangler.toml']
    if (wrangler) {
      const cronMatch = /crons\s*=\s*\[([^\]]*)\]/.exec(wrangler)
      if (cronMatch && cronMatch[1]) {
        const exprs = Array.from(cronMatch[1].matchAll(/"([^"]+)"/g)).map((m) => m[1] ?? '')
        for (const expr of exprs) {
          if (expr.trim() === '* * * * *') {
            errors.push(
              `wrangler.toml ships a "* * * * *" cron — fires 60×/hour, gate-2 cron-syntax-valid will fail`,
            )
          }
        }
      }
    }
    // Anti-stub: every template under templates/ (except index.json) must be substantive.
    for (const [p, body] of Object.entries(byPath)) {
      if (!p.startsWith('templates/') || !p.endsWith('.md')) continue
      const lines = body.split('\n').filter((l) => l.trim().length > 0).length
      const hasStubFrontmatter = /^---[\s\S]*?\bstatus:\s*stub\b[\s\S]*?---/.test(body)
      if (lines < 40 && !hasStubFrontmatter) {
        errors.push(
          `${p} is too short (${lines} non-empty lines) — templates need >=40 lines of substance, or explicit "status: stub" frontmatter (which fails the substance gate honestly)`,
        )
      }
    }
  }
  // Frontend mainfile shape: if surface=frontend and language=typescript/javascript,
  // src/main.ts|tsx shouldn't import node-only modules like 'http'. That was
  // the R2 smoking gun — description said frontend, main.ts shipped Node HTTP.
  if (surface === 'frontend' && (language === 'typescript' || language === 'javascript')) {
    for (const p of ['src/main.ts', 'src/main.tsx', 'src/index.ts', 'src/index.tsx']) {
      const body = byPath[p]
      if (!body) continue
      if (
        /\bfrom\s+['"]http['"]/.test(body) ||
        /require\(['"]http['"]\)/.test(body) ||
        body.includes('createServer')
      ) {
        errors.push(
          `${p} imports node:http / createServer — frontend surface must not ship a Node HTTP server in the UI entrypoint`,
        )
      }
    }
  }
  const fm = state.frameworkManifest
  if (fm) {
    const applies = fm.appliesTo
    if (!Array.isArray(applies) || !applies.includes(id)) {
      errors.push('frameworkManifest.appliesTo must include family id')
    }
  }
  return errors
}

export interface ProposeWithRLMOptions {
  maxShots?: number
}

async function proposeFamilyWithRLM(
  input: ProposeFamilyInput,
  opts: ProposeWithRLMOptions = {},
): Promise<FamilyProposal | null> {
  if (!isLLMAvailable()) return null
  const peers = loadPeerSummaries(input.taxonomy, 5)
  const llm = createLLM()
  const maxShots = opts.maxShots ?? 3

  const propose: ProposeFn<ProposalDraftState> = async ({ priorReview }) => {
    const cues = priorReview?.nextShotInstruction
      ? [
          ...(input.productCues ?? []),
          `REVIEWER DIRECTIVE (shot refinement): ${priorReview.nextShotInstruction}`,
        ]
      : (input.productCues ?? [])
    const p = await proposeViaLLM({ ...input, productCues: cues }, peers)
    if (!p) {
      // Proposer failed entirely — return empty state so the verifier flags it.
      return {
        state: {
          manifest: null,
          frameworkManifest: null,
          templateFiles: [],
          reasoning: '(proposer returned null)',
        },
      }
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
    const errors = validateDraftForRLM(state, input.id, input.taxonomy)
    const pass = errors.length === 0
    const score = pass ? 1 : Math.max(0, 1 - errors.length / 10)
    const result: Verification = { pass, score, failingLayers: errors.slice(0, 5), details: errors }
    return result
  }

  const review: ReviewFn<ProposalDraftState> = async ({
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
    const summary = `id=${String(state.manifest?.id)} desc="${desc.slice(0, 120)}" files=${state.templateFiles.length} tier1=${tier1Len}`
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
    // Override: if verification failed AND we have budget, the answer is
    // always "keep trying." The reviewer's role is to DIRECT the next shot,
    // not to decide whether the goal is achievable — that's the verifier's
    // concern. R3 caught the LLM reviewer giving up at shot 1 because the
    // draft "looked OK" despite the verifier flagging missing dev scripts.
    const hasBudget = shot < maxShots
    const shouldContinue =
      failures.length > 0 && hasBudget
        ? true
        : typeof raw.shouldContinue === 'boolean'
          ? raw.shouldContinue
          : hasBudget
    return {
      observations: String(
        raw.observations ?? `shot ${shot} produced ${failures.length} verification failures`,
      ),
      diagnosis: String(raw.diagnosis ?? 'reviewer returned no diagnosis'),
      nextShotInstruction: String(
        raw.nextShotInstruction ?? 'fix the verification failures in priority order',
      ),
      shouldContinue,
      confidence: Number.isFinite(raw.confidence) ? Number(raw.confidence) : 0.5,
    }
  }

  // R3: pre-seed reviewer memory with past fidelity-fail events for this id.
  // Gives shot 1 the benefit of what the downstream fidelity judge flagged in
  // prior sessions — the proposer stops repeating the same failure.
  const priorFidelityEntries = loadPriorFidelityEntries(input.id)

  const initialState: ProposalDraftState = {
    manifest: null,
    frameworkManifest: null,
    templateFiles: [],
    reasoning: '',
  }
  const report = await runProposeReview<ProposalDraftState>({
    goal: `Generate a complete, promotable family registry entry for ${input.id}: ${input.description}`,
    initialState,
    propose,
    verify,
    review,
    memory: inMemoryReviewStore(priorFidelityEntries),
    maxShots,
    scenarioId: 'family-proposer',
    projectId: input.id,
  })

  const final = report.finalState
  if (!final.manifest) {
    console.error(
      `[propose-rlm] ${input.id}: all ${report.shots.length} shots produced no manifest`,
    )
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
  writeFileSync(
    join(proposal.proposalDir, 'manifest.json'),
    JSON.stringify(proposal.manifest, null, 2) + '\n',
  )
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
