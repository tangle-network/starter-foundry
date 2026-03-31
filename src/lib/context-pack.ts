import path from 'node:path'
import { generateBuildPlan } from './build-plan.js'
import { composeStarter } from './compose.js'
import { createTempDir, listFilesRecursive, readJson, removeDir, writeJson } from './fs.js'
import { resolveComponents } from './registry.js'
import type { ComposeSpec, ContextPack, ComposeReport } from '../types.js'

export interface ContextPackResult {
  outDir: string
  contextPath: string
  contextPack: ContextPack
}

export async function createContextPack({
  spec,
  outDir = null,
}: {
  spec: ComposeSpec
  outDir?: string | null
}): Promise<ContextPackResult> {
  const composedDir = outDir ?? (await createTempDir('starter-foundry-context'))
  const cleanup = !outDir
  const composeResult = await composeStarter({ spec, outDir: composedDir })

  try {
    const composeReport = await readJson<ComposeReport>(composeResult.composeReportPath)
    const files = await listFilesRecursive(composedDir)
    const components = await resolveComponents(spec)
    const buildPlan = generateBuildPlan(spec, components)

    const contextPack: ContextPack = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      projectName: spec.projectName,
      components: composeReport.components,
      variables: composeReport.variables,
      files,
      fileOwnership: composeReport.fileOwnership,
      commands: composeReport.contextHints.commands,
      entrypoints: composeReport.contextHints.entrypoints,
      preview: composeReport.contextHints.preview ?? null,
      extensionPoints: composeReport.contextHints.extensionPoints,
      validationChecks: composeReport.validationChecks,
      agentBrief: {
        summary: buildPlan.goal,
        firstMoves: buildPlan.firstMoves,
      },
      buildPlan,
      userPrompt: spec.userPrompt ?? null,
    }

    const contextPath = path.join(composedDir, '.starter-foundry', 'context-pack.json')
    await writeJson(contextPath, contextPack)

    return {
      outDir: composedDir,
      contextPath,
      contextPack,
    }
  } finally {
    if (cleanup) {
      await removeDir(composedDir)
    }
  }
}
