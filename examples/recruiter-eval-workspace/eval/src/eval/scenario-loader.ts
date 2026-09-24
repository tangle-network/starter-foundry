// Composable scenario loader — used by the harness family's runner and by
// any consumer that needs to enumerate scenarios outside the runner (e.g.
// `eval-harness list`, the regression-gate dimension extractor, etc.).
//
// Validates the loaded module's default export against the Scenario shape;
// throws with a precise path on shape mismatch so loader bugs do not
// silently degrade into "the scenario didn't run".

import { readdir } from 'node:fs/promises'
import { join, isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Scenario } from './scenario-types.js'

export interface LoadedScenario {
  scenario: Scenario
  filePath: string
}

const REQUIRED_KEYS: ReadonlyArray<keyof Scenario> = [
  'id',
  'persona',
  'label',
  'thesis',
  'dimensions',
  'turns',
  'artifactChecks',
]

function assertScenarioShape(value: unknown, filePath: string): asserts value is Scenario {
  if (!value || typeof value !== 'object') {
    throw new Error(`scenario-loader: ${filePath} did not export an object`)
  }
  const s = value as Record<string, unknown>
  for (const k of REQUIRED_KEYS) {
    if (!(k in s)) {
      throw new Error(`scenario-loader: ${filePath} default export missing required field "${k}"`)
    }
  }
  if (typeof s.id !== 'string' || s.id.length === 0) {
    throw new Error(`scenario-loader: ${filePath} has empty/non-string id`)
  }
  if (!Array.isArray(s.turns) || s.turns.length === 0) {
    throw new Error(`scenario-loader: ${filePath} must have at least one turn`)
  }
  if (!Array.isArray(s.dimensions) || s.dimensions.length === 0) {
    throw new Error(`scenario-loader: ${filePath} must declare at least one dimension`)
  }
  if (!Array.isArray(s.artifactChecks)) {
    throw new Error(`scenario-loader: ${filePath} artifactChecks must be an array`)
  }
}

export async function loadScenarios(scenariosDir: string): Promise<LoadedScenario[]> {
  let entries: string[]
  try {
    entries = await readdir(scenariosDir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
  const out: LoadedScenario[] = []
  for (const entry of entries) {
    if (!entry.endsWith('.scenario.ts') && !entry.endsWith('.scenario.js')) continue
    const filePath = isAbsolute(scenariosDir)
      ? join(scenariosDir, entry)
      : resolve(scenariosDir, entry)
    const url = pathToFileURL(filePath).href
    const mod = (await import(url)) as { default?: Scenario | Scenario[] }
    if (!mod.default) {
      throw new Error(`scenario-loader: ${filePath} has no default export`)
    }
    const list = Array.isArray(mod.default) ? mod.default : [mod.default]
    for (const scenario of list) {
      assertScenarioShape(scenario, filePath)
      out.push({ scenario, filePath })
    }
  }
  // Stable order: id-asc — keeps scorecards diff-stable across runs.
  out.sort((a, b) => a.scenario.id.localeCompare(b.scenario.id))
  return out
}

export function uniqueScenarioIds(loaded: LoadedScenario[]): string[] {
  return Array.from(new Set(loaded.map((l) => l.scenario.id)))
}
