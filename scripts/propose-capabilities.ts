#!/usr/bin/env node
// Capability-proposal loop: finds clusters of agent installs with no
// mapping in registry/package-to-capability.json and proposes a new
// capability layer for each cluster (package groups that consistently
// co-occur on failing or slow scaffolds).
//
// Writes proposals to .evolve/proposals/capabilities/<name>.json. Human
// reviews + `pnpm new:capability` promotes the winners.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(REPO, '.evolve/proposals/capabilities')

const buildoutsPath = join(REPO, '.evolve/traces/buildouts.jsonl')
if (!existsSync(buildoutsPath)) {
  console.error('no buildouts.jsonl — run run-buildout-pipeline first')
  process.exit(2)
}
const capMap = JSON.parse(
  readFileSync(join(REPO, 'registry/package-to-capability.json'), 'utf8'),
).mapping

const events = readFileSync(buildoutsPath, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    try {
      return JSON.parse(l)
    } catch {
      return null
    }
  })
  .filter(Boolean)

// Find installed packages that have NO capability mapping (unmapped).
const unmappedCooccurrence = new Map() // packageName → { count, scenarios, failedOn }
for (const e of events) {
  for (const pkg of e.addedPackages ?? []) {
    const name = typeof pkg === 'string' ? pkg : pkg?.name
    if (!name) continue
    if (capMap[name]?.capability !== undefined && capMap[name]?.capability !== null) continue
    let agg = unmappedCooccurrence.get(name)
    if (!agg) {
      agg = { count: 0, scenarios: new Set(), failedOn: 0, cooccursWith: new Map() }
      unmappedCooccurrence.set(name, agg)
    }
    agg.count++
    if (e.scenarioId) agg.scenarios.add(e.scenarioId)
    if (e.outcome && e.outcome.allPass === false) agg.failedOn++
    for (const other of e.addedPackages ?? []) {
      const otherName = typeof other === 'string' ? other : other?.name
      if (!otherName || otherName === name) continue
      agg.cooccursWith.set(otherName, (agg.cooccursWith.get(otherName) ?? 0) + 1)
    }
  }
}

// Promote unmapped packages that appear ≥3 times into a proposal.
mkdirSync(OUT_DIR, { recursive: true })
const proposals = []
for (const [pkg, agg] of unmappedCooccurrence) {
  if (agg.count < 3) continue
  const cooc = [...agg.cooccursWith.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([n, c]) => ({ name: n, count: c }))
  const proposalId =
    pkg
      .replace(/[^a-z0-9-]/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'proposal'
  const proposal = {
    proposedCapabilityId: `unmapped-${proposalId}`,
    triggerPackage: pkg,
    timesInstalled: agg.count,
    scenarios: [...agg.scenarios],
    failureRate: agg.count > 0 ? agg.failedOn / agg.count : 0,
    topCoinstalls: cooc,
    suggestedAppliesTo: [],
    generatedAt: new Date().toISOString(),
  }
  writeFileSync(
    join(OUT_DIR, `${proposal.proposedCapabilityId}.json`),
    JSON.stringify(proposal, null, 2),
  )
  proposals.push(proposal)
}

console.log(`✓ emitted ${proposals.length} capability proposals → ${OUT_DIR}`)
for (const p of proposals.slice(0, 10)) {
  console.log(
    `  ${p.triggerPackage.padEnd(32)} ${String(p.timesInstalled).padStart(3)}× across ${p.scenarios.length} scenarios (fail rate ${(p.failureRate * 100).toFixed(0)}%)`,
  )
}
