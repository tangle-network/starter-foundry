import fs from 'node:fs/promises'
import path from 'node:path'
import { evaluateAgents } from './agent-runners.js'
import { createAuditBundle } from './audit.js'
import { benchmarkStarter } from './benchmark.js'
import { createTempDir, runTar, sanitizePackageName, writeJson } from './fs.js'
import { validateStarter } from './validate.js'
import type { ComposeSpec } from '../types.js'

export async function createRelease({
  spec,
  outDir = null,
  benchmarkRuns = 1,
  agents = null,
}: {
  spec: ComposeSpec
  outDir?: string | null
  benchmarkRuns?: number
  agents?: string[] | null
}): Promise<{
  releaseDir: string
  releasePath: string
  archivePath: string | null
  validationOk: boolean
  benchmarkPassRate: number
  agentEvaluationPassRate: number | null
}> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const baseDir =
    outDir ?? (await createTempDir(`starter-foundry-release-${sanitizePackageName(spec.projectName)}`))
  const releaseDir = path.join(baseDir, `${sanitizePackageName(spec.projectName)}-${timestamp}`)

  await fs.mkdir(releaseDir, { recursive: true })

  const audit = await createAuditBundle({ spec, outDir: releaseDir })
  const agentEvaluation =
    agents?.length ? await evaluateAgents({ spec, outDir: releaseDir, agents }) : null
  const validation = await validateStarter({ spec, outDir: releaseDir })
  const benchmark = await benchmarkStarter({ spec, runs: benchmarkRuns, outDir: releaseDir })

  const archivePath = path.join(baseDir, `${sanitizePackageName(spec.projectName)}-${timestamp}.tar.gz`)
  const archived = await runTar(releaseDir, archivePath)
  const releasePath = path.join(releaseDir, '.starter-foundry', 'release.json')

  await writeJson(releasePath, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    spec,
    validation,
    benchmark,
    audit,
    agentEvaluation,
    archive: archived ? archivePath : null,
  })

  return {
    releaseDir,
    releasePath,
    archivePath: archived ? archivePath : null,
    validationOk: validation.ok,
    benchmarkPassRate: benchmark.summary.passRate,
    agentEvaluationPassRate: agentEvaluation?.summary.passRate ?? null,
  }
}
