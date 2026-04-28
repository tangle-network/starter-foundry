/**
 * Snapshot resolver — `pnpm-lock.yaml`-equivalent for model snapshots.
 *
 * `.evolve/snapshots.lock.json` is the source of truth. Profiles declare
 * logical names (e.g. `stable-sonnet-4-6`), the lock pins them to dated
 * snapshots (e.g. `claude-sonnet-4-5-20250929`). `--apply` calls the live
 * Anthropic models API; `--check` verifies pins are still valid.
 *
 * @public
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

import { TCloudClient } from '@tangle-network/tcloud'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Repo root resolved relative to this file's compiled location. */
const REPO_ROOT = resolvePath(__dirname, '..', '..')

export const SNAPSHOTS_LOCK_PATH = resolvePath(REPO_ROOT, '.evolve', 'snapshots.lock.json')

export interface SnapshotEntry {
  /** Logical name profiles declare (e.g. `stable-sonnet-4-6`). */
  logicalName: string
  /** Pinned snapshot id (e.g. `claude-sonnet-4-5-20250929`). */
  snapshot: string
  /** Bare alias used to query the API (e.g. `claude-sonnet-4-6`). */
  alias: string
  /** Timestamp when the API last confirmed this snapshot was current. */
  resolvedAt: string
  /** ISO date the snapshot is announced to deprecate; null if not flagged. */
  deprecatesAt: string | null
}

export interface SnapshotsLock {
  lockfileVersion: 1
  generatedAt: string | null
  responseHash: string | null
  roles: Record<string, SnapshotEntry>
}

export interface RefreshOptions {
  check?: boolean
  apply?: boolean
  /** Override fetch — test seam. Returns the JSON the Anthropic models API would. */
  fetcher?: () => Promise<AnthropicModelsResponse>
  /** Override now() — test seam. */
  now?: () => Date
  /** Override the lock path — test seam. Defaults to `.evolve/snapshots.lock.json`. */
  lockPath?: string
}

export interface RefreshReportEntry {
  logicalName: string
  alias: string
  oldSnapshot: string | null
  newSnapshot: string | null
  status: 'unchanged' | 'updated' | 'deprecated' | 'gone' | 'added'
  deprecatesAt: string | null
  daysUntilDeprecation: number | null
}

export interface RefreshReport {
  mode: 'check' | 'apply'
  ok: boolean
  entries: RefreshReportEntry[]
  warnings: string[]
  errors: string[]
  responseHash: string | null
}

export interface AnthropicModelEntry {
  id: string
  display_name?: string
  created_at?: string
  /** Optional provider-specific deprecation flag (we treat any presence as advisory). */
  deprecation?: { date?: string }
}

export interface AnthropicModelsResponse {
  data: AnthropicModelEntry[]
  has_more?: boolean
}

const DEPRECATION_WARN_DAYS = 30

let cachedLock: SnapshotsLock | null = null
let cachedLockPath: string | null = null

function readLock(lockPath: string = SNAPSHOTS_LOCK_PATH): SnapshotsLock {
  if (cachedLock !== null && cachedLockPath === lockPath) return cachedLock
  const raw = readFileSync(lockPath, 'utf8')
  const parsed = JSON.parse(raw) as SnapshotsLock
  if (parsed.lockfileVersion !== 1) {
    throw new Error(`unsupported snapshots.lock.json lockfileVersion: ${parsed.lockfileVersion}`)
  }
  cachedLock = parsed
  cachedLockPath = lockPath
  return parsed
}

function writeLock(lock: SnapshotsLock, lockPath: string = SNAPSHOTS_LOCK_PATH): void {
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8')
  cachedLock = lock
  cachedLockPath = lockPath
}

/** Reset cache. Test-only. */
export function _resetSnapshotCache(): void {
  cachedLock = null
  cachedLockPath = null
}

/**
 * Resolve a logical role name to its pinned `<alias>@<snapshot>` form.
 * Throws if the role is not in the lock or its snapshot is past deprecation.
 */
export function resolveSnapshot(role: string, lockPath: string = SNAPSHOTS_LOCK_PATH): string {
  const lock = readLock(lockPath)
  const entry = lock.roles[role]
  if (!entry) {
    throw new Error(
      `snapshots.lock.json does not pin role "${role}". Run \`pnpm refresh-snapshots --apply\` to populate.`,
    )
  }
  if (entry.deprecatesAt !== null) {
    const days = daysUntil(entry.deprecatesAt)
    if (days !== null && days < 0) {
      throw new Error(
        `role "${role}" pin "${entry.snapshot}" deprecated ${Math.abs(days)} days ago. Refresh required.`,
      )
    }
  }
  return `${entry.alias}@${entry.snapshot}`
}

export function listKnownSnapshots(lockPath: string = SNAPSHOTS_LOCK_PATH): SnapshotEntry[] {
  return Object.values(readLock(lockPath).roles)
}

function daysUntil(isoDate: string): number | null {
  const t = Date.parse(isoDate)
  if (!Number.isFinite(t)) return null
  return Math.round((t - Date.now()) / (1000 * 60 * 60 * 24))
}

/**
 * Default fetcher — Tangle router model list via TCloud SDK. Single source
 * of truth for snapshot ids; the CLI bridge is a router feature (rewrites
 * `model` to `bridge/<harness>/<model>`) used for runtime *chat* calls,
 * not for model-list discovery — listing always comes from the router's
 * catalog. Profiles select bridge routing per-call via `BridgeOptions`,
 * not via a separate fetcher.
 *
 * No direct-Anthropic path: bypassing the org's billing meter is not an
 * option (memory: `billing-architecture-one-meter`).
 */
async function defaultFetcher(): Promise<AnthropicModelsResponse> {
  const apiKey = process.env.TANGLE_API_KEY
  if (!apiKey) {
    throw new Error(
      'TANGLE_API_KEY required for `pnpm refresh-snapshots --apply`. ' +
        'Listing flows through TCloud SDK against router.tangle.tools (canonical ' +
        'billing meter). See `docs/cookbooks/run-records-and-gates.md`.',
    )
  }
  const client = new TCloudClient({ apiKey })
  const models = await client.models()
  return {
    data: models.map((m) => ({ id: m.id, display_name: m.name })),
  }
}

function hashResponse(response: AnthropicModelsResponse): string {
  // Sort by id for stability across runs (API order is not guaranteed).
  const ids = response.data.map((m) => m.id).sort()
  return createHash('sha256').update(ids.join('\n')).digest('hex')
}

/**
 * Resolve a logical role's alias to its newest matching snapshot id from
 * the API response. Strategy: pick the model whose id starts with the alias
 * stem (e.g. `claude-sonnet-4-`) and has the latest date suffix.
 */
function pickSnapshot(
  alias: string,
  response: AnthropicModelsResponse,
): AnthropicModelEntry | null {
  // Stem = alias minus a trailing version number suffix. We look for ids
  // that start with the alias stem and contain a YYYYMMDD suffix.
  const aliasStem = alias.replace(/-\d+(-\d+)?$/, '')
  const candidates = response.data
    .filter((m) => m.id.startsWith(aliasStem))
    .map((m) => ({ entry: m, date: extractDate(m.id) }))
    .filter((m) => m.date !== null)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  if (candidates.length === 0) return null
  return candidates[0].entry
}

const DATE_SUFFIX_RE = /(\d{8})$/
function extractDate(id: string): string | null {
  const match = DATE_SUFFIX_RE.exec(id)
  return match ? match[1] : null
}

/**
 * Refresh the snapshots lock against the live (or injected) API.
 *
 * - `--check` — read lock + verify every pin is still in the API response;
 *   warn within DEPRECATION_WARN_DAYS, error past deprecation. Does NOT
 *   write the lock.
 * - `--apply` — overwrite the lock with the resolved snapshots. Operator-only.
 */
export async function refreshSnapshots(opts: RefreshOptions): Promise<RefreshReport> {
  const lockPath = opts.lockPath ?? SNAPSHOTS_LOCK_PATH
  const fetcher = opts.fetcher ?? defaultFetcher
  const now = opts.now?.() ?? new Date()
  const lock = readLock(lockPath)
  const response = await fetcher()
  const responseHash = hashResponse(response)

  const entries: RefreshReportEntry[] = []
  const warnings: string[] = []
  const errors: string[] = []

  for (const [logicalName, entry] of Object.entries(lock.roles)) {
    const picked = pickSnapshot(entry.alias, response)
    if (picked === null) {
      const e: RefreshReportEntry = {
        logicalName,
        alias: entry.alias,
        oldSnapshot: entry.snapshot,
        newSnapshot: null,
        status: 'gone',
        deprecatesAt: entry.deprecatesAt,
        daysUntilDeprecation: entry.deprecatesAt ? daysUntil(entry.deprecatesAt) : null,
      }
      entries.push(e)
      errors.push(
        `role "${logicalName}": no current snapshot for alias "${entry.alias}" — refresh required`,
      )
      continue
    }
    const newSnapshot = picked.id
    const deprecatesAt = picked.deprecation?.date ?? null
    const days = deprecatesAt ? daysUntil(deprecatesAt) : null
    const status = newSnapshot === entry.snapshot ? 'unchanged' : 'updated'
    if (days !== null && days < 0) {
      errors.push(
        `role "${logicalName}": pinned snapshot "${entry.snapshot}" deprecated ${Math.abs(days)} days ago`,
      )
    } else if (days !== null && days < DEPRECATION_WARN_DAYS) {
      warnings.push(
        `role "${logicalName}": pinned snapshot "${entry.snapshot}" deprecates in ${days} days`,
      )
    }
    entries.push({
      logicalName,
      alias: entry.alias,
      oldSnapshot: entry.snapshot,
      newSnapshot,
      status,
      deprecatesAt,
      daysUntilDeprecation: days,
    })
  }

  const ok = errors.length === 0

  if (opts.apply && ok) {
    const newLock: SnapshotsLock = {
      lockfileVersion: 1,
      generatedAt: now.toISOString(),
      responseHash,
      roles: { ...lock.roles },
    }
    for (const entry of entries) {
      if (entry.newSnapshot !== null) {
        newLock.roles[entry.logicalName] = {
          logicalName: entry.logicalName,
          alias: entry.alias,
          snapshot: entry.newSnapshot,
          resolvedAt: now.toISOString(),
          deprecatesAt: entry.deprecatesAt,
        }
      }
    }
    writeLock(newLock, lockPath)
  }

  return {
    mode: opts.apply ? 'apply' : 'check',
    ok,
    entries,
    warnings,
    errors,
    responseHash,
  }
}

/**
 * Initialise the lock with one or more roles before the first `--apply`.
 * Used by the cookbook walkthrough so operators don't hand-edit JSON.
 */
export function seedRoles(
  roles: { logicalName: string; alias: string }[],
  lockPath: string = SNAPSHOTS_LOCK_PATH,
): void {
  const lock = readLock(lockPath)
  for (const role of roles) {
    if (!lock.roles[role.logicalName]) {
      lock.roles[role.logicalName] = {
        logicalName: role.logicalName,
        alias: role.alias,
        snapshot: 'unresolved',
        resolvedAt: 'never',
        deprecatesAt: null,
      }
    }
  }
  writeLock(lock, lockPath)
}
