/**
 * Industry helpers — list and inspect industry layers from the registry.
 *
 * Industries are layers under registry/layers/industry/<id>/. Each ships a
 * personalize.css file that overrides Tailwind v4 @theme defaults at runtime
 * via :root cascade. The CSS file is the contract.
 */

import { loadRegistry } from './registry.js'
import type { LayerManifest } from '../types.js'

/**
 * Canonical paths where personalize.css lives in a composed project.
 * Blueprint-agent (or any consumer) writes its own personalize.css to one
 * of these paths to override the industry default.
 */
export const PERSONALIZE_CSS_PATHS = {
  vite: 'src/personalize.css',
  nextjs: 'app/personalize.css',
} as const

export interface IndustryInfo {
  id: string
  description: string
  keywords: string[]
  tone: string
  paletteCssPath: string
}

/**
 * List all industry layers in the registry with their metadata.
 * Useful for blueprint-agent to enumerate available industries when
 * generating LLM prompts or quiz UIs.
 */
export async function listIndustries(): Promise<IndustryInfo[]> {
  const registry = await loadRegistry()
  const industries: IndustryInfo[] = []
  for (const [_key, layer] of registry.layers) {
    if (layer.group !== 'industry') continue
    industries.push(industryInfoFromLayer(layer))
  }
  return industries.sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Get a single industry by id (without the "industry:" prefix).
 */
export async function getIndustry(id: string): Promise<IndustryInfo | null> {
  const registry = await loadRegistry()
  const layer = registry.layers.get(`industry:${id}`)
  if (!layer || layer.group !== 'industry') return null
  return industryInfoFromLayer(layer)
}

function industryInfoFromLayer(layer: LayerManifest): IndustryInfo {
  return {
    id: layer.id,
    description: layer.description,
    keywords: layer.keywords ?? [],
    tone: (layer.defaults?.['industryTone'] as string | undefined) ?? '',
    paletteCssPath: PERSONALIZE_CSS_PATHS.vite,
  }
}
