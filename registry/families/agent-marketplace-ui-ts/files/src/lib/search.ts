// search.ts — fuzzy search over the bundle catalog. Wraps fuse.js with a tuned
// key set: id (high weight, exact-id navigation), tags + tier1 keywords (route
// signals), description (free-text fallback).

import Fuse, { type IFuseOptions } from 'fuse.js'
import type { Bundle } from './catalog'

const FUSE_OPTIONS: IFuseOptions<Bundle> = {
  includeScore: true,
  threshold: 0.4,
  ignoreLocation: true,
  keys: [
    { name: 'id', weight: 0.4 },
    { name: 'tags', weight: 0.2 },
    { name: 'tier1Keywords', weight: 0.2 },
    { name: 'description', weight: 0.15 },
    { name: 'taxonomy.surface', weight: 0.05 },
  ],
}

export interface FilterState {
  query: string
  surfaces: string[]
  shape: 'all' | 'single-agent' | 'multi-agent'
}

export function emptyFilter(): FilterState {
  return { query: '', surfaces: [], shape: 'all' }
}

export function uniqueSurfaces(bundles: Bundle[]): string[] {
  const set = new Set<string>()
  for (const b of bundles) set.add(b.taxonomy.surface)
  return [...set].sort()
}

/**
 * Filter + score a bundle list. Empty query returns all bundles in their
 * input order, filtered by surface/shape predicates only.
 */
export function searchBundles(bundles: Bundle[], filter: FilterState): Bundle[] {
  const filtered = bundles.filter((b) => {
    if (filter.surfaces.length > 0 && !filter.surfaces.includes(b.taxonomy.surface)) {
      return false
    }
    if (filter.shape === 'single-agent' && b.isMultiAgent) return false
    if (filter.shape === 'multi-agent' && !b.isMultiAgent) return false
    return true
  })
  const query = filter.query.trim()
  if (!query) return filtered
  const fuse = new Fuse(filtered, FUSE_OPTIONS)
  return fuse.search(query).map((r) => r.item)
}
