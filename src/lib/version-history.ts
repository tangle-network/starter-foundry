// version-history — reads .evolve/rollbacks.jsonl, exposes queries consumers
// use to avoid pinning rolled-back versions.

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ROLLBACK_LOG = join(REPO, '.evolve/rollbacks.jsonl')

export interface RollbackRecord {
  schemaVersion: 1
  loggedAt: string
  fromVersion: string
  toTag: string
  newVersion: string
  reason: string
  dryRun?: boolean
  actor?: string
}

function readRollbacks(): RollbackRecord[] {
  if (!existsSync(ROLLBACK_LOG)) return []
  return readFileSync(ROLLBACK_LOG, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => {
      try {
        return JSON.parse(l) as RollbackRecord
      } catch {
        return null
      }
    })
    .filter((r): r is RollbackRecord => r !== null && !r.dryRun)
}

/** Version that was rolled back AWAY from — consumers should avoid pinning this. */
export function isVersionRolledBack(version: string): boolean {
  return readRollbacks().some((r) => r.fromVersion === version)
}

/** Returns the latest version we've seen a successful rollback to (or null). */
export function getLastKnownGoodVersion(): string | null {
  const rollbacks = readRollbacks()
  if (rollbacks.length === 0) return null
  // `toTag` is the version rolled to; strip the leading "v" if present.
  const last = rollbacks[rollbacks.length - 1]
  return last.toTag.replace(/^v/, '')
}

export function listRollbacks(): RollbackRecord[] {
  return readRollbacks()
}
