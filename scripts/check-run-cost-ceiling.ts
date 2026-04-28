#!/usr/bin/env node
/**
 * CI invariant: no run in `.evolve/runs.jsonl` may exceed the cost ceiling
 * declared by its role profile. Catches accidental million-dollar runs.
 *
 * The role mapping uses the `experimentId` first segment as the role hint
 * (`audit`, `proposer`, `judge`, `family-author`, `capability-author`).
 * Records that don't map default to the `default` profile.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'

import { loadProfile } from '../src/lib/profile-loader.js'

const path = process.argv[2] ?? resolvePath(process.cwd(), '.evolve', 'runs.jsonl')

if (!existsSync(path)) {
  console.log(`check-run-cost-ceiling: ${path} not found — nothing to check`)
  process.exit(0)
}

const PROFILE_HINTS: Record<string, string> = {
  audit: 'default',
  proposer: 'default-proposer',
  judge: 'default-judge',
  'family-author': 'family-author',
  'capability-author': 'capability-author',
}

function profileNameFor(experimentId: string): string {
  const head = experimentId.split('/')[0]
  return PROFILE_HINTS[head] ?? 'default'
}

const ceilingsCache: Record<string, number> = {}
function ceilingFor(profileName: string): number {
  if (profileName in ceilingsCache) return ceilingsCache[profileName]
  const profile = loadProfile(profileName, { skipSnapshotResolve: true })
  ceilingsCache[profileName] = profile.costCeilingUsd
  return profile.costCeilingUsd
}

const lines = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim().length > 0)
const violations: Array<{ line: number; runId: string; profile: string; ceiling: number; cost: number }> = []

for (let i = 0; i < lines.length; i += 1) {
  let record: { runId?: string; experimentId?: string; costUsd?: number }
  try {
    record = JSON.parse(lines[i])
  } catch (e) {
    console.error(`check-run-cost-ceiling: line ${i + 1} not valid JSON: ${(e as Error).message}`)
    process.exit(1)
  }
  const cost = typeof record.costUsd === 'number' ? record.costUsd : 0
  const profile = profileNameFor(record.experimentId ?? 'default')
  const ceiling = ceilingFor(profile)
  if (cost > ceiling) {
    violations.push({ line: i + 1, runId: record.runId ?? '?', profile, ceiling, cost })
  }
}

if (violations.length > 0) {
  console.error(`check-run-cost-ceiling: ${violations.length} cost-ceiling violation(s) in ${path}:`)
  for (const v of violations) {
    console.error(`  line ${v.line} runId=${v.runId} profile=${v.profile} cost=$${v.cost.toFixed(4)} > ceiling $${v.ceiling.toFixed(2)}`)
  }
  process.exit(1)
}

console.log(`check-run-cost-ceiling: ${lines.length} record(s) within ceiling`)
