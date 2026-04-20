import path from 'node:path'
import { enhanceBuildPlanWithLLM, generateBuildPlan, mergeBriefIntoBuildPlan } from './build-plan.js'
import { composeStarter } from './compose.js'
import { createTempDir, listFilesRecursive, readJson, removeDir, writeJson } from './fs.js'
import { resolveComponents } from './registry.js'
import type { ProductBrief } from './product-brief.js'
import type { ComposeSpec, ContextPack, ComposeReport } from '../types.js'

export interface ContextPackResult {
  outDir: string
  contextPath: string
  contextPack: ContextPack
}

export async function createContextPack({
  spec,
  outDir = null,
  llmBuildPlan = false,
  brief = null,
}: {
  spec: ComposeSpec
  outDir?: string | null
  /** Back-compat flag: invoke the standalone LLM enhancer on the build plan. Prefer passing a pre-generated ProductBrief via `brief`. */
  llmBuildPlan?: boolean
  /** Pre-generated product brief (from planPrompt({ brief: true })). Merged into BuildPlan — no extra LLM call. */
  brief?: ProductBrief | null
}): Promise<ContextPackResult> {
  const composedDir = outDir ?? (await createTempDir('starter-foundry-context'))
  const cleanup = !outDir
  const composeResult = await composeStarter({ spec, outDir: composedDir })

  try {
    const composeReport = await readJson<ComposeReport>(composeResult.composeReportPath)
    const files = await listFilesRecursive(composedDir)
    const components = await resolveComponents(spec)
    let buildPlan = generateBuildPlan(spec, components)
    if (brief) {
      buildPlan = mergeBriefIntoBuildPlan(buildPlan, brief)
    } else if (llmBuildPlan) {
      buildPlan = await enhanceBuildPlanWithLLM({ spec, base: buildPlan, composedFiles: files })
    }

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
