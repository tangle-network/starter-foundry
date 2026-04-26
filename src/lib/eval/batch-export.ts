import fs from 'node:fs/promises'
import path from 'node:path'

import type { ComposeSpec } from '../../types.js'

import { composeStarter } from '../compose.js'
import { fattenStarter } from '../fatten.js'
import { ensureDir, readJson, runTar, writeJson } from '../fs.js'
import { listRegistry } from '../registry.js'
import { validateStarter } from '../validate.js'

interface MappingEntry {
  family: string
  layers?: string[]
  partner?: string | null
  slots?: Record<string, string>
  userPrompt?: string
}

interface MappingFile {
  version: number
  templates: Record<string, MappingEntry>
}

interface ExportResult {
  template: string
  success: boolean
  archivePath: string | null
  filesWritten: number
  composeMs: number
  fattenMs: number
  validationOk: boolean
  error: string | null
}

interface BatchExportResult {
  outDir: string
  total: number
  succeeded: number
  failed: number
  results: ExportResult[]
  durationMs: number
}

export async function batchExport({
  mappingPath,
  outDir,
  filter = null,
  fatten: shouldFatten = false,
  validate: shouldValidate = true,
  concurrency = 4,
}: {
  mappingPath: string
  outDir: string
  filter?: string[] | null
  fatten?: boolean
  validate?: boolean
  concurrency?: number
}): Promise<BatchExportResult> {
  const start = performance.now()
  const mapping = await readJson<MappingFile>(mappingPath)
  await ensureDir(outDir)

  // Load registry to filter incompatible layers
  const registry = await listRegistry()
  const layerCompatibility = new Map<string, Set<string>>()
  for (const layer of registry.layers) {
    if (layer.appliesTo?.length) {
      layerCompatibility.set(layer.id, new Set(layer.appliesTo))
    }
  }

  const templateNames = filter ?? Object.keys(mapping.templates)
  const results: ExportResult[] = []

  // Process in batches for controlled concurrency
  for (let i = 0; i < templateNames.length; i += concurrency) {
    const batch = templateNames.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map((name) =>
        exportSingle(
          name,
          mapping.templates[name],
          outDir,
          shouldFatten,
          shouldValidate,
          layerCompatibility,
        ),
      ),
    )
    results.push(...batchResults)

    const done = Math.min(i + concurrency, templateNames.length)
    const ok = results.filter((r) => r.success).length
    console.log(`[${done}/${templateNames.length}] ${ok} ok, ${done - ok} failed`)
  }

  const succeeded = results.filter((r) => r.success).length
  const reportPath = path.join(outDir, 'batch-export-report.json')
  const report: BatchExportResult = {
    outDir,
    total: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
    durationMs: Math.round(performance.now() - start),
  }

  await writeJson(reportPath, report)

  return report
}

async function exportSingle(
  templateName: string,
  entry: MappingEntry,
  outDir: string,
  shouldFatten: boolean,
  shouldValidate: boolean,
  layerCompatibility: Map<string, Set<string>>,
): Promise<ExportResult> {
  const composeDir = path.join(outDir, '_compose', templateName)
  const archivePath = path.join(outDir, `${templateName}.tar.gz`)

  try {
    // Filter layers to only those compatible with this family
    const compatibleLayers = (entry.layers ?? []).filter((layerId) => {
      const families = layerCompatibility.get(layerId)
      if (!families) return true // no appliesTo means universal
      return families.has(entry.family)
    })

    const skippedLayers = (entry.layers ?? []).filter((l) => !compatibleLayers.includes(l))
    if (skippedLayers.length > 0) {
      console.log(`  [${templateName}] Skipped incompatible layers: ${skippedLayers.join(', ')}`)
    }

    // Compose
    const composeStart = performance.now()
    const spec: ComposeSpec = {
      projectName: templateName,
      family: entry.family,
      layers: compatibleLayers,
      partner: entry.partner,
      slots: entry.slots,
      userPrompt: entry.userPrompt,
    }

    const composeResult = await composeStarter({ spec, outDir: composeDir })
    const composeMs = Math.round(performance.now() - composeStart)

    // Optionally fatten (install deps, pre-bundle)
    let fattenMs = 0
    if (shouldFatten) {
      const fattenStart = performance.now()
      await fattenStarter(composeDir)
      fattenMs = Math.round(performance.now() - fattenStart)
    }

    // Optionally validate
    let validationOk = true
    if (shouldValidate) {
      const validation = await validateStarter({ spec, outDir: composeDir })
      validationOk = validation.ok
    }

    // Create tarball
    const archived = await runTar(composeDir, archivePath)
    if (!archived) {
      return {
        template: templateName,
        success: false,
        archivePath: null,
        filesWritten: composeResult.filesWritten.length,
        composeMs,
        fattenMs,
        validationOk,
        error: 'tar failed',
      }
    }

    // Save metadata alongside tarball
    await writeJson(path.join(outDir, `${templateName}.meta.json`), {
      template: templateName,
      family: entry.family,
      layers: entry.layers ?? [],
      partner: entry.partner ?? null,
      filesWritten: composeResult.filesWritten.length,
      composeMs,
      fattenMs,
      validationOk,
      generatedAt: new Date().toISOString(),
      source: 'starter-foundry/batch-export',
    })

    return {
      template: templateName,
      success: true,
      archivePath,
      filesWritten: composeResult.filesWritten.length,
      composeMs,
      fattenMs,
      validationOk,
      error: null,
    }
  } catch (err) {
    return {
      template: templateName,
      success: false,
      archivePath: null,
      filesWritten: 0,
      composeMs: 0,
      fattenMs: 0,
      validationOk: false,
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    // Clean up compose dir to save disk
    if (!shouldFatten) {
      await fs
        .rm(path.join(outDir, '_compose', templateName), { recursive: true, force: true })
        .catch(() => {})
    }
  }
}
