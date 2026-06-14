#!/usr/bin/env node
// Validate every registry manifest against its JSON schema + check for
// semantic invariants (keyword overlap, dangling appliesTo, missing coverage).
// Runs in CI on every PR touching registry/.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMAS_DIR = join(REPO, 'registry/_schemas')
const FAMILIES_DIR = join(REPO, 'registry/families')
const LAYERS_DIR = join(REPO, 'registry/layers')
const PARTNERS_DIR = join(REPO, 'registry/partners')

// Minimal JSON-schema-ish validator. We're not a full draft-2020-12
// implementation — we enforce the rules our schemas actually use.
function loadSchema(name) {
  return JSON.parse(readFileSync(join(SCHEMAS_DIR, name), 'utf8'))
}

const SCHEMAS = {
  family: loadSchema('family.schema.json'),
  layer: loadSchema('layer.schema.json'),
  partner: loadSchema('partner.schema.json'),
  buildhints: loadSchema('buildhints.schema.json'),
}

function deref(schema) {
  // Inline buildhints refs so validation is single-pass.
  if (schema && typeof schema === 'object') {
    if (schema.$ref === 'buildhints.schema.json') return SCHEMAS.buildhints
    const out = Array.isArray(schema) ? [] : {}
    for (const [k, v] of Object.entries(schema)) out[k] = deref(v)
    return out
  }
  return schema
}

const FAMILY_SCHEMA = deref(SCHEMAS.family)
const LAYER_SCHEMA = deref(SCHEMAS.layer)
const PARTNER_SCHEMA = deref(SCHEMAS.partner)

function validate(value, schema, path = '$') {
  const errors = []
  if (schema.type) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type]
    const actual = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value
    if (!expected.includes(actual)) {
      errors.push(`${path}: expected ${expected.join('|')}, got ${actual}`)
      return errors
    }
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: "${value}" not in enum [${schema.enum.join(', ')}]`)
  }
  if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) {
    errors.push(`${path}: "${value}" does not match pattern ${schema.pattern}`)
  }
  if (
    schema.minLength !== undefined &&
    typeof value === 'string' &&
    value.length < schema.minLength
  ) {
    errors.push(`${path}: string length ${value.length} < minLength ${schema.minLength}`)
  }
  if (schema.minItems !== undefined && Array.isArray(value) && value.length < schema.minItems) {
    errors.push(`${path}: array length ${value.length} < minItems ${schema.minItems}`)
  }
  if (schema.required && typeof value === 'object' && value !== null) {
    for (const req of schema.required) {
      if (!(req in value)) errors.push(`${path}.${req}: required field missing`)
    }
  }
  if (schema.properties && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) {
      const propSchema = schema.properties[k]
      if (propSchema) {
        errors.push(...validate(v, propSchema, `${path}.${k}`))
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}.${k}: unexpected property (additionalProperties=false)`)
      } else if (typeof schema.additionalProperties === 'object') {
        errors.push(...validate(v, schema.additionalProperties, `${path}.${k}`))
      }
    }
  }
  if (schema.items && Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      errors.push(...validate(value[i], schema.items, `${path}[${i}]`))
    }
  }
  return errors
}

const failures = []

function readManifest(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    failures.push(`${path}: JSON parse failed — ${err.message}`)
    return null
  }
}

function lint(kind, dir, schema) {
  const entries = readdirSync(dir).filter((e) => !e.startsWith('_') && !e.startsWith('.'))
  for (const entry of entries) {
    const mfPath = join(dir, entry, 'manifest.json')
    if (!existsSync(mfPath)) continue
    const mf = readManifest(mfPath)
    if (!mf) continue
    const errs = validate(mf, schema, `${kind}:${entry}`)
    for (const e of errs) failures.push(`${kind}:${entry} ${e}`)
  }
}

lint('family', FAMILIES_DIR, FAMILY_SCHEMA)
for (const group of readdirSync(LAYERS_DIR)) {
  const groupDir = join(LAYERS_DIR, group)
  lint(`layer.${group}`, groupDir, LAYER_SCHEMA)
}
lint('partner', PARTNERS_DIR, PARTNER_SCHEMA)

// Semantic invariants — cross-manifest.
//
// 1. Keyword overlap across families' tier1. Overlapping tier1 keywords cause
//    the CI regression class we hit post-PR #25 (agent-swarm-ts stealing
//    agent-service-ts prompts). Warn; don't fail outright since some overlap
//    is intentional.
const tier1Index = new Map()
for (const fam of readdirSync(FAMILIES_DIR)) {
  const mfPath = join(FAMILIES_DIR, fam, 'manifest.json')
  if (!existsSync(mfPath)) continue
  const mf = readManifest(mfPath)
  if (!mf?.tieredKeywords?.tier1) continue
  for (const kw of mf.tieredKeywords.tier1) {
    const arr = tier1Index.get(kw) ?? []
    arr.push(fam)
    tier1Index.set(kw, arr)
  }
}
const overlaps = [...tier1Index.entries()].filter(([, fams]) => fams.length > 1)
if (overlaps.length > 0) {
  console.log(`\n⚠ tier1 keyword overlaps across families (routing ambiguity risk):`)
  for (const [kw, fams] of overlaps) {
    console.log(`  "${kw}" → ${fams.join(', ')}`)
  }
}

// 2. Dangling appliesTo — every layer/partner's appliesTo must reference a
//    real family id.
const familyIds = new Set(
  readdirSync(FAMILIES_DIR).filter((e) => !e.startsWith('_') && !e.startsWith('.')),
)
const layerIds = new Set()
for (const group of readdirSync(LAYERS_DIR)) {
  for (const layerId of readdirSync(join(LAYERS_DIR, group))) {
    if (layerId.startsWith('_') || layerId.startsWith('.')) continue
    if (!existsSync(join(LAYERS_DIR, group, layerId, 'manifest.json'))) continue
    layerIds.add(`${group}:${layerId}`)
  }
}

function validateDomainPackSemantic(owner, mf) {
  const pack = mf?.domainPack
  if (!pack) return
  if (!pack.domain?.family) {
    failures.push(`${owner} domainPack.domain.family is required`)
  }
  if (!Array.isArray(pack.provides) || pack.provides.length === 0) {
    failures.push(
      `${owner} domainPack.provides must contain at least one provided capability/toolchain`,
    )
  }
  const authenticityGroupIds = new Set()
  for (const [index, group] of (pack.authenticityGroups ?? []).entries()) {
    if (authenticityGroupIds.has(group.id)) {
      failures.push(`${owner} domainPack.authenticityGroups id "${group.id}" is duplicated`)
    }
    authenticityGroupIds.add(group.id)
    if (!Array.isArray(group.signals) || group.signals.length === 0) {
      failures.push(`${owner} domainPack.authenticityGroups[${index}].signals must not be empty`)
    }
    if ((group.minRequired ?? 1) > (group.signals?.length ?? 0)) {
      failures.push(
        `${owner} domainPack.authenticityGroups[${index}].minRequired cannot exceed signals.length`,
      )
    }
  }
  for (const route of pack.routingPrompts ?? []) {
    if (route.expectedFamily && !familyIds.has(route.expectedFamily)) {
      failures.push(
        `${owner} domainPack.routingPrompts expectedFamily references unknown family "${route.expectedFamily}"`,
      )
    }
    for (const layerId of route.expectedLayers ?? []) {
      if (!layerIds.has(layerId)) {
        failures.push(
          `${owner} domainPack.routingPrompts expectedLayers references unknown layer "${layerId}"`,
        )
      }
    }
  }
}

function validateLayerDomainPackCompatibility(owner, layerManifest) {
  const layerPack = layerManifest?.domainPack
  if (!layerPack || !Array.isArray(layerManifest?.appliesTo)) return

  for (const target of layerManifest.appliesTo) {
    const familyManifest = readManifest(join(FAMILIES_DIR, target, 'manifest.json'))
    const familyPack = familyManifest?.domainPack
    if (!familyPack || familyPack.domain?.family !== layerPack.domain?.family) continue

    for (const field of ['provider', 'protocol', 'runtime', 'surface']) {
      const layerValue = layerPack.domain?.[field]
      const familyValue = familyPack.domain?.[field]
      if (!layerValue || !familyValue || layerValue === familyValue) continue
      failures.push(
        `${owner} domainPack.domain.${field}="${layerValue}" conflicts with family:${target} domainPack.domain.${field}="${familyValue}"`,
      )
    }
  }
}

for (const fam of familyIds) {
  const mfPath = join(FAMILIES_DIR, fam, 'manifest.json')
  if (!existsSync(mfPath)) continue
  validateDomainPackSemantic(`family:${fam}`, readManifest(mfPath))
}
for (const group of readdirSync(LAYERS_DIR)) {
  for (const layerId of readdirSync(join(LAYERS_DIR, group))) {
    const mfPath = join(LAYERS_DIR, group, layerId, 'manifest.json')
    if (!existsSync(mfPath)) continue
    validateDomainPackSemantic(`layer.${group}:${layerId}`, readManifest(mfPath))
  }
}

for (const group of readdirSync(LAYERS_DIR)) {
  for (const layerId of readdirSync(join(LAYERS_DIR, group))) {
    const mfPath = join(LAYERS_DIR, group, layerId, 'manifest.json')
    if (!existsSync(mfPath)) continue
    const mf = readManifest(mfPath)
    validateLayerDomainPackCompatibility(`layer.${group}:${layerId}`, mf)
    if (!Array.isArray(mf?.appliesTo)) continue
    for (const target of mf.appliesTo) {
      if (!familyIds.has(target)) {
        failures.push(`layer.${group}:${layerId} appliesTo references unknown family "${target}"`)
      }
    }
  }
}
for (const partnerId of readdirSync(PARTNERS_DIR)) {
  if (partnerId.startsWith('_') || partnerId.startsWith('.')) continue
  const mfPath = join(PARTNERS_DIR, partnerId, 'manifest.json')
  if (!existsSync(mfPath)) continue
  const mf = readManifest(mfPath)
  if (!Array.isArray(mf?.appliesTo)) continue
  for (const target of mf.appliesTo) {
    if (!familyIds.has(target)) {
      failures.push(`partner:${partnerId} appliesTo references unknown family "${target}"`)
    }
  }
}

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} registry validation failures:`)
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}
console.log(`✓ registry validation passed (${familyIds.size} families)`)
