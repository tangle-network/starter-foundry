import fs from 'node:fs/promises'
import path from 'node:path'
import { composeStarter } from './compose.js'
import { createTempDir, ensureDir, listFilesRecursive, readJson, removeDir, writeJson } from './fs.js'
import { validateStarter } from './validate.js'
import type {
  WorkspaceSpec,
  LaunchPlan,
  NormalizedProjectEntry,
  ComposeReport,
  ComposeComponents,
  PreviewHint,
} from '../types.js'

interface ProjectRecord {
  id: string
  path: string
  spec: WorkspaceSpec['projects'][number]['spec']
  components: ComposeComponents
  filesWritten: string[]
  composeReportPath: string
  commands: string[]
  entrypoints: string[]
  preview: PreviewHint | null
  extensionPoints: string[]
  primaryComposeMs?: number
}

export interface WorkspaceReport {
  schemaVersion: 1
  generatedAt: string
  workspaceName: string
  userPrompt: string | null
  launchPlan: LaunchPlan
  projects: Array<{
    id: string
    path: string
    projectName: string
    components: ComposeComponents
    filesWritten: string[]
    commands: string[]
    entrypoints: string[]
    preview: PreviewHint | null
    extensionPoints: string[]
    composeReportPath: string
  }>
}

function buildProjectMd(spec: WorkspaceSpec, workspaceReport: WorkspaceReport): string {
  const projectLines = workspaceReport.projects.map(
    (project) =>
      `- \`${project.path}\` -> \`${project.components.family}\` (${project.components.layers.join(', ') || 'no layers'})`,
  )

  return [
    `# ${spec.workspaceName}`,
    '',
    '## Mission',
    spec.userPrompt ?? 'Build on top of this prepared workspace.',
    '',
    '## Launch Plan',
    `- Primary project: \`${workspaceReport.launchPlan.primaryProjectId}\``,
    `- Primary artifact: \`${workspaceReport.launchPlan.primaryArtifact.kind}\` at \`${workspaceReport.launchPlan.primaryArtifact.path}\``,
    `- Target time to first artifact: ${workspaceReport.launchPlan.primaryArtifact.targetMs}ms`,
    '',
    '## Projects',
    ...projectLines,
    '',
    '## Agent Goal',
    workspaceReport.launchPlan.initialAgentMission,
    '',
    '## Notes',
    '- Extend the prepared base instead of rebuilding from zero.',
    '- Use the root launch plan and workspace context before exploring deeply.',
  ].join('\n')
}

function buildAgentsMd(workspaceReport: WorkspaceReport): string {
  const projectLines = workspaceReport.projects.flatMap((project) => [
    `## ${project.id}`,
    `- path: \`${project.path}\``,
    `- family: \`${project.components.family}\``,
    `- entrypoints: ${project.entrypoints.map((item) => `\`${item}\``).join(', ') || 'none'}`,
    `- validated commands: ${project.commands.map((item) => `\`${item}\``).join(', ') || 'none'}`,
  ])

  return [
    `# AGENTS.md`,
    '',
    'Read `PROJECT.md` first.',
    `Primary project is \`${workspaceReport.launchPlan.primaryProjectId}\`. Start there unless blocked.`,
    'Build on top of the prepared workspace. Do not replace architecture from zero without a concrete blocker.',
    'Prefer validated commands and known entrypoints before broad repo exploration.',
    '',
    ...projectLines,
  ].join('\n')
}

function buildLaunchPlan(spec: WorkspaceSpec, projects: ProjectRecord[]): LaunchPlan {
  const primaryProjectId = spec.launchPlan?.primaryProjectId ?? projects[0]?.id ?? 'web'
  const primaryProject = projects.find((project) => project.id === primaryProjectId) ?? projects[0]
  const preview = primaryProject?.preview ?? { path: '/', port: null }

  return {
    primaryProjectId,
    primaryArtifact: {
      kind: spec.launchPlan?.primaryArtifact?.kind ?? (preview ? 'preview' : 'workspace'),
      path: spec.launchPlan?.primaryArtifact?.path ?? preview?.path ?? '/',
      port: spec.launchPlan?.primaryArtifact?.port ?? (preview?.port as number | null) ?? null,
      targetMs: spec.launchPlan?.primaryArtifact?.targetMs ?? 3000,
    },
    initialAgentMission:
      spec.launchPlan?.initialAgentMission ??
      'Build the user\'s prompt on top of this prepared workspace base.',
  }
}

async function writeWorkspaceScaffolding(
  spec: WorkspaceSpec,
  outDir: string,
  workspaceReport: WorkspaceReport,
): Promise<void> {
  await fs.writeFile(path.join(outDir, 'PROJECT.md'), `${buildProjectMd(spec, workspaceReport)}\n`, 'utf8')
  await fs.writeFile(path.join(outDir, 'AGENTS.md'), `${buildAgentsMd(workspaceReport)}\n`, 'utf8')
  await writeJson(path.join(outDir, '.starter-foundry', 'launch-plan.json'), workspaceReport.launchPlan)
  await writeJson(path.join(outDir, '.starter-foundry', 'workspace-report.json'), workspaceReport)
}

function normalizeProject(project: WorkspaceSpec['projects'][number], index: number): NormalizedProjectEntry {
  if (!project.path || !project.spec) {
    throw new Error(`Workspace project ${index + 1} requires path and spec`)
  }

  return {
    id: project.id ?? project.path.replaceAll('/', '-'),
    path: project.path,
    spec: project.spec,
  }
}

async function buildWorkspaceReport(
  spec: WorkspaceSpec,
  outDir: string,
  projectRecords: ProjectRecord[],
): Promise<WorkspaceReport> {
  const launchPlan = buildLaunchPlan(spec, projectRecords)

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName: spec.workspaceName,
    userPrompt: spec.userPrompt ?? null,
    launchPlan,
    projects: projectRecords.map((project) => ({
      id: project.id,
      path: project.path,
      projectName: project.spec.projectName,
      components: project.components,
      filesWritten: project.filesWritten,
      commands: project.commands,
      entrypoints: project.entrypoints,
      preview: project.preview,
      extensionPoints: project.extensionPoints,
      composeReportPath: path.relative(outDir, project.composeReportPath),
    })),
  }
}

async function buildWorkspaceContextFromReport(
  spec: WorkspaceSpec,
  outDir: string,
  workspaceReport: WorkspaceReport,
): Promise<{ contextPack: unknown; contextPath: string }> {
  const projectContexts = await Promise.all(
    workspaceReport.projects.map(async (project) => {
      const projectDir = path.join(outDir, project.path)
      const composeReport = await readJson<ComposeReport>(
        path.join(projectDir, '.starter-foundry', 'compose-report.json'),
      )
      return {
        id: project.id,
        path: project.path,
        components: project.components,
        files: await listFilesRecursive(projectDir),
        fileOwnership: composeReport.fileOwnership,
        commands: project.commands,
        entrypoints: project.entrypoints,
        preview: project.preview,
        extensionPoints: project.extensionPoints,
        validationChecks: composeReport.validationChecks,
      }
    }),
  )

  const contextPack = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName: spec.workspaceName,
    userPrompt: spec.userPrompt ?? null,
    launchPlan: workspaceReport.launchPlan,
    projects: projectContexts,
    files: await listFilesRecursive(outDir),
    agentBrief: {
      summary: `Workspace ${spec.workspaceName} with ${workspaceReport.projects.length} prepared projects.`,
      firstMoves: [
        `Open ${workspaceReport.launchPlan.primaryProjectId} first.`,
        'Read PROJECT.md and the launch plan before broad edits.',
        'Extend the prepared workspace and keep runtime boundaries intact.',
      ],
    },
  }

  const contextPath = path.join(outDir, '.starter-foundry', 'workspace-context.json')
  await writeJson(contextPath, contextPack)

  return {
    contextPack,
    contextPath,
  }
}

export interface ComposeWorkspaceResult {
  outDir: string
  workspaceReportPath: string
  launchPlanPath: string
  projectCount: number
  projects: WorkspaceReport['projects']
  launchPlan: LaunchPlan
  primaryProjectComposeMs: number
}

export async function composeWorkspace({
  spec,
  outDir,
}: {
  spec: WorkspaceSpec
  outDir: string
}): Promise<ComposeWorkspaceResult> {
  await ensureDir(outDir)
  await ensureDir(path.join(outDir, '.starter-foundry'))

  const projects = spec.projects.map(normalizeProject)
  const primaryProjectId = spec.launchPlan?.primaryProjectId ?? projects[0]?.id

  const composed = await Promise.all(
    projects.map(async (project) => {
      const projectOutDir = path.join(outDir, project.path)
      const composeStart = performance.now()
      const composeResult = await composeStarter({ spec: project.spec, outDir: projectOutDir })
      const projectComposeMs = Math.round(performance.now() - composeStart)
      const composeReport = await readJson<ComposeReport>(composeResult.composeReportPath)
      return { project, composeResult, composeReport, projectComposeMs }
    }),
  )

  let primaryProjectComposeMs = 0
  const projectRecords: ProjectRecord[] = composed.map(({ project, composeResult, composeReport, projectComposeMs }) => {
    if (project.id === primaryProjectId) primaryProjectComposeMs = projectComposeMs
    return {
      id: project.id,
      path: project.path,
      spec: project.spec,
      components: composeResult.components,
      filesWritten: composeResult.filesWritten,
      composeReportPath: composeResult.composeReportPath,
      commands: composeReport.contextHints.commands,
      entrypoints: composeReport.contextHints.entrypoints,
      preview: composeReport.contextHints.preview ?? null,
      extensionPoints: composeReport.contextHints.extensionPoints,
    }
  })

  const workspaceReport = await buildWorkspaceReport(spec, outDir, projectRecords)
  await writeWorkspaceScaffolding(spec, outDir, workspaceReport)

  return {
    outDir,
    workspaceReportPath: path.join(outDir, '.starter-foundry', 'workspace-report.json'),
    launchPlanPath: path.join(outDir, '.starter-foundry', 'launch-plan.json'),
    projectCount: projectRecords.length,
    projects: workspaceReport.projects,
    launchPlan: workspaceReport.launchPlan,
    primaryProjectComposeMs,
  }
}

export async function createWorkspaceContextPack({
  spec,
  outDir = null,
  workspaceReport = null,
}: {
  spec: WorkspaceSpec
  outDir?: string | null
  workspaceReport?: WorkspaceReport | null
}): Promise<{ outDir: string; contextPath: string; contextPack: unknown }> {
  const workspaceDir = outDir ?? (await createTempDir('starter-foundry-workspace-context'))
  const cleanup = !outDir

  try {
    let currentReport = workspaceReport
    if (!currentReport) {
      await composeWorkspace({ spec, outDir: workspaceDir })
      currentReport = await readJson<WorkspaceReport>(
        path.join(workspaceDir, '.starter-foundry', 'workspace-report.json'),
      )
    }

    const result = await buildWorkspaceContextFromReport(spec, workspaceDir, currentReport)

    return {
      outDir: workspaceDir,
      contextPath: result.contextPath,
      contextPack: result.contextPack,
    }
  } finally {
    if (cleanup) {
      await removeDir(workspaceDir)
    }
  }
}

export interface WorkspaceBenchmarkReport {
  schemaVersion: 1
  generatedAt: string
  workspaceName: string
  runs: number
  results: Array<{
    runId: number
    outDir: string
    composeMs: number
    contextMs: number
    validateMs: number
    primaryArtifactMs: number
    primaryArtifactTargetMs: number
    meetsPrimaryArtifactTarget: boolean
    totalMs: number
    projectCount: number
    validations: Array<{ id: string; ok: boolean; checksPassed: number; checksTotal: number }>
    contextPath: string
  }>
  summary: {
    passRate: number
    primaryArtifactHitRate: number
    primaryArtifactTargetMs: number | null
    meanPrimaryArtifactMs: number
    meanTotalMs: number
  }
}

export async function benchmarkWorkspace({
  spec,
  runs = 1,
  outDir = null,
}: {
  spec: WorkspaceSpec
  runs?: number
  outDir?: string | null
}): Promise<WorkspaceBenchmarkReport> {
  const results: WorkspaceBenchmarkReport['results'] = []

  for (let index = 0; index < runs; index += 1) {
    const runOutDir = outDir
      ? path.join(outDir, `run-${String(index + 1).padStart(2, '0')}`)
      : await createTempDir('starter-foundry-workspace-bench')

    const composeStart = performance.now()
    const composeResult = await composeWorkspace({ spec, outDir: runOutDir })
    const composeMs = Math.round(performance.now() - composeStart)

    const workspaceReport = await readJson<WorkspaceReport>(composeResult.workspaceReportPath)

    const contextStart = performance.now()
    const context = await createWorkspaceContextPack({
      spec,
      outDir: runOutDir,
      workspaceReport,
    })
    const contextMs = Math.round(performance.now() - contextStart)

    const validationStart = performance.now()
    const validations = await Promise.all(
      spec.projects.map(normalizeProject).map(async (project) => {
        const validation = await validateStarter({
          spec: project.spec,
          outDir: path.join(runOutDir, project.path),
        })
        return {
          id: project.id,
          ok: validation.ok,
          checksPassed: validation.checks.filter((check) => check.ok).length,
          checksTotal: validation.checks.length,
        }
      }),
    )
    const validateMs = Math.round(performance.now() - validationStart)

    // Use per-primary-project compose time for primaryArtifactMs
    const primaryArtifactMs = composeResult.primaryProjectComposeMs || composeMs
    const targetMs = workspaceReport.launchPlan.primaryArtifact.targetMs
    results.push({
      runId: index + 1,
      outDir: runOutDir,
      composeMs,
      contextMs,
      validateMs,
      primaryArtifactMs,
      primaryArtifactTargetMs: targetMs,
      meetsPrimaryArtifactTarget: primaryArtifactMs <= targetMs,
      totalMs: composeMs + contextMs + validateMs,
      projectCount: workspaceReport.projects.length,
      validations,
      contextPath: context.contextPath as string,
    })

    if (!outDir) {
      await removeDir(runOutDir)
    }
  }

  const report: WorkspaceBenchmarkReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceName: spec.workspaceName,
    runs,
    results,
    summary: {
      passRate: results.filter((result) => result.validations.every((item) => item.ok)).length / results.length,
      primaryArtifactHitRate:
        results.filter((result) => result.meetsPrimaryArtifactTarget).length / results.length,
      primaryArtifactTargetMs: results[0]?.primaryArtifactTargetMs ?? null,
      meanPrimaryArtifactMs: Math.round(
        results.reduce((total, result) => total + result.primaryArtifactMs, 0) / results.length,
      ),
      meanTotalMs: Math.round(results.reduce((total, result) => total + result.totalMs, 0) / results.length),
    },
  }

  if (outDir) {
    await writeJson(path.join(outDir, 'workspace-benchmark.json'), report)
  }

  return report
}
