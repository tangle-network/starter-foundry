import fs from 'node:fs/promises'
import path from 'node:path'
import { readJson, resolveRepoRoot } from './fs.js'
import type {
  FamilyManifest,
  LayerManifest,
  PartnerManifest,
  Registry,
  ResolvedComponents,
  ComposeSpec,
} from '../types.js'

const repoRoot = resolveRepoRoot()
const registryRoot = path.join(repoRoot, 'registry')

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
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, interpolateValue(item, variables)]),
    )
  }

  return value
}

type RawManifest = Record<string, unknown>

function assertString(value: unknown, field: string, manifestPath: string): asserts value is string {
  if (typeof value !== 'string' || !value) {
    throw new Error(`Invalid manifest at ${manifestPath}: ${field} must be a non-empty string`)
  }
}

function validateFamilyManifest(raw: RawManifest, manifestPath: string): void {
  assertString(raw['id'], 'id', manifestPath)
  assertString(raw['description'], 'description', manifestPath)
  if (!Array.isArray(raw['tags'])) {
    throw new Error(`Invalid family manifest at ${manifestPath}: tags must be an array`)
  }
  if (raw['slots'] !== undefined && (typeof raw['slots'] !== 'object' || Array.isArray(raw['slots']) || raw['slots'] === null)) {
    throw new Error(`Invalid family manifest at ${manifestPath}: slots must be an object`)
  }
  if (raw['requires'] !== undefined && !Array.isArray(raw['requires'])) {
    throw new Error(`Invalid family manifest at ${manifestPath}: requires must be an array`)
  }
}

function validateLayerManifest(raw: RawManifest, manifestPath: string): void {
  assertString(raw['id'], 'id', manifestPath)
  assertString(raw['description'], 'description', manifestPath)
}

function validatePartnerManifest(raw: RawManifest, manifestPath: string): void {
  assertString(raw['id'], 'id', manifestPath)
  assertString(raw['description'], 'description', manifestPath)
  if (raw['slotDefaults'] !== undefined && (typeof raw['slotDefaults'] !== 'object' || Array.isArray(raw['slotDefaults']) || raw['slotDefaults'] === null)) {
    throw new Error(`Invalid partner manifest at ${manifestPath}: slotDefaults must be an object`)
  }
}

async function loadFamilies(): Promise<Map<string, FamilyManifest>> {
  const familiesDir = path.join(registryRoot, 'families')
  const ids = await fs.readdir(familiesDir)
  const manifests = await Promise.all(
    ids.map(async (id) => {
      const manifestPath = path.join(familiesDir, id, 'manifest.json')
      const raw = await readJson<RawManifest>(manifestPath)
      validateFamilyManifest(raw, manifestPath)
      return {
        ...raw,
        kind: 'family' as const,
        group: null as null,
        manifestPath,
        baseDir: path.dirname(manifestPath),
      } as FamilyManifest
    }),
  )
  return new Map(manifests.map((manifest) => [manifest.id, manifest]))
}

async function loadLayerGroups(): Promise<Map<string, LayerManifest>> {
  const layersDir = path.join(registryRoot, 'layers')
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
  const partnersDir = path.join(registryRoot, 'partners')
  const ids = await fs.readdir(partnersDir)
  const manifests = await Promise.all(
    ids.map(async (id) => {
      const manifestPath = path.join(partnersDir, id, 'manifest.json')
      const raw = await readJson<RawManifest>(manifestPath)
      validatePartnerManifest(raw, manifestPath)
      return {
        ...raw,
        kind: 'partner' as const,
        group: null as null,
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

/** Clears the in-process registry cache. Primarily useful in tests. */
export function clearRegistryCache(): void {
  registryPromise = null
}

export async function listRegistry(): Promise<{
  families: Array<{ id: string; description: string; tags: string[]; slots: Record<string, unknown> }>
  layers: Array<{ id: string; appliesTo?: string[]; description: string; slot: string | null }>
  partners: Array<{ id: string; description: string; slotDefaults: Record<string, string> }>
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
    throw new Error(`Layer ${layerId} is not a valid option for slot ${slotName} on family ${family.id}`)
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

  for (const requiredLayerId of family.requires ?? []) {
    const resolvedLayerIds = new Set([
      ...layers.map((layer) => `${layer.group}:${layer.id}`),
      ...Object.values(slotSelections),
    ])
    if (!resolvedLayerIds.has(requiredLayerId)) {
      throw new Error(`Family ${family.id} requires layer ${requiredLayerId} but it is not included`)
    }
  }

  return {
    family,
    layers,
    partner: partner ?? null,
    slotSelections,
  }
}

export function buildVariables(
  spec: ComposeSpec & { packageName?: string },
  components: ResolvedComponents,
): Record<string, unknown> {
  const variables: Record<string, unknown> = {
    projectName: spec.projectName,
    packageName: spec.packageName ?? spec.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
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
