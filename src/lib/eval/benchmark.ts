import path from 'node:path'

import type {
  ComposeSpec,
  BenchmarkReport,
  BenchmarkStats,
  BenchmarkRunResult,
} from '../../types.js'

import { composeStarter } from '../compose.js'
import { createContextPack } from '../context-pack.js'
import { createTempDir, removeDir, writeJson } from '../fs.js'
import { validateStarter } from '../validate.js'

function summarize(values: number[]): BenchmarkStats {
  const ordered = [...values].sort((left, right) => left - right)
  const sum = ordered.reduce((total, value) => total + value, 0)
  const mean = sum / ordered.length
  const pick = (ratio: number) =>
    ordered[Math.min(ordered.length - 1, Math.floor(ratio * (ordered.length - 1)))]

  return {
    min: ordered[0],
    max: ordered[ordered.length - 1],
    mean: Math.round(mean),
    p50: pick(0.5),
    p95: pick(0.95),
    samples: ordered.length,
  }
}

export async function benchmarkStarter({
  spec,
  runs = 1,
  outDir = null,
}: {
  spec: ComposeSpec
  runs?: number
  outDir?: string | null
}): Promise<BenchmarkReport> {
  const results: BenchmarkRunResult[] = []
  const primaryArtifactTargetMs = spec.primaryArtifactTargetMs ?? 3000

  for (let index = 0; index < runs; index += 1) {
    const runOutDir = outDir
      ? path.join(outDir, `run-${String(index + 1).padStart(2, '0')}`)
      : await createTempDir('starter-foundry-bench')

    const composeStart = performance.now()
    const composeResult = await composeStarter({ spec, outDir: runOutDir })
    const composeMs = Math.round(performance.now() - composeStart)

    const validateStart = performance.now()
    const validation = await validateStarter({ spec, outDir: runOutDir })
    const validateMs = Math.round(performance.now() - validateStart)

    const contextStart = performance.now()
    const context = await createContextPack({ spec, outDir: runOutDir })
    const contextMs = Math.round(performance.now() - contextStart)

    const totalMs = composeMs + validateMs + contextMs
    const run: BenchmarkRunResult = {
      runId: index + 1,
      outDir: runOutDir,
      composeMs,
      primaryArtifactMs: composeMs,
      primaryArtifactTargetMs,
      meetsPrimaryArtifactTarget: composeMs <= primaryArtifactTargetMs,
      validateMs,
      contextMs,
      totalMs,
      ok: validation.ok,
      filesWritten: composeResult.filesWritten.length,
      checksPassed: validation.checks.filter((check) => check.ok).length,
      checksTotal: validation.checks.length,
      contextPath: context.contextPath,
    }

    results.push(run)

    if (!outDir) {
      await removeDir(runOutDir)
    }
  }

  const report: BenchmarkReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    projectName: spec.projectName,
    runs,
    results,
    summary: {
      composeMs: summarize(results.map((result) => result.composeMs)),
      primaryArtifactMs: summarize(results.map((result) => result.primaryArtifactMs)),
      primaryArtifactTargetMs,
      primaryArtifactHitRate:
        results.filter((result) => result.meetsPrimaryArtifactTarget).length / results.length,
      validateMs: summarize(results.map((result) => result.validateMs)),
      contextMs: summarize(results.map((result) => result.contextMs)),
      totalMs: summarize(results.map((result) => result.totalMs)),
      passRate: results.filter((result) => result.ok).length / results.length,
    },
  }

  if (outDir) {
    await writeJson(path.join(outDir, 'benchmark-report.json'), report)
  }

  return report
}
