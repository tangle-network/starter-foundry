// Branded ID types — compile-time guards against mixing FamilyId / LayerId /
// PartnerId / SurfaceId / LanguageId / CapabilityId. Each brand is a string
// at runtime but nominally distinct in the type system, so a typo or a
// misplaced parameter (passing a `LayerId` where a `FamilyId` is expected)
// surfaces as a compile error rather than a runtime "unknown family X".
//
// Usage:
//   import { type FamilyId, FamilyId as familyIdOf } from './types/ids.js'
//   const id: FamilyId = familyIdOf('my-family')   // validates + brands
//   registry.families.get(id)                       // type-safe
//
// The constructor functions validate format (kebab-case, no spaces, etc.).
// Use `unsafe<Type>(s)` when you have a string from a trusted source (e.g.
// a manifest already validated by the schema) and want to skip re-validation.

declare const FamilyIdBrand: unique symbol
declare const LayerIdBrand: unique symbol
declare const PartnerIdBrand: unique symbol
declare const SurfaceIdBrand: unique symbol
declare const LanguageIdBrand: unique symbol
declare const CapabilityIdBrand: unique symbol
declare const RuntimeIdBrand: unique symbol

export type FamilyId = string & { readonly [FamilyIdBrand]: never }
export type LayerId = string & { readonly [LayerIdBrand]: never }
export type PartnerId = string & { readonly [PartnerIdBrand]: never }
export type SurfaceId = string & { readonly [SurfaceIdBrand]: never }
export type LanguageId = string & { readonly [LanguageIdBrand]: never }
export type CapabilityId = string & { readonly [CapabilityIdBrand]: never }
export type RuntimeId = string & { readonly [RuntimeIdBrand]: never }

// Format constraints derived from the registry schemas:
//   family.schema.json:  "pattern": "^[a-z][a-z0-9-]*$"
//   layer.schema.json:   "pattern": "^[a-z][a-z0-9-]*$"
//   partner.schema.json: "pattern": "^[a-z][a-z0-9-]*$"
// LayerId additionally allows `<group>:<id>` form for fully-qualified refs.
const KEBAB_RE = /^[a-z][a-z0-9-]*$/
const QUALIFIED_LAYER_RE = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/

function assertKebab(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string, got ${typeof value}`)
  }
  if (!KEBAB_RE.test(value)) {
    throw new TypeError(`${label} must match ${KEBAB_RE.source}, got "${value}"`)
  }
}

function assertLayerIdShape(value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`LayerId must be a string, got ${typeof value}`)
  }
  if (!KEBAB_RE.test(value) && !QUALIFIED_LAYER_RE.test(value)) {
    throw new TypeError(`LayerId must be kebab-case or "group:id", got "${value}"`)
  }
}

// ── Validating constructors — use at trust boundaries (user input, JSON parse). ──

export function familyId(value: string): FamilyId {
  assertKebab(value, 'FamilyId')
  return value as FamilyId
}

export function layerId(value: string): LayerId {
  assertLayerIdShape(value)
  return value as LayerId
}

export function partnerId(value: string): PartnerId {
  assertKebab(value, 'PartnerId')
  return value as PartnerId
}

export function surfaceId(value: string): SurfaceId {
  assertKebab(value, 'SurfaceId')
  return value as SurfaceId
}

export function languageId(value: string): LanguageId {
  assertKebab(value, 'LanguageId')
  return value as LanguageId
}

export function capabilityId(value: string): CapabilityId {
  assertKebab(value, 'CapabilityId')
  return value as CapabilityId
}

export function runtimeId(value: string): RuntimeId {
  assertKebab(value, 'RuntimeId')
  return value as RuntimeId
}

// ── Unsafe coercion — for strings already validated upstream (manifest loader). ──
// Skip the regex check; brand only. Use sparingly — every unsafe call is a
// trust assertion that the string is well-formed.

export const unsafeFamilyId = (value: string): FamilyId => value as FamilyId
export const unsafeLayerId = (value: string): LayerId => value as LayerId
export const unsafePartnerId = (value: string): PartnerId => value as PartnerId
export const unsafeSurfaceId = (value: string): SurfaceId => value as SurfaceId
export const unsafeLanguageId = (value: string): LanguageId => value as LanguageId
export const unsafeCapabilityId = (value: string): CapabilityId => value as CapabilityId
export const unsafeRuntimeId = (value: string): RuntimeId => value as RuntimeId

// ── Type guards — narrow at runtime when you can't trust the source. ──

export function isFamilyId(value: unknown): value is FamilyId {
  return typeof value === 'string' && KEBAB_RE.test(value)
}

export function isLayerId(value: unknown): value is LayerId {
  return typeof value === 'string' && (KEBAB_RE.test(value) || QUALIFIED_LAYER_RE.test(value))
}

export function isPartnerId(value: unknown): value is PartnerId {
  return typeof value === 'string' && KEBAB_RE.test(value)
}
