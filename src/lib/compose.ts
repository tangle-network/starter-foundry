import fs from 'node:fs/promises'
import path from 'node:path'
import { ensureDir, sanitizePackageName, writeJson } from './fs.js'
import { buildVariables, resolveComponents, resolveTemplateObject } from './registry.js'
import type { FamilyManifest, LayerManifest, PartnerManifest, ComposeSpec, ComposeResult, ValidationCheck, ContextHints } from '../types.js'

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

  return {
    outDir,
    filesWritten: [...new Set(filesWritten)].sort(),
    composeReportPath: path.join(outDir, '.starter-foundry', 'compose-report.json'),
    components: composeReport.components,
  }
}
