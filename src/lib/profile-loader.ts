/**
 * Profile loader — tsconfig-style `extends` inheritance.
 *
 * Profiles live in `.evolve/profiles/<name>.profile.json`. Children inherit
 * from a single parent declared via `extends`. Cycles + depth >5 are
 * rejected. Resolved profiles always carry a pinned `model`
 * (`<alias>@<snapshot>`) sourced from `snapshots.lock.json`.
 *
 * @public
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveSnapshot, SNAPSHOTS_LOCK_PATH } from './snapshot-resolver.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = resolvePath(__dirname, '..', '..')

export const PROFILES_DIR = resolvePath(REPO_ROOT, '.evolve', 'profiles')

export interface RawProfile {
  extends?: string
  logicalModel?: string
  alias?: string
  role?: string
  temperature?: number
  maxTokens?: number
  costCeilingUsd?: number
}

export interface ResolvedProfile {
  /** Profile name (file stem) — e.g. `default-proposer`. */
  name: string
  /** Role tag — e.g. `proposer`, `judge`. Defaults to name when unset. */
  role: string
  /** Logical model name (e.g. `stable-sonnet-4-6`) — declared in the profile chain. */
  logicalModel: string
  /** Pinned `<alias>@<snapshot>` form — resolved through snapshots.lock.json. */
  model: string
  temperature: number
  maxTokens: number
  costCeilingUsd: number
  /** Full extends chain (parent → ... → leaf). */
  chain: string[]
}

const MAX_DEPTH = 5

export interface LoadProfileOptions {
  profilesDir?: string
  lockPath?: string
  /** Skip snapshot resolution. Used by `pnpm profiles list` when lock is empty. */
  skipSnapshotResolve?: boolean
}

const SAFE_NAME = /^[a-z][a-z0-9-]*$/

function profilePath(name: string, profilesDir: string): string {
  if (!SAFE_NAME.test(name)) {
    throw new Error(`invalid profile name "${name}" — must match /^[a-z][a-z0-9-]*$/`)
  }
  return resolvePath(profilesDir, `${name}.profile.json`)
}

function readProfile(name: string, profilesDir: string): RawProfile {
  const p = profilePath(name, profilesDir)
  if (!existsSync(p)) {
    throw new Error(`profile "${name}" not found at ${p}`)
  }
  return JSON.parse(readFileSync(p, 'utf8')) as RawProfile
}

/**
 * Walk the `extends` chain, collecting profiles parent-first. Rejects cycles
 * + chains deeper than MAX_DEPTH.
 */
function buildChain(name: string, profilesDir: string): { chain: string[]; profiles: RawProfile[] } {
  const seen = new Set<string>()
  const chain: string[] = []
  const profiles: RawProfile[] = []
  let cursor: string | undefined = name
  while (cursor !== undefined) {
    if (seen.has(cursor)) {
      throw new Error(`profile cycle detected at "${cursor}" (chain: ${[...seen, cursor].join(' → ')})`)
    }
    seen.add(cursor)
    if (chain.length >= MAX_DEPTH) {
      throw new Error(`profile chain exceeds max depth ${MAX_DEPTH} at "${cursor}"`)
    }
    const p: RawProfile = readProfile(cursor, profilesDir)
    chain.unshift(cursor) // parent-first
    profiles.unshift(p)
    cursor = p.extends
  }
  return { chain, profiles }
}

function mergeChain(profiles: RawProfile[]): RawProfile {
  const out: RawProfile = {}
  for (const p of profiles) {
    if (p.logicalModel !== undefined) out.logicalModel = p.logicalModel
    if (p.alias !== undefined) out.alias = p.alias
    if (p.role !== undefined) out.role = p.role
    if (p.temperature !== undefined) out.temperature = p.temperature
    if (p.maxTokens !== undefined) out.maxTokens = p.maxTokens
    if (p.costCeilingUsd !== undefined) out.costCeilingUsd = p.costCeilingUsd
  }
  return out
}

/**
 * Load + resolve a profile by name. Returns a fully-resolved profile with
 * a pinned `<alias>@<snapshot>` model id. Throws if any required field is
 * missing or the snapshot is unresolved/deprecated.
 */
export function loadProfile(name: string, opts: LoadProfileOptions = {}): ResolvedProfile {
  const profilesDir = opts.profilesDir ?? PROFILES_DIR
  const { chain, profiles } = buildChain(name, profilesDir)
  const merged = mergeChain(profiles)

  if (!merged.logicalModel) {
    throw new Error(`profile "${name}" (chain: ${chain.join(' → ')}) does not declare logicalModel`)
  }
  if (!merged.alias) {
    throw new Error(`profile "${name}" (chain: ${chain.join(' → ')}) does not declare alias`)
  }
  if (merged.temperature === undefined) {
    throw new Error(`profile "${name}" missing temperature`)
  }
  if (merged.maxTokens === undefined) {
    throw new Error(`profile "${name}" missing maxTokens`)
  }
  if (merged.costCeilingUsd === undefined) {
    throw new Error(`profile "${name}" missing costCeilingUsd`)
  }

  let model: string
  if (opts.skipSnapshotResolve) {
    model = `${merged.alias}@unresolved`
  } else {
    model = resolveSnapshot(merged.logicalModel, opts.lockPath ?? SNAPSHOTS_LOCK_PATH)
  }

  return {
    name,
    role: merged.role ?? name,
    logicalModel: merged.logicalModel,
    model,
    temperature: merged.temperature,
    maxTokens: merged.maxTokens,
    costCeilingUsd: merged.costCeilingUsd,
    chain,
  }
}

/** List profile names available in `.evolve/profiles/`. */
export function listProfileNames(profilesDir: string = PROFILES_DIR): string[] {
  if (!existsSync(profilesDir)) return []
  return readdirSync(profilesDir)
    .filter((f) => f.endsWith('.profile.json'))
    .map((f) => f.replace(/\.profile\.json$/, ''))
    .sort()
}

export interface ProfileDiff {
  field: string
  a: unknown
  b: unknown
}

/** Diff two resolved profiles. Returns the field deltas. */
export function diffProfiles(a: ResolvedProfile, b: ResolvedProfile): ProfileDiff[] {
  const fields: (keyof ResolvedProfile)[] = [
    'role',
    'logicalModel',
    'model',
    'temperature',
    'maxTokens',
    'costCeilingUsd',
  ]
  const out: ProfileDiff[] = []
  for (const f of fields) {
    if (a[f] !== b[f]) out.push({ field: f, a: a[f], b: b[f] })
  }
  return out
}
