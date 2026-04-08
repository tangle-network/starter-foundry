import fs from 'node:fs/promises'
import path from 'node:path'
import { generateBuildPlan } from './build-plan.js'
import { ensureDir, sanitizePackageName, writeJson } from './fs.js'
import { buildVariables, resolveComponents, resolveTemplateObject } from './registry.js'
import { emit, traced } from './telemetry.js'
import type { FamilyManifest, LayerManifest, PartnerManifest, ComposeSpec, ComposeResult, ResolvedComponents, ValidationCheck, ContextHints, MediaManifest, MediaSlot } from '../types.js'

type AnyManifest = FamilyManifest | LayerManifest | PartnerManifest

async function renderFile(sourcePath: string, targetPath: string, variables: Record<string, unknown>): Promise<void> {
  const raw = await fs.readFile(sourcePath, 'utf8')
  const rendered = raw.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (key in variables) {
      return String(variables[key])
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
  emit('compose', {
    family: spec.family,
    layers,
    filesWritten: result.filesWritten,
    partner: spec.partner ?? null,
    industry,
    durationMs,
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

  // Generate AGENTS.md — per-project agent instructions
  const agentsMd = buildAgentsMd(spec, components, composeReport.contextHints, mediaSlots)
  await fs.writeFile(path.join(outDir, 'AGENTS.md'), `${agentsMd}\n`, 'utf8')

  // Generate llms.txt — machine-readable project description for AI agents
  const llmsTxt = buildLlmsTxt(spec, components, composeReport.contextHints)
  await fs.writeFile(path.join(outDir, 'llms.txt'), `${llmsTxt}\n`, 'utf8')

  return {
    outDir,
    filesWritten: [...new Set([...filesWritten, 'AGENTS.md', 'llms.txt'])].sort(),
    composeReportPath: path.join(outDir, '.starter-foundry', 'compose-report.json'),
    components: composeReport.components,
  }
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

  lines.push(
    '## What\'s here',
    '',
    `This project was scaffolded by starter-foundry. The user\'s prompt drove the choices below — read their prompt first, it takes priority over everything in this file.`,
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
