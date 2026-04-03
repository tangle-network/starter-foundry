import fs from 'node:fs/promises'
import path from 'node:path'
import { generateBuildPlan } from './build-plan.js'
import { ensureDir, sanitizePackageName, writeJson } from './fs.js'
import { buildVariables, resolveComponents, resolveTemplateObject } from './registry.js'
import { emit, traced } from './telemetry.js'
import type { FamilyManifest, LayerManifest, PartnerManifest, ComposeSpec, ComposeResult, ResolvedComponents, ValidationCheck, ContextHints } from '../types.js'

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

function collectComponentFiles(component: AnyManifest): Array<{ source: string; target: string; owner: string }> {
  return (component.files ?? []).map((file) => ({
    ...file,
    source: path.join(component.baseDir, file.source),
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
  emit('compose', {
    family: spec.family,
    layers,
    filesWritten: result.filesWritten,
    partner: spec.partner ?? null,
    durationMs,
  })
  return result
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

  for (const component of componentOrder) {
    const files = collectComponentFiles(component)
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

  // Generate AGENTS.md — per-project agent instructions
  const agentsMd = buildAgentsMd(spec, components, composeReport.contextHints)
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
): string {
  const buildPlan = generateBuildPlan(spec, components)
  const lines: string[] = [
    '# AGENTS.md',
    '',
  ]

  if (buildPlan.goal) {
    lines.push(`## Goal`, '', buildPlan.goal, '')
  }

  lines.push(
    '## Stack',
    '',
    `- Family: \`${spec.family}\``,
    `- Layers: ${components.layers.map((l) => `\`${l.group}:${l.id}\``).join(', ')}`,
  )
  if (components.partner) {
    lines.push(`- Partner: \`${components.partner.id}\``)
  }
  lines.push('')

  if (buildPlan.architecture.length > 0) {
    lines.push('## Architecture', '')
    buildPlan.architecture.forEach((a) => lines.push(`- ${a}`))
    lines.push('')
  }

  if (contextHints.entrypoints.length > 0) {
    lines.push('## Entry Points', '')
    contextHints.entrypoints.forEach((e) => lines.push(`- \`${e}\``))
    lines.push('')
  }

  if (contextHints.commands.length > 0) {
    lines.push('## Commands', '')
    contextHints.commands.forEach((c) => lines.push(`- \`${c}\``))
    lines.push('')
  }

  if (buildPlan.pages.length > 0 || buildPlan.apiRoutes.length > 0 || buildPlan.components.length > 0) {
    lines.push('## Build Plan', '')
    if (buildPlan.pages.length > 0) lines.push(`Pages: ${buildPlan.pages.join(', ')}`)
    if (buildPlan.apiRoutes.length > 0) lines.push(`API routes: ${buildPlan.apiRoutes.join(', ')}`)
    if (buildPlan.components.length > 0) lines.push(`Components: ${buildPlan.components.join(', ')}`)
    if (buildPlan.dataModels.length > 0) lines.push(`Data models: ${buildPlan.dataModels.join(', ')}`)
    if (buildPlan.integrations.length > 0) lines.push(`Integrations: ${buildPlan.integrations.join(', ')}`)
    lines.push('')
  }

  if (buildPlan.designDirective) {
    lines.push('## Design', '', buildPlan.designDirective, '')
  }

  lines.push(
    '## Rules',
    '',
    '- Build on top of the prepared scaffold. Do not replace the architecture.',
    '- Use the entry points and validated commands before exploring broadly.',
    '- Extend owned files. Check file ownership in `.starter-foundry/compose-report.json`.',
    '- Run the dev server to verify changes hot-reload correctly.',
  )

  return lines.join('\n')
}
