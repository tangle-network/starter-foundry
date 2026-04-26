#!/usr/bin/env node
// sla-rollup — aggregates daily probe files into one rollup per day + one
// rolling 30-day snapshot that feeds docs/sla/rollup.json (static uptime page).

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROBE_DIR = join(REPO, '.evolve/sla')
const ROLLUP_PATH = join(REPO, 'docs/sla/rollup.json')

if (!existsSync(PROBE_DIR)) {
  console.log('no probes yet — nothing to roll up')
  process.exit(0)
}

const probes = readdirSync(PROBE_DIR)
  .filter((f) => f.startsWith('probe-') && f.endsWith('.json'))
  .map((f) => ({ file: f, body: JSON.parse(readFileSync(join(PROBE_DIR, f), 'utf8')) }))

if (probes.length === 0) {
  console.log('no probes yet')
  process.exit(0)
}

// Group by URL + day.
const byMirrorDay = new Map()
for (const { body } of probes) {
  const day = body.probedAt.slice(0, 10)
  for (const m of body.mirrors) {
    const key = `${m.url}||${day}`
    const bucket = byMirrorDay.get(key) ?? {
      url: m.url,
      region: m.region,
      day,
      total: 0,
      ok: 0,
      p50sum: 0,
      p95sum: 0,
      statuses: {},
    }
    bucket.total++
    if (m.status === 'ok') bucket.ok++
    bucket.p50sum += m.p50Ms ?? 0
    bucket.p95sum += m.p95Ms ?? 0
    bucket.statuses[m.status] = (bucket.statuses[m.status] ?? 0) + 1
    byMirrorDay.set(key, bucket)
  }
}

const rollupRows = [...byMirrorDay.values()].map((b) => ({
  url: b.url,
  region: b.region,
  day: b.day,
  probes: b.total,
  uptime: b.total === 0 ? 0 : b.ok / b.total,
  avgP50Ms: b.total === 0 ? 0 : +(b.p50sum / b.total).toFixed(2),
  avgP95Ms: b.total === 0 ? 0 : +(b.p95sum / b.total).toFixed(2),
  statusBreakdown: b.statuses,
}))

rollupRows.sort((a, b) => (a.day === b.day ? a.url.localeCompare(b.url) : b.day.localeCompare(a.day)))

// Only keep the last 30 days.
const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
const kept = rollupRows.filter((r) => r.day >= cutoff)

mkdirSync(dirname(ROLLUP_PATH), { recursive: true })
writeFileSync(
  ROLLUP_PATH,
  JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      windowDays: 30,
      totalProbes: probes.length,
      rows: kept,
    },
    null,
    2,
  ) + '\n',
)

console.log(`rolled up ${kept.length} (mirror × day) rows → ${ROLLUP_PATH}`)
