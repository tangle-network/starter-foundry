import path from 'node:path'

import type { PrimaryProjectManifest } from '../types.js'

import { writeJson } from './fs.js'
import { PRIMARY_PROJECT_MANIFEST_PATH, validatePrimaryProjectManifest } from './primary-project.js'

export async function writePrimaryProjectManifest(
  outDir: string,
  manifest: PrimaryProjectManifest,
): Promise<void> {
  await writeJson(
    path.join(outDir, PRIMARY_PROJECT_MANIFEST_PATH),
    validatePrimaryProjectManifest(manifest),
  )
}
