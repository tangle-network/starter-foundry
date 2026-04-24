import fs from 'node:fs/promises'
import path from 'node:path'
import { generateBuildPlan } from './build-plan.js'
import { ensureDir, sanitizePackageName, writeJson } from './fs.js'
import { renderIndustryFirstTurn } from './industry-flows.js'
import { buildVariables, resolveComponents, resolveTemplateObject } from './registry.js'
import { selectTemplateVersion } from './selection.js'
import { emit, traced } from './telemetry.js'
import type { FamilyManifest, LayerManifest, PartnerManifest, ComposeSpec, ComposeResult, ResolvedComponents, ValidationCheck, ContextHints, MediaManifest, MediaSlot } from '../types.js'

type AnyManifest = FamilyManifest | LayerManifest | PartnerManifest

const HTML_LIKE_EXTS = new Set(['.tsx', '.jsx', '.html'])

function escapeHtmlChars(value: string): string {
  return value.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function renderFile(sourcePath: string, targetPath: string, variables: Record<string, unknown>): Promise<void> {
  const raw = await fs.readFile(sourcePath, 'utf8')
  const ext = path.extname(targetPath).toLowerCase()
  const needsEscape = HTML_LIKE_EXTS.has(ext)
  const rendered = raw.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (key in variables) {
      const val = String(variables[key])
      return needsEscape ? escapeHtmlChars(val) : val
    }
    return ''
  })
  await ensureDir(path.dirname(targetPath))
  await fs.writeFile(targetPath, rendered, 'utf8')
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function resolveVariantSource(component: AnyManifest, filePath: string, variantSeed: string): string {
  const layer = component as LayerManifest
  const variants = layer.variants as string[] | undefined
  if (!variants?.length || !filePath.startsWith('files/')) return path.join(component.baseDir, filePath)
  const idx = simpleHash(variantSeed + layer.id) % variants.length
  const variantDir = `variants/${variants[idx]}`
  return path.join(component.baseDir, filePath.replace(/^files\//, `${variantDir}/`))
}

function collectComponentFiles(component: AnyManifest, variantSeed: string): Array<{ source: string; target: string; owner: string }> {
  return (component.files ?? []).map((file) => ({
    ...file,
    source: resolveVariantSource(component, file.source, variantSeed),
    owner:
      component.kind === 'layer'
        ? `${(component as LayerManifest).group}:${component.id}`
        : component.id,
  }))
}

function buildComponentOrder(components: { family: FamilyManifest; layers: LayerManifest[]; partner: PartnerManifest | null }): AnyManifest[] {
  const order: AnyManifest[] = [components.family, ...components.layers]
  if (components.partner) {
    order.push(components.partner)
  }
  return order
}

function collectValidationChecks(
  components: { family: FamilyManifest; layers: LayerManifest[]; partner: PartnerManifest | null },
  variables: Record<string, unknown>,
): ValidationCheck[] {
  return buildComponentOrder(components).flatMap(
    (component) => resolveTemplateObject(component.validationChecks ?? [], variables) as ValidationCheck[],
  )
}

function collectContextHints(
  components: { family: FamilyManifest; layers: LayerManifest[]; partner: PartnerManifest | null },
  variables: Record<string, unknown>,
): Required<ContextHints> {
  const merged: Required<ContextHints> = {
    commands: [],
    entrypoints: [],
    preview: null as never,
    extensionPoints: [],
  }

  for (const component of buildComponentOrder(components)) {
    const hints = resolveTemplateObject(component.contextHints ?? {}, variables) as ContextHints
    merged.commands.push(...(hints.commands ?? []))
    merged.entrypoints.push(...(hints.entrypoints ?? []))
    merged.extensionPoints.push(...(hints.extensionPoints ?? []))
    if (hints.preview) {
      merged.preview = hints.preview as never
    }
  }

  merged.commands = [...new Set(merged.commands)]
  merged.entrypoints = [...new Set(merged.entrypoints)]
  merged.extensionPoints = [...new Set(merged.extensionPoints)]

  return merged
}

export async function composeStarter({ spec, outDir }: { spec: ComposeSpec; outDir: string }): Promise<ComposeResult> {
  const { result, durationMs } = await traced('composeStarter', async () => {
    return composeStarterInner(spec, outDir)
  })
  const layers = result.components.layers
  const industry = layers.find((l) => l.startsWith('industry:')) ?? null
  // Observe what diverse-serve would pick from the template-library for
  // this compose. Doesn't change file resolution (registry/ is still the
  // canonical serve path); purely a telemetry signal so we can see the
  // env flag wiring in production traces before we flip default behavior.
  const diverseVersion = selectTemplateVersion(spec.family, spec.projectName)
  emit('compose', {
    family: spec.family,
    layers,
    filesWritten: result.filesWritten,
    partner: spec.partner ?? null,
    industry,
    durationMs,
    templateVersion: diverseVersion,
    diverseServe: process.env['STARTER_FOUNDRY_DIVERSE_SERVE'] === '1' || process.env['STARTER_FOUNDRY_DIVERSE_SERVE'] === 'true',
  })
  return result
}

async function mergeMediaManifests(outDir: string): Promise<MediaSlot[]> {
  const manifestPath = path.join(outDir, 'media-manifest.json')
  let existing: MediaManifest | null = null
  try {
    const raw = await fs.readFile(manifestPath, 'utf8')
    existing = JSON.parse(raw) as MediaManifest
  } catch {
    // no existing manifest
  }

  if (!existing || !existing.slots?.length) return []

  // Deduplicate by slot id, last write wins
  const seen = new Map<string, MediaSlot>()
  for (const slot of existing.slots) {
    seen.set(slot.id, slot)
  }
  const merged: MediaManifest = { slots: [...seen.values()] }
  await fs.writeFile(manifestPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  return merged.slots
}

/**
 * Read the composed project's package.json (after mergeLayerPackageDeps)
 * and return the sorted union of dependencies + devDependencies keys.
 * Used by AGENTS.md/CLAUDE.md to tell the agent WHAT IS ALREADY INSTALLED
 * so it doesn't waste turns running `pnpm add lucide-react` on a scaffold
 * that already ships lucide-react. Returns [] for non-JS scaffolds.
 */
async function readPreinstalledPackages(outDir: string): Promise<string[]> {
  const pkgPath = path.join(outDir, 'package.json')
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const deps = new Set<string>([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ])
    return [...deps].sort()
  } catch {
    return []
  }
}

// Merge each applied layer's declared packageDeps into the composed
// package.json. Runs after every file is written so the family's package.json
// is on disk; we read it, merge, write back. No-op if the family has no
// package.json (Rust/Go/Python scaffolds).
async function mergeLayerPackageDeps(outDir: string, layers: LayerManifest[]): Promise<void> {
  const pkgPath = path.join(outDir, 'package.json')
  let pkg: Record<string, unknown>
  try {
    pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'))
  } catch {
    return
  }

  let touched = false
  for (const layer of layers) {
    const deps = layer.packageDeps
    if (!deps) continue
    if (deps.dependencies) {
      const existing = (pkg.dependencies ?? {}) as Record<string, string>
      pkg.dependencies = { ...existing, ...deps.dependencies }
      touched = true
    }
    if (deps.devDependencies) {
      const existing = (pkg.devDependencies ?? {}) as Record<string, string>
      pkg.devDependencies = { ...existing, ...deps.devDependencies }
      touched = true
    }
  }

  if (!touched) return
  await fs.writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
}

async function composeStarterInner(spec: ComposeSpec, outDir: string): Promise<ComposeResult> {
  const components = await resolveComponents(spec)
  const variables = buildVariables(
    {
      ...spec,
      packageName: spec.packageName ?? sanitizePackageName(spec.projectName),
    },
    components,
  )
  const componentOrder = buildComponentOrder(components)
  const fileOwnership: Record<string, string> = {}
  const filesWritten: string[] = []
  const resolvedOutDir = path.resolve(outDir)

  await ensureDir(outDir)

  const variantSeed = spec.projectName
  for (const component of componentOrder) {
    const files = collectComponentFiles(component, variantSeed)
    for (const file of files) {
      const resolvedTarget = resolveTemplateObject(file.target, variables) as string
      const targetPath = path.join(outDir, resolvedTarget)

      // Guard against directory traversal
      if (!path.resolve(targetPath).startsWith(resolvedOutDir + path.sep) && path.resolve(targetPath) !== resolvedOutDir) {
        throw new Error(`File target ${resolvedTarget} would escape output directory`)
      }

      await renderFile(file.source, targetPath, variables)
      fileOwnership[resolvedTarget] = file.owner
      filesWritten.push(resolvedTarget)
    }
  }

  await mergeLayerPackageDeps(outDir, components.layers)

  // Read the final package.json (after merge) so AGENTS.md can list the
  // pre-installed deps for the agent. This closes the efficiency gap
  // where agents re-install already-present packages (lucide-react,
  // tailwindcss, clsx, etc.) because nothing in the scaffold docs told
  // them those were already there. Evolve R3 (post-Gen-9) diagnosis:
  // 54+ redundant installs in the 30-day window concentrate on 4
  // packages that every react-vite-ts scaffold ships.
  const preinstalledPackages = await readPreinstalledPackages(outDir)

  const composeReport = {
    spec,
    components: {
      family: components.family.id,
      layers: components.layers.map((layer) => `${layer.group}:${layer.id}`),
      partner: components.partner?.id ?? null,
      slots: components.slotSelections,
    },
    variables,
    fileOwnership,
    validationChecks: collectValidationChecks(components, variables),
    contextHints: collectContextHints(components, variables),
  }

  await ensureDir(path.join(outDir, '.starter-foundry'))
  await writeJson(path.join(outDir, '.starter-foundry', 'compose-report.json'), composeReport)

  // Merge media manifests from all layers into a single root manifest
  const mediaSlots = await mergeMediaManifests(outDir)

  // Generate AGENTS.md — per-project agent instructions (OpenCode, Codex, etc.)
  const agentsMd = buildAgentsMd(spec, components, composeReport.contextHints, mediaSlots, preinstalledPackages)
  await fs.writeFile(path.join(outDir, 'AGENTS.md'), `${agentsMd}\n`, 'utf8')

  // Generate CLAUDE.md — Claude Code specific instructions (same content, different filename)
  await fs.writeFile(path.join(outDir, 'CLAUDE.md'), `${agentsMd}\n`, 'utf8')

  // Generate llms.txt — machine-readable project description for AI agents
  const llmsTxt = buildLlmsTxt(spec, components, composeReport.contextHints)
  await fs.writeFile(path.join(outDir, 'llms.txt'), `${llmsTxt}\n`, 'utf8')

  // Generate SBOM (CycloneDX) from the composed scaffold's dep manifest.
  const { writeSbom } = await import('./sbom.js')
  const sbomPath = await writeSbom(outDir, spec.projectName)

  // Collect optional prompt-fragment.md files from family + partner.
  const promptFragment = await collectPromptFragment(components)

  return {
    outDir,
    filesWritten: [...new Set([...filesWritten, 'AGENTS.md', 'CLAUDE.md', 'llms.txt'])].sort(),
    composeReportPath: path.join(outDir, '.starter-foundry', 'compose-report.json'),
    components: composeReport.components,
    promptFragment,
    sbomPath,
  }
}

async function collectPromptFragment(components: ResolvedComponents): Promise<string> {
  const fragments: string[] = []
  const familyFrag = path.join(components.family.baseDir, 'prompt-fragment.md')
  try {
    fragments.push(await fs.readFile(familyFrag, 'utf8'))
  } catch {
    // Optional file — absence is fine.
  }
  if (components.partner) {
    const partnerFrag = path.join(components.partner.baseDir, 'prompt-fragment.md')
    try {
      fragments.push(await fs.readFile(partnerFrag, 'utf8'))
    } catch {
      // Optional.
    }
  }
  return fragments.join('\n\n---\n\n').trim()
}

function buildLlmsTxt(
  spec: ComposeSpec,
  components: ResolvedComponents,
  contextHints: ReturnType<typeof collectContextHints>,
): string {
  const lines = [
    `# ${spec.projectName}`,
    '',
    `> ${components.family.description}`,
    '',
    `## Stack`,
    `- Family: ${spec.family}`,
    `- Layers: ${components.layers.map(l => `${l.group}:${l.id}`).join(', ')}`,
    components.partner ? `- Partner: ${components.partner.id}` : null,
    '',
    `## Entry Points`,
    ...contextHints.entrypoints.map(e => `- ${e}`),
    '',
    `## Commands`,
    ...contextHints.commands.map(c => `- ${c}`),
    '',
    `## Extension Points`,
    ...contextHints.extensionPoints.map(e => `- ${e}`),
  ].filter(line => line !== null)
  return lines.join('\n')
}

function buildAgentsMd(
  spec: ComposeSpec,
  components: ResolvedComponents,
  contextHints: ReturnType<typeof collectContextHints>,
  mediaSlots: MediaSlot[] = [],
  preinstalledPackages: string[] = [],
): string {
  const buildPlan = generateBuildPlan(spec, components)
  const lines: string[] = [
    '# AGENTS.md',
    '',
  ]

  if (buildPlan.goal) {
    lines.push(buildPlan.goal, '')
  }

  // STEP 0 — Start the dev server. This MUST be the first H2 in AGENTS.md
  // because agents that pattern-match on "find the run command" stop reading
  // after the first thing that looks like one. The runtime exposes a single
  // canonical idempotent route for this; do not let the agent improvise with
  // bare `pnpm install`/`pnpm dev` calls (they race the agent's edits, have
  // no error taxonomy, and aren't tracked by the runtime).
  lines.push(
    '## Step 0 — Start the dev server (do this FIRST)',
    '',
    'Before reading anything else in this file, run this command in `bash` to start the dev server. The user is waiting for a preview. This is idempotent — safe to call multiple times (returns the same pid). It auto-installs dependencies on first call, so you do NOT need to run `pnpm install` separately. Subsequent edits hot-reload via HMR; do NOT call this again to restart unless the response says you should.',
    '',
    '```bash',
    'curl -fsS -X POST "http://localhost:${SIDECAR_PORT:-9000}/process/ensure-dev-server" -H "Content-Type: application/json" -H "Authorization: Bearer ${SIDECAR_AUTH_TOKEN}" -d \'{}\'',
    '```',
    '',
    'The `SIDECAR_PORT` and `SIDECAR_AUTH_TOKEN` env vars are pre-set in your bash environment — you do NOT need to look them up.',
    '',
    'CRITICAL: Do NOT run `pnpm install`, `pnpm dev`, `npm install`, `npm run dev`, `next dev`, `vite`, `cargo run`, or any other dev/install command via `bash` directly. The command above handles all of that AND tracks the dev process for the runtime so the user\'s preview pane wires up automatically. Running them directly bypasses the runtime tracking and the user will not see a preview.',
    '',
    'The response is JSON: `{ "success": true, "data": { "pid": ..., "family": "node-pnpm", "command": "...", "startedNow": true|false, "installRan": true|false } }`. On error: `{ "success": false, "error": { "code": "...", "message": "..." } }` with codes `WORKSPACE_NOT_FOUND | NO_RUNNABLE_PROJECT | INSTALL_FAILED | DEV_COMMAND_NOT_FOUND | DEV_PROCESS_EXITED | PORT_BIND_FAILED`. React to each: `INSTALL_FAILED` → read the `log` field, fix `package.json`, call again; `DEV_COMMAND_NOT_FOUND` → add a `dev` script to `package.json`, call again; `DEV_PROCESS_EXITED` → read `log`, fix the bug in `src/`, call again.',
    '',
  )

  // User's prompt — echo it near the top so the agent sees its brief
  // before the scaffold's default behavior.
  if (spec.userPrompt) {
    lines.push(
      '## User\'s brief (takes priority over everything else in this file)',
      '',
      `> ${spec.userPrompt.replace(/\n/g, '\n> ')}`,
      '',
    )
  }

  lines.push(
    '## What\'s here',
    '',
    `This project was scaffolded by starter-foundry. The choices below were made deterministically from the user's brief.`,
    '',
    `- **Family:** \`${spec.family}\``,
    `- **Layers:** ${components.layers.map((l) => `\`${l.group}:${l.id}\``).join(', ')}`,
  )
  if (components.partner) {
    lines.push(`- **Partner:** \`${components.partner.id}\``)
  }
  lines.push('')

  if (buildPlan.architecture.length > 0) {
    lines.push('### Architecture notes')
    buildPlan.architecture.forEach((a) => lines.push(`- ${a}`))
    lines.push('')
  }

  // Key files only — no install/dev commands here, those are handled by
  // Step 0 above. Listing them in a "Getting started" block was creating
  // a competing recipe the agent followed instead of the runtime route.
  if (contextHints.entrypoints.length > 0) {
    lines.push(
      '## Key files',
      '',
      contextHints.entrypoints.map((e) => `- \`${e}\``).join('\n'),
      '',
    )
  }

  // Pre-installed packages — closes the efficiency gap where agents run
  // `pnpm add lucide-react` on scaffolds that already ship lucide-react.
  // Evolve R3 diagnosis: the top 4 redundant installs (lucide-react,
  // tailwindcss, @tailwindcss/vite, clsx) each ship in react-vite-ts's
  // package.json, yet appear 9-17× in .evolve/buildout-analysis.json's
  // topAddedPackages — agents installed them anyway because nothing told
  // them the scaffold already had them.
  if (preinstalledPackages.length > 0) {
    lines.push(
      '## Pre-installed packages — do NOT re-install',
      '',
      'These are already in `package.json` (the sidecar\'s ensure-dev-server auto-installed them on first call). If you need any of these, **import them** — do not run `pnpm add`, `pnpm install <name>`, `npm install <name>`, or equivalent. Re-installing a present package burns turns and tokens for zero gain.',
      '',
      preinstalledPackages.map((p) => `- \`${p}\``).join('\n'),
      '',
      'If you need a package that is NOT on this list, THEN you may add it — but check this list first.',
      '',
    )
  }

  if (buildPlan.pages.length > 0 || buildPlan.apiRoutes.length > 0 || buildPlan.components.length > 0) {
    lines.push(
      '## Suggested build plan',
      '',
      'These are starting points — adapt them to the user\'s actual needs.',
      '',
    )
    if (buildPlan.pages.length > 0) lines.push(`- **Pages:** ${buildPlan.pages.join(', ')}`)
    if (buildPlan.apiRoutes.length > 0) lines.push(`- **API routes:** ${buildPlan.apiRoutes.join(', ')}`)
    if (buildPlan.components.length > 0) lines.push(`- **Components:** ${buildPlan.components.join(', ')}`)
    if (buildPlan.dataModels.length > 0) lines.push(`- **Data models:** ${buildPlan.dataModels.join(', ')}`)
    if (buildPlan.integrations.length > 0) lines.push(`- **Integrations:** ${buildPlan.integrations.join(', ')}`)
    lines.push('')
  }

  if (buildPlan.placeholders.length > 0) {
    lines.push(
      '## Placeholders — MUST replace',
      '',
      'These files ship DEFAULT content so the preview renders before your first edit. You MUST replace them with product-specific behavior for the user\'s brief. Rewriting `personalize.json` updates brand strings only — it does NOT replace the content in these files. Treat this list as required-to-rewrite.',
      '',
    )
    for (const { source, path, description } of buildPlan.placeholders) {
      lines.push(`- \`${path}\` — ${description} _(${source})_`)
    }
    lines.push('')
  }

  // Industry first-turn flow — steers the agent toward the right first
  // feature for the product archetype. Empty string when no industry:*
  // layer is attached or the industry isn't in the known map.
  const industryBlock = renderIndustryFirstTurn(components.layers.map((l) => `${l.group}:${l.id}`))
  if (industryBlock) {
    lines.push(industryBlock)
  }

  if (buildPlan.domainFirstSteps.length > 0) {
    lines.push(
      '## Domain first moves',
      '',
      'Runtime-specific actions declared by the selected family + layers + partner. Do these before generic setup — they prevent the most common class of first-turn mistakes for this stack.',
      '',
    )
    for (const { source, step } of buildPlan.domainFirstSteps) {
      lines.push(`- **[${source}]** ${step}`)
    }
    lines.push('')
  }

  if (buildPlan.domainGotchas.length > 0) {
    lines.push(
      '## Gotchas',
      '',
      'Traps specific to this stack — read before you hit them.',
      '',
    )
    for (const { source, note } of buildPlan.domainGotchas) {
      lines.push(`- **[${source}]** ${note}`)
    }
    lines.push('')
  }

  if (buildPlan.designDirective) {
    lines.push('## Design', '', buildPlan.designDirective, '')
  }

  if (mediaSlots.length > 0) {
    lines.push(
      '## Media',
      '',
      'Image slots are declared in `media-manifest.json` with generation prompts.',
      'Adapt the prompts to match the user\'s product before generating.',
      '',
      '| Slot | Size | Path | Purpose |',
      '|------|------|------|---------|',
    )
    for (const slot of mediaSlots) {
      lines.push(`| ${slot.id} | ${slot.width}\u00d7${slot.height} | \`${slot.path}\` | ${slot.purpose} |`)
    }
    lines.push(
      '',
      'Skip any slots that don\'t apply. Add new ones if the product needs them.',
      '',
    )
  }

  // Progressive disclosure — turn-order sections agents pattern-match on.
  lines.push(
    '## Turn 1 (do these before writing features)',
    '',
    '1. Call the dev-server route from Step 0 (above). Wait for success.',
    '2. Read the user\'s brief (above) and the Placeholders section.',
    '3. Rewrite `personalize.json` + `personalize.css` (brand strings + palette). These are render-time — preview updates on next refresh, no rebuild.',
    '4. Delete or rewrite EVERY file in the Placeholders list. Not optional.',
    '5. Only after (3) + (4) do you start feature work.',
    '',
    '## Before first preview screenshot',
    '',
    '- Confirm the landing surface renders the user\'s product (no default KPI cards from a dashboard template).',
    '- Brand strings in `personalize.json` are product-specific, not the scaffold default.',
    '- Any placeholder file in the list above has been replaced or deleted.',
    '',
    '## Before shipping',
    '',
    '- Run the family\'s validate script (see Key files above).',
    '- Re-check Gotchas (above) against what you built — those traps bite most at ship time.',
    '- If you added deps, they\'re in `package.json`; if you added routes/pages, they\'re reachable.',
    '',
  )

  lines.push(
    '## How to use this scaffold',
    '',
    'This is a starting point, not a contract. You own every file.',
    '',
    '- **Customize freely.** Replace components, change the layout, swap the color scheme — whatever fits the user\'s product.',
    '- **The scaffold saves you setup time** — Tailwind, shadcn/ui, path aliases, and framework config are ready. Don\'t redo them.',
    '- **Check `.starter-foundry/compose-report.json`** if you want to see which layer wrote which file.',
    '- **Update this file** as the project evolves. Delete sections that no longer apply.',
  )

  return lines.join('\n')
}
