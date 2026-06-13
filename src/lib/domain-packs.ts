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

function scoreFamilyDomainPack(
  prompt: string,
  family: FamilyManifest,
  partner: string | null,
): DomainPackMatch | null {
  const pack = family.domainPack
  if (!pack) return null

  const text = prompt.toLowerCase()
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
  addFieldScore(text, pack.domain.surface, 2, `surface:${pack.domain.surface}`, result)

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
