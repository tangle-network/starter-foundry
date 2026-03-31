import path from 'node:path'
import { readJson, writeJson } from './fs.js'
import { runPromptCorpus } from './prompt-e2e.js'

interface CorpusResult {
  ok: boolean
  routeOk: boolean
  validationOk: boolean
  primaryArtifactHit: boolean
  kind: 'starter' | 'workspace'
  complexity: string
  route: {
    family?: string
    projectFamilies?: Record<string, string>
  }
  validationEvidence: {
    mode: string
    projects: Array<{ mode: string; tools: string[] }>
  }
}

interface BucketSummary {
  scenarios: number
  passRate: number
  routeAccuracy: number
  validationPassRate: number
  primaryArtifactHitRate: number
}

function summarizeBucket(results: CorpusResult[]): BucketSummary {
  return {
    scenarios: results.length,
    passRate: results.filter((result) => result.ok).length / results.length,
    routeAccuracy: results.filter((result) => result.routeOk).length / results.length,
    validationPassRate: results.filter((result) => result.validationOk).length / results.length,
    primaryArtifactHitRate: results.filter((result) => result.primaryArtifactHit).length / results.length,
  }
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of items) {
    const key = keyFn(item)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

function collectFamilyCoverage(results: CorpusResult[]): string[] {
  const families = new Set<string>()

  for (const result of results) {
    if (result.kind === 'starter') {
      if (result.route.family) families.add(result.route.family)
      continue
    }

    for (const family of Object.values(result.route.projectFamilies ?? {})) {
      families.add(family)
    }
  }

  return [...families].sort()
}

function collectComplexityBreakdown(results: CorpusResult[]): Record<string, BucketSummary> {
  const groups: Record<string, CorpusResult[]> = {}

  for (const result of results) {
    groups[result.complexity] = groups[result.complexity] ?? []
    groups[result.complexity]!.push(result)
  }

  return Object.fromEntries(
    Object.entries(groups).map(([complexity, bucket]) => [complexity, summarizeBucket(bucket)]),
  )
}

function collectKindBreakdown(results: CorpusResult[]): { starter: BucketSummary; workspace: BucketSummary } {
  const starters = results.filter((result) => result.kind === 'starter')
  const workspaces = results.filter((result) => result.kind === 'workspace')

  return {
    starter: summarizeBucket(starters),
    workspace: summarizeBucket(workspaces),
  }
}

function collectValidationCoverage(results: CorpusResult[]): {
  scenarioModes: Record<string, number>
  projectModes: Record<string, number>
} {
  const scenarioModes = countBy(results, (result) => result.validationEvidence.mode)
  const projectModes: Record<string, number> = {}

  for (const result of results) {
    for (const project of result.validationEvidence.projects ?? []) {
      projectModes[project.mode] = (projectModes[project.mode] ?? 0) + 1
    }
  }

  return { scenarioModes, projectModes }
}

interface Corpus {
  name: string
}

export interface ProofReport {
  schemaVersion: 1
  generatedAt: string
  corpus: string
  scenarioCount: number
  summary: {
    passRate: number
    routeAccuracy: number
    validationPassRate: number
    primaryArtifactHitRate: number
  }
  coverage: {
    kinds: Record<string, number>
    complexities: Record<string, BucketSummary>
    byKind: { starter: BucketSummary; workspace: BucketSummary }
    families: string[]
    validation: { scenarioModes: Record<string, number>; projectModes: Record<string, number> }
  }
  results: CorpusResult[]
}

export async function runProofSuite({
  corpusPath,
  outDir,
}: {
  corpusPath: string
  outDir: string
}): Promise<{
  outDir: string
  reportPath: string
  report: ProofReport
}> {
  const corpus = await readJson<Corpus>(corpusPath)
  const promptE2E = await runPromptCorpus({ corpusPath, outDir })
  const { results, summary } = promptE2E.report

  const proofReport = {
    schemaVersion: 1 as const,
    generatedAt: new Date().toISOString(),
    corpus: corpus.name,
    scenarioCount: promptE2E.report.scenarioCount,
    summary,
    coverage: {
      kinds: countBy(results, (result) => result.kind),
      complexities: collectComplexityBreakdown(results),
      byKind: collectKindBreakdown(results),
      families: collectFamilyCoverage(results),
      validation: collectValidationCoverage(results),
    },
    results,
  }

  const reportPath = path.join(outDir, 'proof-report.json')
  await writeJson(reportPath, proofReport)

  return {
    outDir,
    reportPath,
    report: proofReport,
  }
}
