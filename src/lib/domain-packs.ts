import type { DomainPackMetadata, FamilyManifest, LayerManifest, Registry } from '../types.js'

import { countMatches, hasAny } from './keywords.js'

type DomainPackOwnerKind = 'family' | 'layer'

export interface DomainPackEntry {
  ownerKind: DomainPackOwnerKind
  ownerId: string
  familyId?: string
  layerId?: string
  pack: DomainPackMetadata
}

export interface DomainPackMatch {
  family: string
  score: number
  reasons: string[]
  layers?: string[]
  ambiguityGroup?: string
}

export interface DomainPackAmbiguity {
  group: string
  families: string[]
  score: number
  reason: string
}

function valueVariants(value: string): string[] {
  const lower = value.toLowerCase()
  const spaced = lower.replace(/[-_]+/g, ' ')
  const compact = lower.replace(/[-_\s]+/g, '')
  return [...new Set([lower, spaced, compact])]
}

function matchValue(text: string, value: string): boolean {
  return hasAny(text, valueVariants(value))
}

const RUNTIME_SIGNAL_GROUPS: { id: string; terms: string[] }[] = [
  { id: 'foundry', terms: ['foundry', 'forge', 'foundry.toml'] },
  { id: 'hardhat', terms: ['hardhat'] },
]

const SURFACE_COMPATIBILITY: Record<string, Record<string, number>> = {
  api: { api: 4, 'edge-api': 3, 'evm-infra': 3, fullstack: 1, service: 3 },
  backend: { api: 3, 'edge-api': 3, 'evm-infra': 3, fullstack: 1, service: 4, worker: 3 },
  indexer: { api: 2, 'edge-api': 2, 'evm-infra': 4, service: 3, worker: 3 },
  monitor: { api: 2, 'evm-infra': 4, service: 3, worker: 3 },
  service: { api: 3, 'edge-api': 3, 'evm-infra': 3, fullstack: 1, service: 4, worker: 3 },
  ui: { frontend: 4, fullstack: 1 },
  web: { frontend: 4, fullstack: 1 },
  worker: { 'edge-api': 3, 'evm-infra': 2, service: 3, worker: 4 },
}

const SURFACE_SIGNAL_TERMS: Record<string, string[]> = {
  api: ['api', 'endpoint', 'endpoints', 'route', 'routes'],
  backend: ['backend', 'service', 'server'],
  contracts: ['contract', 'contracts', 'solidity', 'foundry', 'forge'],
  indexer: ['indexer', 'monitor', 'monitoring', 'status api'],
  service: ['service', 'server', 'daemon'],
  ui: ['ui', 'interface', 'dashboard', 'frontend', 'front end'],
  web: ['web', 'website', 'frontend', 'front end'],
  worker: ['worker', 'queue', 'job', 'cron'],
}

const SURFACE_CLASS: Record<string, 'contracts' | 'frontend' | 'service'> = {
  api: 'service',
  backend: 'service',
  contracts: 'contracts',
  indexer: 'service',
  monitor: 'service',
  service: 'service',
  ui: 'frontend',
  web: 'frontend',
  worker: 'service',
}

function runtimeSignalGroup(runtime: string | undefined): string | null {
  if (!runtime) return null
  const normalized = runtime.toLowerCase()
  for (const group of RUNTIME_SIGNAL_GROUPS) {
    if (group.id === normalized || group.terms.includes(normalized)) return group.id
  }
  return null
}

function hasExplicitRuntimeConflict(text: string, runtime: string | undefined): boolean {
  const expectedGroup = runtimeSignalGroup(runtime)
  if (!expectedGroup) return false

  const mentionedGroups = RUNTIME_SIGNAL_GROUPS.filter((group) => hasAny(text, group.terms)).map(
    (group) => group.id,
  )
  return mentionedGroups.length > 0 && !mentionedGroups.includes(expectedGroup)
}

function hasExplicitSurfaceConflict(text: string, surface: string | undefined): boolean {
  if (!surface) return false
  const expectedClass = SURFACE_CLASS[surface.toLowerCase()]
  if (!expectedClass) return false

  const mentionedClasses = new Set<'contracts' | 'frontend' | 'service'>()
  for (const [candidateSurface, terms] of Object.entries(SURFACE_SIGNAL_TERMS)) {
    const surfaceClass = SURFACE_CLASS[candidateSurface]
    if (!surfaceClass) continue
    if (hasAny(text, terms)) mentionedClasses.add(surfaceClass)
  }

  return mentionedClasses.size > 0 && !mentionedClasses.has(expectedClass)
}

function addFieldScore(
  text: string,
  value: string | undefined,
  weight: number,
  reason: string,
  out: { score: number; reasons: string[] },
): boolean {
  if (!value) return false
  if (!matchValue(text, value)) return false
  out.score += weight
  out.reasons.push(reason)
  return true
}

function addSurfaceScore(
  text: string,
  surface: string | undefined,
  weight: number,
  out: { score: number; reasons: string[] },
): boolean {
  if (!surface) return false
  const terms = [surface, ...(SURFACE_SIGNAL_TERMS[surface.toLowerCase()] ?? [])]
  if (!hasAny(text, terms)) return false
  out.score += weight
  out.reasons.push(`surface:${surface}`)
  return true
}

function scoreFamilyDomainPack(
  prompt: string,
  family: FamilyManifest,
  partner: string | null,
): DomainPackMatch | null {
  const pack = family.domainPack
  if (!pack) return null

  const text = prompt.toLowerCase()
  if (hasExplicitRuntimeConflict(text, pack.domain.runtime)) return null
  if (hasExplicitSurfaceConflict(text, pack.domain.surface)) return null

  const result = { score: 0, reasons: [] as string[] }
  let domainEvidence = 0

  if (addFieldScore(text, pack.domain.family, 3, `domain:${pack.domain.family}`, result))
    domainEvidence += 1
  if (addFieldScore(text, pack.domain.provider, 5, `provider:${pack.domain.provider}`, result))
    domainEvidence += 1
  if (addFieldScore(text, pack.domain.protocol, 5, `protocol:${pack.domain.protocol}`, result))
    domainEvidence += 1

  if (partner && pack.domain.provider && valueVariants(pack.domain.provider).includes(partner)) {
    result.score += 3
    result.reasons.push(`partner:${partner}`)
    domainEvidence += 1
  }

  const authenticityHits = countMatches(text, pack.authenticitySignals ?? [])
  if (authenticityHits > 0) {
    result.score += authenticityHits
    result.reasons.push(`authenticity-signals:${authenticityHits}`)
    domainEvidence += authenticityHits
  }

  if (domainEvidence <= 0) return null

  addFieldScore(text, pack.domain.runtime, 7, `runtime:${pack.domain.runtime}`, result)
  addSurfaceScore(text, pack.domain.surface, 2, result)

  for (const provided of pack.provides) {
    if (matchValue(text, provided)) {
      result.score += 2
      result.reasons.push(`provides:${provided}`)
    }
  }

  if (result.score <= 0) return null
  return {
    family: family.id,
    score: result.score,
    reasons: result.reasons,
    ambiguityGroup: pack.ambiguityGroup,
  }
}

function surfaceCompatibilityScore(
  packSurface: string | undefined,
  family: FamilyManifest,
): number {
  if (!packSurface) return 0
  const familySurface = family.taxonomy?.surface
  if (!familySurface) return 0
  const normalizedPackSurface = packSurface.toLowerCase()
  const normalizedFamilySurface = familySurface.toLowerCase()
  if (normalizedFamilySurface === normalizedPackSurface) return 4
  return SURFACE_COMPATIBILITY[normalizedPackSurface]?.[normalizedFamilySurface] ?? 0
}

function scoreLayerDomainPack(
  prompt: string,
  layerKey: string,
  layer: LayerManifest,
  registry: Registry,
): DomainPackMatch[] {
  const pack = layer.domainPack
  if (!pack || layer.group !== 'capability' || !layer.appliesTo?.length) return []

  const text = prompt.toLowerCase()
  if (hasExplicitRuntimeConflict(text, pack.domain.runtime)) return []
  if (hasExplicitSurfaceConflict(text, pack.domain.surface)) return []

  const result = { score: 0, reasons: [] as string[] }
  let capabilityEvidence = 0

  addFieldScore(text, pack.domain.family, 3, `domain:${pack.domain.family}`, result)
  addFieldScore(text, pack.domain.provider, 5, `provider:${pack.domain.provider}`, result)
  addFieldScore(text, pack.domain.protocol, 5, `protocol:${pack.domain.protocol}`, result)

  const keywordHits = countMatches(text, layer.keywords ?? [])
  if (keywordHits > 0) {
    result.score += keywordHits * 2
    result.reasons.push(`layer-keywords:${layer.id}:${keywordHits}`)
    capabilityEvidence += keywordHits
  }

  const authenticityHits = countMatches(text, pack.authenticitySignals ?? [])
  if (authenticityHits > 0) {
    result.score += authenticityHits
    result.reasons.push(`authenticity-signals:${authenticityHits}`)
    capabilityEvidence += authenticityHits
  }

  for (const provided of pack.provides) {
    if (matchValue(text, provided)) {
      result.score += 2
      result.reasons.push(`provides:${provided}`)
      capabilityEvidence += 1
    }
  }

  if (capabilityEvidence <= 0) return []

  addFieldScore(text, pack.domain.runtime, 7, `runtime:${pack.domain.runtime}`, result)
  addSurfaceScore(text, pack.domain.surface, 6, result)

  return layer.appliesTo.flatMap((familyId, index) => {
    const family = registry.families.get(familyId)
    if (!family) return []
    const surfaceScore = surfaceCompatibilityScore(pack.domain.surface, family)
    const priorityTieBreak = (layer.appliesTo!.length - index) / 100
    return [
      {
        family: familyId,
        score: result.score + surfaceScore + priorityTieBreak,
        reasons: [
          `domain-pack-layer:${layerKey}`,
          ...result.reasons,
          ...(surfaceScore > 0 ? [`surface-compatible:${family.taxonomy?.surface}`] : []),
        ],
        layers: [layerKey],
      },
    ]
  })
}

export function listDomainPackEntries(registry: Registry): DomainPackEntry[] {
  const entries: DomainPackEntry[] = []
  for (const family of registry.families.values()) {
    if (!family.domainPack) continue
    entries.push({
      ownerKind: 'family',
      ownerId: family.id,
      familyId: family.id,
      pack: family.domainPack,
    })
  }
  for (const [layerId, layer] of registry.layers) {
    if (!layer.domainPack) continue
    entries.push({
      ownerKind: 'layer',
      ownerId: layerId,
      layerId,
      pack: layer.domainPack,
    })
  }
  return entries
}

export function scoreDomainPackFamilies({
  prompt,
  partner,
  registry,
}: {
  prompt: string
  partner: string | null
  registry: Registry
}): DomainPackMatch[] {
  const matches: DomainPackMatch[] = []
  for (const family of registry.families.values()) {
    const match = scoreFamilyDomainPack(prompt, family, partner)
    if (match) matches.push(match)
  }
  for (const [layerKey, layer] of registry.layers) {
    matches.push(...scoreLayerDomainPack(prompt, layerKey, layer, registry))
  }
  matches.sort((left, right) => right.score - left.score || left.family.localeCompare(right.family))
  return matches
}

export function detectDomainPackAmbiguity(matches: DomainPackMatch[]): DomainPackAmbiguity | null {
  const byGroup = new Map<string, DomainPackMatch[]>()
  for (const match of matches) {
    if (!match.ambiguityGroup) continue
    const bucket = byGroup.get(match.ambiguityGroup) ?? []
    bucket.push(match)
    byGroup.set(match.ambiguityGroup, bucket)
  }

  for (const [group, groupMatches] of byGroup) {
    if (groupMatches.length < 2) continue
    const sorted = [...groupMatches].sort(
      (left, right) => right.score - left.score || left.family.localeCompare(right.family),
    )
    const top = sorted[0]
    const close = sorted.filter((match) => top.score - match.score <= 1)
    if (close.length < 2) continue
    const families = close.map((match) => match.family)
    return {
      group,
      families,
      score: top.score,
      reason: `domain-pack ambiguity "${group}" matched ${families.join(', ')} with no decisive runtime/provider signal`,
    }
  }

  return null
}

export function domainPackLayersForFamily(registry: Registry, familyId: string): LayerManifest[] {
  return [...registry.layers.values()].filter(
    (layer) => layer.domainPack && layer.appliesTo?.includes(familyId),
  )
}
