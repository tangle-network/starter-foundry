import fs from 'node:fs/promises'
import path from 'node:path'

import { loadRegistry } from './registry.js'
import { interpolateValue } from './registry.js'

/**
 * Apply a capability layer to an existing project directory.
 * Copies the layer's files to their target paths and returns
 * what was written. Skips files that already exist when skipExisting is true.
 *
 * This is for augmenting curated tarballs — not composing from scratch.
 * Use composeStarter() for fresh project composition.
 */
export async function augmentWithLayer({
  projectDir,
  layerId,
  variables = {},
  skipExisting = true,
}: {
  projectDir: string
  layerId: string
  variables?: Record<string, unknown>
  skipExisting?: boolean
}): Promise<{
  filesWritten: string[]
  filesSkipped: string[]
}> {
  const registry = await loadRegistry()
  const layer = registry.layers.get(layerId)

  if (!layer) {
    throw new Error(`Unknown layer: ${layerId}`)
  }

  const filesWritten: string[] = []
  const filesSkipped: string[] = []

  for (const file of layer.files ?? []) {
    const target = interpolateValue(file.target, variables) as string
    const targetPath = path.join(projectDir, target)

    if (skipExisting) {
      try {
        await fs.access(targetPath)
        filesSkipped.push(target)
        continue
      } catch {
        // File doesn't exist — proceed to write
      }
    }

    const sourcePath = path.join(layer.baseDir, file.source)
    const raw = await fs.readFile(sourcePath, 'utf8')
    const rendered = raw.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      return key in variables ? String(variables[key]) : ''
    })

    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, rendered, 'utf8')
    filesWritten.push(target)
  }

  return { filesWritten, filesSkipped }
}
