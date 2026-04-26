import fs from 'node:fs/promises'
import path from 'node:path'

import type {
  FamilyManifest,
  LayerManifest,
  PartnerManifest,
  Registry,
  ResolvedComponents,
  ComposeSpec,
} from '../types.js'

import { readJson, resolveRepoRoot } from './fs.js'

let registryRoot: string | null = null

async function getRegistryRoot(): Promise<string> {
  if (!registryRoot) {
    const repoRoot = await resolveRepoRoot()
    registryRoot = path.join(repoRoot, 'registry')
  }
  return registryRoot
}

function interpolateString(value: string, variables: Record<string, unknown>): string {
  return value.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (key in variables) {
      return String(variables[key])
    }
    return ''
  })
}

export function interpolateValue(value: unknown, variables: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    return interpolateString(value, variables)
  }

  if (Array.isArray(value)) {
    return value.map((item) => interpolateValue(item, variables))
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        interpolateValue(item, variables),
      ]),
    )
  }

  return value
}

type RawManifest = Record<string, unknown>

function assertString(
  value: unknown,
  field: string,
  manifestPath: string,
): asserts value is string {
  if (typeof value !== 'string' || !value) {
    throw new Error(`Invalid manifest at ${manifestPath}: ${field} must be a non-empty string`)
  }
}

function validateFamilyManifest(raw: RawManifest, manifestPath: string): void {
  assertString(raw.id, 'id', manifestPath)
  assertString(raw.description, 'description', manifestPath)
  if (!Array.isArray(raw.tags)) {
    throw new Error(`Invalid family manifest at ${manifestPath}: tags must be an array`)
  }
  if (
    raw.slots !== undefined &&
    (typeof raw.slots !== 'object' || Array.isArray(raw.slots) || raw.slots === null)
  ) {
    throw new Error(`Invalid family manifest at ${manifestPath}: slots must be an object`)
  }
  if (raw.requires !== undefined && !Array.isArray(raw.requires)) {
    throw new Error(`Invalid family manifest at ${manifestPath}: requires must be an array`)
  }
}

function validateLayerManifest(raw: RawManifest, manifestPath: string): void {
  assertString(raw.id, 'id', manifestPath)
  assertString(raw.description, 'description', manifestPath)
}

function validatePartnerManifest(raw: RawManifest, manifestPath: string): void {
  assertString(raw.id, 'id', manifestPath)
  assertString(raw.description, 'description', manifestPath)
  if (
    raw.slotDefaults !== undefined &&
    (typeof raw.slotDefaults !== 'object' ||
      Array.isArray(raw.slotDefaults) ||
      raw.slotDefaults === null)
  ) {
    throw new Error(`Invalid partner manifest at ${manifestPath}: slotDefaults must be an object`)
  }
}

async function loadFamilies(): Promise<Map<string, FamilyManifest>> {
  const familiesDir = path.join(await getRegistryRoot(), 'families')
  const ids = await fs.readdir(familiesDir)
  const manifests = await Promise.all(
    ids.map(async (id) => {
      const manifestPath = path.join(familiesDir, id, 'manifest.json')
      const raw = await readJson<RawManifest>(manifestPath)
      validateFamilyManifest(raw, manifestPath)
      return {
        ...raw,
        kind: 'family' as const,
        group: null,
        manifestPath,
        baseDir: path.dirname(manifestPath),
      } as FamilyManifest
    }),
  )
  return new Map(manifests.map((manifest) => [manifest.id, manifest]))
}

async function loadLayerGroups(): Promise<Map<string, LayerManifest>> {
  const layersDir = path.join(await getRegistryRoot(), 'layers')
  const groups = await fs.readdir(layersDir)
  const groupDirs = await Promise.all(
    groups.map(async (group) => {
      const groupDir = path.join(layersDir, group)
      const ids = await fs.readdir(groupDir)
      return { group, groupDir, ids }
    }),
  )

  const manifests = await Promise.all(
    groupDirs.flatMap(({ group, groupDir, ids }) =>
      ids.map(async (id) => {
        const manifestPath = path.join(groupDir, id, 'manifest.json')
        const raw = await readJson<RawManifest>(manifestPath)
        validateLayerManifest(raw, manifestPath)
        return {
          ...raw,
          kind: 'layer' as const,
          group,
          manifestPath,
          baseDir: path.dirname(manifestPath),
        } as LayerManifest
      }),
    ),
  )

  return new Map(manifests.map((manifest) => [`${manifest.group}:${manifest.id}`, manifest]))
}

async function loadPartners(): Promise<Map<string, PartnerManifest>> {
  const partnersDir = path.join(await getRegistryRoot(), 'partners')
  const ids = await fs.readdir(partnersDir)
  const manifests = await Promise.all(
    ids.map(async (id) => {
      const manifestPath = path.join(partnersDir, id, 'manifest.json')
      const raw = await readJson<RawManifest>(manifestPath)
      validatePartnerManifest(raw, manifestPath)
      return {
        ...raw,
        kind: 'partner' as const,
        group: null,
        manifestPath,
        baseDir: path.dirname(manifestPath),
      } as PartnerManifest
    }),
  )
  return new Map(manifests.map((manifest) => [manifest.id, manifest]))
}

let registryPromise: Promise<Registry> | null = null

export async function loadRegistry(): Promise<Registry> {
  if (!registryPromise) {
    registryPromise = Promise.all([loadFamilies(), loadLayerGroups(), loadPartners()]).then(
      ([families, layers, partners]) => ({ families, layers, partners }),
    )
  }

  return registryPromise
}

/**
 * Initialize the semantic router (embedding-based fallback).
 * Call once at server startup for ~15ms embedding inference on low-confidence prompts.
 * Optional — if not called, the keyword scorer handles everything alone.
 */
export async function initSemanticRouting(): Promise<void> {
  const registry = await loadRegistry()
  const { initSemanticRouter } = await import('./semantic-router.js')
  await initSemanticRouter(registry)
}

/** Clears the in-process registry cache. Primarily useful in tests. */
export function clearRegistryCache(): void {
  registryPromise = null
  registryRoot = null
}

export async function listRegistry(): Promise<{
  families: { id: string; description: string; tags: string[]; slots: Record<string, unknown> }[]
  layers: { id: string; appliesTo?: string[]; description: string; slot: string | null }[]
  partners: { id: string; description: string; slotDefaults: Record<string, string> }[]
}> {
  const registry = await loadRegistry()
  return {
    families: [...registry.families.values()].map((item) => ({
      id: item.id,
      description: item.description,
      tags: item.tags,
      slots: item.slots ?? {},
    })),
    layers: [...registry.layers.values()].map((item) => ({
      id: `${item.group}:${item.id}`,
      appliesTo: item.appliesTo,
      description: item.description,
      slot: item.slot ?? null,
    })),
    partners: [...registry.partners.values()].map((item) => ({
      id: item.id,
      description: item.description,
      slotDefaults: item.slotDefaults ?? {},
    })),
  }
}

export async function loadProjectSpec(specPath: string): Promise<ComposeSpec> {
  return readJson<ComposeSpec>(path.resolve(specPath))
}

function assertCompatibleLayer(layer: LayerManifest, familyId: string): void {
  if (Array.isArray(layer.appliesTo) && !layer.appliesTo.includes(familyId)) {
    throw new Error(`Layer ${layer.group}:${layer.id} is not compatible with family ${familyId}`)
  }
}

function assertCompatiblePartner(partner: PartnerManifest, familyId: string): void {
  if (Array.isArray(partner.appliesTo) && !partner.appliesTo.includes(familyId)) {
    throw new Error(`Partner ${partner.id} is not compatible with family ${familyId}`)
  }
}

function assertSlotSelection(family: FamilyManifest, slotName: string, layerId: string): void {
  const slot = family.slots?.[slotName]
  if (!slot) {
    throw new Error(`Family ${family.id} does not define slot ${slotName}`)
  }

  if (Array.isArray(slot.options) && !slot.options.includes(layerId)) {
    throw new Error(
      `Layer ${layerId} is not a valid option for slot ${slotName} on family ${family.id}`,
    )
  }
}

function buildSlotSelections(
  spec: ComposeSpec,
  family: FamilyManifest,
  partner: PartnerManifest | null,
  explicitLayers: LayerManifest[],
): Record<string, string> {
  const slotSelections: Record<string, string> = {}

  for (const [slotName, slotConfig] of Object.entries(family.slots ?? {})) {
    if (slotConfig.default) {
      slotSelections[slotName] = slotConfig.default
    }
  }

  for (const [slotName, layerId] of Object.entries(partner?.slotDefaults ?? {})) {
    if (family.slots?.[slotName]) {
      slotSelections[slotName] = layerId
    }
  }

  for (const [slotName, layerId] of Object.entries(spec.slots ?? {})) {
    slotSelections[slotName] = layerId
  }

  for (const layer of explicitLayers) {
    if (layer.slot) {
      slotSelections[layer.slot] = `${layer.group}:${layer.id}`
    }
  }

  for (const [slotName, layerId] of Object.entries(slotSelections)) {
    assertSlotSelection(family, slotName, layerId)
  }

  return slotSelections
}

export async function resolveComponents(spec: ComposeSpec): Promise<ResolvedComponents> {
  const registry = await loadRegistry()
  const family = registry.families.get(spec.family)

  if (!family) {
    throw new Error(`Unknown family ${spec.family}`)
  }

  const explicitLayers = (spec.layers ?? []).map((layerId) => {
    const layer = registry.layers.get(layerId)
    if (!layer) {
      throw new Error(`Unknown layer ${layerId}`)
    }
    assertCompatibleLayer(layer, family.id)
    return layer
  })

  const partner = spec.partner ? registry.partners.get(spec.partner) : null
  if (spec.partner && !partner) {
    throw new Error(`Unknown partner ${spec.partner}`)
  }
  if (partner) {
    assertCompatiblePartner(partner, family.id)
  }

  const slotSelections = buildSlotSelections(spec, family, partner ?? null, explicitLayers)
  const layers = [...explicitLayers]

  for (const [slotName, layerId] of Object.entries(slotSelections)) {
    const alreadyIncluded = layers.some((layer) => layer.slot === slotName)
    if (alreadyIncluded) {
      continue
    }

    const layer = registry.layers.get(layerId)
    if (!layer) {
      throw new Error(`Unknown layer ${layerId} for slot ${slotName}`)
    }
    assertCompatibleLayer(layer, family.id)
    layers.push(layer)
  }

  // family.includes — additive multi-pick layers stacked on every compose.
  // Bypasses the slot mechanism: useful when a bundle declares "always stack
  // these N layers" without inventing N single-option slots.
  for (const includedLayerId of family.includes ?? []) {
    if (layers.some((l) => `${l.group}:${l.id}` === includedLayerId)) continue
    const layer = registry.layers.get(includedLayerId)
    if (!layer) {
      throw new Error(
        `Family ${family.id} declares includes "${includedLayerId}" but no such layer exists in the registry`,
      )
    }
    assertCompatibleLayer(layer, family.id)
    layers.push(layer)
  }

  for (const requiredLayerId of family.requires ?? []) {
    const resolvedLayerIds = new Set([
      ...layers.map((layer) => `${layer.group}:${layer.id}`),
      ...Object.values(slotSelections),
    ])
    if (!resolvedLayerIds.has(requiredLayerId)) {
      throw new Error(
        `Family ${family.id} requires layer ${requiredLayerId} but it is not included`,
      )
    }
  }

  // Capability resolution: layers declare provides/requires/conflictsWith.
  // 1. Detect duplicate provides (two layers offering the same capability =
  //    compose-time error, must disambiguate via slot or includes).
  // 2. Detect missing requires (a layer wants capability X but no layer in
  //    the stack provides it).
  // 3. Detect conflicts (layer A says it conflicts with capability B and B
  //    is provided by another layer in the stack).
  // 4. Topo-sort the layer list so providers run before requirers (deterministic
  //    ordering when files target the same path).
  const orderedLayers = resolveLayerCapabilities(family.id, layers)

  return {
    family,
    layers: orderedLayers,
    partner: partner ?? null,
    slotSelections,
  }
}

function resolveLayerCapabilities(familyId: string, layers: LayerManifest[]): LayerManifest[] {
  const provides = new Map<string, string>()
  for (const layer of layers) {
    for (const cap of layer.provides ?? []) {
      const owner = `${layer.group}:${layer.id}`
      const existing = provides.get(cap)
      if (existing && existing !== owner) {
        throw new Error(
          `Capability conflict in family ${familyId}: both ${existing} and ${owner} provide "${cap}". ` +
            `Pick one via slot or remove one from family.includes.`,
        )
      }
      provides.set(cap, owner)
    }
  }

  for (const layer of layers) {
    const owner = `${layer.group}:${layer.id}`
    for (const need of layer.requires ?? []) {
      if (!provides.has(need)) {
        throw new Error(
          `Layer ${owner} in family ${familyId} requires capability "${need}", but no layer in the stack provides it. ` +
            `Add a provider to family.includes or pick one in slots.`,
        )
      }
    }
    for (const conflict of layer.conflictsWith ?? []) {
      const conflictingOwner = provides.get(conflict)
      if (conflictingOwner && conflictingOwner !== owner) {
        throw new Error(
          `Layer ${owner} in family ${familyId} conflicts with capability "${conflict}" provided by ${conflictingOwner}.`,
        )
      }
      const conflictingLayer = layers.find((l) => `${l.group}:${l.id}` === conflict)
      if (conflictingLayer && conflictingLayer !== layer) {
        throw new Error(
          `Layer ${owner} in family ${familyId} conflicts with layer ${conflict} but both are stacked.`,
        )
      }
    }
  }

  // Topo-sort: producers before consumers. Stable on capability-free layers
  // (preserves insertion order for them).
  const indexById = new Map<string, number>()
  layers.forEach((l, i) => indexById.set(`${l.group}:${l.id}`, i))
  const visited = new Set<string>()
  const ordered: LayerManifest[] = []
  function visit(layer: LayerManifest, stack: Set<string>): void {
    const id = `${layer.group}:${layer.id}`
    if (visited.has(id)) return
    if (stack.has(id)) {
      throw new Error(`Capability cycle detected in family ${familyId} at layer ${id}`)
    }
    stack.add(id)
    for (const need of layer.requires ?? []) {
      const provider = provides.get(need)
      if (!provider) continue
      const providerLayer = layers.find((l) => `${l.group}:${l.id}` === provider)
      if (providerLayer) visit(providerLayer, stack)
    }
    stack.delete(id)
    visited.add(id)
    ordered.push(layer)
  }
  for (const layer of layers) visit(layer, new Set<string>())
  return ordered
}

export function buildVariables(
  spec: ComposeSpec & { packageName?: string },
  components: ResolvedComponents,
): Record<string, unknown> {
  const packageName = spec.packageName ?? spec.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const variables: Record<string, unknown> = {
    projectName: spec.projectName,
    packageName,
    crateName: packageName.replace(/-/g, '_'),
    ...components.family.defaults,
  }

  for (const layer of components.layers) {
    Object.assign(variables, layer.defaults ?? {})
  }

  if (components.partner) {
    Object.assign(variables, components.partner.defaults ?? {})
  }

  Object.assign(variables, components.slotSelections ?? {})
  Object.assign(variables, spec.variables ?? {})
  return variables
}

export function resolveTemplateObject(value: unknown, variables: Record<string, unknown>): unknown {
  return interpolateValue(value, variables)
}
