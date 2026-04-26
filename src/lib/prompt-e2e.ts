import path from 'node:path'

import type { CorpusScenario, CorpusExpected, BenchmarkReport, ValidationCheck } from '../types.js'

import { benchmarkStarter } from './eval/benchmark.js'
import { createTempDir, readJson, removeDir, writeJson } from './fs.js'
import { planPrompt } from './prompt-planner.js'
import { benchmarkWorkspace } from './workspace.js'

interface Corpus {
  name: string
  scenarios: CorpusScenario[]
}

interface ValidationEvidence {
  mode: 'live-runtime' | 'toolchain' | 'structural' | 'mixed'
  tools: string[]
  projects: {
    id: string
    family: string
    mode: 'live-runtime' | 'toolchain' | 'structural'
    tools: string[]
    checks: number
  }[]
}

interface StarterRoute {
  family: string
  slots: Record<string, string>
}

interface WorkspaceRoute {
  primaryProjectId: string
  projectIds: string[]
  projectFamilies: Record<string, string>
}

type Route = StarterRoute | WorkspaceRoute

interface CorpusResult {
  id: string
  complexity: string
  partner: string | null
  prompt: string
  kind: 'starter' | 'workspace'
  confidence: string
  route: Route
  routeOk: boolean
  // Gen 9: explicit flag so routeAccuracy excludes no-expectation
  // scenarios (e.g. vibecoder) rather than counting them as auto-pass.
  hasExpectation: boolean
  validationOk: boolean
  primaryArtifactHit: boolean
  validationEvidence: ValidationEvidence
  benchmark: BenchmarkReport | ReturnType<typeof benchmarkWorkspace> extends Promise<infer T>
    ? T
    : never
  ok: boolean
}

interface ComposeReportForE2E {
  components: { family: string }
  validationChecks: ValidationCheck[]
}

function classifyProjectValidation(validationChecks: ValidationCheck[]): {
  mode: 'live-runtime' | 'toolchain' | 'structural'
  tools: string[]
  checks: number
} {
  let hasLiveRuntime = false
  let hasToolchain = false
  const tools = new Set<string>()

  for (const check of validationChecks) {
    if (check.type === 'http-start') {
      hasLiveRuntime = true
      const bin = check.command?.[0]
      if (bin) tools.add(bin)
      continue
    }

    if (check.type === 'python-compile') {
      hasToolchain = true
      tools.add('python3')
      continue
    }

    if (check.type !== 'command-success') continue

    const [bin = 'unknown', ...args] = check.command ?? []
    const commandText = [bin, ...args].join(' ')
    if (bin === 'node' && commandText.includes('validate-')) continue

    if (
      ['cargo', 'forge', 'go', 'python3', 'solana', 'anchor', 'aptos', 'sui', 'wrangler'].includes(
        bin,
      )
    ) {
      hasToolchain = true
      tools.add(bin)
      continue
    }

    hasLiveRuntime = true
    tools.add(bin)
  }

  return {
    mode: hasLiveRuntime ? 'live-runtime' : hasToolchain ? 'toolchain' : 'structural',
    tools: [...tools].sort(),
    checks: validationChecks.length,
  }
}

async function loadStarterValidationEvidence(runDir: string): Promise<ValidationEvidence> {
  const composeReport = await readJson<ComposeReportForE2E>(
    path.join(runDir, '.starter-foundry', 'compose-report.json'),
  )
  const project = classifyProjectValidation(composeReport.validationChecks)
  return {
    mode: project.mode,
    tools: project.tools,
    projects: [
      {
        id: 'root',
        family: composeReport.components.family,
        ...project,
      },
    ],
  }
}

async function loadWorkspaceValidationEvidence(
  runDir: string,
  plan: { spec: { projects: { path: string; id?: string }[] } },
): Promise<ValidationEvidence> {
  const projects = []

  for (const project of plan.spec.projects) {
    const composeReport = await readJson<ComposeReportForE2E>(
      path.join(runDir, project.path, '.starter-foundry', 'compose-report.json'),
    )
    projects.push({
      id: project.id ?? project.path,
      family: composeReport.components.family,
      ...classifyProjectValidation(composeReport.validationChecks),
    })
  }

  const modes = new Set(projects.map((project) => project.mode))
  return {
    mode: modes.size === 1 ? (projects[0]?.mode ?? 'structural') : 'mixed',
    tools: [...new Set(projects.flatMap((project) => project.tools))].sort(),
    projects,
  }
}

function matchesExpectation(
  result: { kind: 'starter' | 'workspace'; route: Route },
  expected?: CorpusExpected,
): { matched: boolean; hasExpectation: boolean } {
  // Previously `if (!expected) return true` silently inflated routeAccuracy
  // for corpora without expectations (vibecoder). The three-valued shape
  // forces the summary layer to exclude no-expectation scenarios from the
  // accuracy denominator rather than treating them as auto-pass.
  if (!expected) return { matched: true, hasExpectation: false }

  if (expected.kind !== result.kind) return { matched: false, hasExpectation: true }

  if (expected.kind === 'starter') {
    const route = result.route as StarterRoute
    const sameFamily = expected.family === route.family
    const sameSlots = Object.entries(expected.slots ?? {}).every(
      ([slotName, layerId]) => route.slots[slotName] === layerId,
    )
    return { matched: sameFamily && sameSlots, hasExpectation: true }
  }

  const route = result.route as WorkspaceRoute
  const samePrimary = expected.primaryProjectId === route.primaryProjectId
  const sameProjects = (expected.projectIds ?? []).every((projectId) =>
    route.projectIds.includes(projectId),
  )
  const sameFamilies = Object.entries(expected.projectFamilies ?? {}).every(
    ([projectId, family]) => route.projectFamilies[projectId] === family,
  )
  return { matched: samePrimary && sameProjects && sameFamilies, hasExpectation: true }
}

export async function runPromptCorpus({
  corpusPath,
  outDir = null,
}: {
  corpusPath: string
  outDir?: string | null
}): Promise<{
  outDir: string
  reportPath: string
  report: {
    schemaVersion: 1
    generatedAt: string
    corpus: string
    scenarioCount: number
    results: CorpusResult[]
    summary: {
      passRate: number
      routeAccuracy: number
      validationPassRate: number
      primaryArtifactHitRate: number
    }
  }
}> {
  const corpus = await readJson<Corpus>(path.resolve(corpusPath))
  const baseDir = outDir ?? (await createTempDir('starter-foundry-prompt-e2e'))

  // Run scenarios with bounded concurrency to avoid port conflicts from simultaneous
  // http-start validation checks. Default limit of 4 is safe for most family port ranges.
  const CONCURRENCY = 4
  const results: CorpusResult[] = new Array(corpus.scenarios.length)
  const queue = corpus.scenarios.map((scenario, index) => ({ scenario, index }))

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift()
      if (!item) break
      const { scenario, index } = item

      const runDir = path.join(baseDir, scenario.id)
      const plan = await planPrompt({
        prompt: scenario.prompt,
        partner: scenario.partner ?? null,
      })

      let benchmark: BenchmarkReport | Awaited<ReturnType<typeof benchmarkWorkspace>>
      let route: Route

      if (plan.kind === 'starter') {
        benchmark = await benchmarkStarter({ spec: plan.spec, runs: 1, outDir: runDir })
        route = { family: plan.spec.family, slots: plan.spec.slots ?? {} }
      } else {
        benchmark = await benchmarkWorkspace({ spec: plan.spec, runs: 1, outDir: runDir })
        route = {
          primaryProjectId: plan.spec.launchPlan?.primaryProjectId ?? '',
          projectIds: plan.spec.projects.map((project) => project.id ?? ''),
          projectFamilies: Object.fromEntries(
            plan.spec.projects.map((project) => [project.id ?? '', project.spec.family]),
          ),
        }
      }

      const benchmarkRunDir = benchmark.results[0].outDir
      const validationEvidence =
        plan.kind === 'starter'
          ? await loadStarterValidationEvidence(benchmarkRunDir)
          : await loadWorkspaceValidationEvidence(benchmarkRunDir, plan)

      const match = matchesExpectation({ kind: plan.kind, route }, scenario.expected)
      const routeOk = match.matched
      const validationOk = benchmark.summary.passRate === 1
      const primaryArtifactHit = benchmark.summary.primaryArtifactHitRate === 1

      results[index] = {
        id: scenario.id,
        complexity: scenario.complexity,
        partner: scenario.partner ?? null,
        prompt: scenario.prompt,
        kind: plan.kind,
        confidence: plan.confidence,
        route,
        routeOk,
        hasExpectation: match.hasExpectation,
        validationOk,
        primaryArtifactHit,
        validationEvidence,
        benchmark: benchmark as never,
        ok: routeOk && validationOk && primaryArtifactHit,
      }
    }
  }

  try {
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, corpus.scenarios.length) }, worker),
    )

    const report = {
      schemaVersion: 1 as const,
      generatedAt: new Date().toISOString(),
      corpus: corpus.name,
      scenarioCount: results.length,
      results,
      summary: {
        passRate: results.filter((result) => result.ok).length / results.length,
        // routeAccuracy denominator excludes no-expectation scenarios —
        // previously silent-passed via `if (!expected) return true` in the
        // matcher (Gen 9 muffled-gate audit).
        routeAccuracy: (() => {
          const checkable = results.filter((r) => r.hasExpectation)
          if (checkable.length === 0) return 1
          return checkable.filter((r) => r.routeOk).length / checkable.length
        })(),
        validationPassRate: results.filter((result) => result.validationOk).length / results.length,
        primaryArtifactHitRate:
          results.filter((result) => result.primaryArtifactHit).length / results.length,
      },
    }

    await writeJson(path.join(baseDir, 'prompt-e2e-report.json'), report)

    return {
      outDir: baseDir,
      reportPath: path.join(baseDir, 'prompt-e2e-report.json'),
      report,
    }
  } finally {
    if (!outDir) {
      await removeDir(baseDir)
    }
  }
}
