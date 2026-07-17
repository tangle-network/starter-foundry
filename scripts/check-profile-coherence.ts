#!/usr/bin/env node
/**
 * CI invariant: every profile's `logicalModel` must resolve in
 * `snapshots.lock.json` (or the lock must be empty — pre-`--apply` state).
 * Catches drift where a profile names a logical model the lock no longer
 * pins.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'

import { listProfileNames, loadProfile, PROFILES_DIR } from '../src/lib/profile-loader.js'
import { SNAPSHOTS_LOCK_PATH } from '../src/lib/snapshot-resolver.js'

const lockPath = process.argv[2] ?? SNAPSHOTS_LOCK_PATH
const profilesDir = process.argv[3] ?? PROFILES_DIR

if (!existsSync(lockPath)) {
  console.error(`check-profile-coherence: lock file missing: ${lockPath}`)
  process.exit(1)
}

const lockRaw = JSON.parse(readFileSync(lockPath, 'utf8')) as { roles?: Record<string, unknown> }
const lockEmpty = !lockRaw.roles || Object.keys(lockRaw.roles).length === 0

const names = listProfileNames(profilesDir)
if (names.length === 0) {
  console.error(`check-profile-coherence: no profiles found in ${profilesDir}`)
  process.exit(1)
}

const violations: Array<{ profile: string; reason: string }> = []

for (const name of names) {
  try {
    if (lockEmpty) {
      // Lock is empty — fall back to skipSnapshotResolve so we still
      // exercise the merge path.
      loadProfile(name, { skipSnapshotResolve: true, profilesDir })
    } else {
      loadProfile(name, { lockPath, profilesDir })
    }
  } catch (e) {
    violations.push({ profile: name, reason: (e as Error).message })
  }
}

if (violations.length > 0) {
  console.error(`check-profile-coherence: ${violations.length} profile(s) failed to resolve:`)
  for (const v of violations) console.error(`  - ${v.profile}: ${v.reason}`)
  process.exit(1)
}

const stateNote = lockEmpty ? ' (lock empty — checked merge path only)' : ''
console.log(`check-profile-coherence: ${names.length} profile(s) resolve cleanly${stateNote}`)
