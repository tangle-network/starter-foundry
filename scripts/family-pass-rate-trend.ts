#!/usr/bin/env node
// family-pass-rate-trend — produces a weekly pass-rate trend per family,
// derived from .evolve/traces/buildouts.jsonl joined against
// corpus/template-family-mapping.json. Output:
//
//   .evolve/traces/family-pass-rate-trend.jsonl
//   { family, isoWeek, totalBuildouts, passes, passRate }
//
// Feeds Branch 2.4: the template judge can read the latest trend per family
// to weight its decisions toward templates that historically correlate with
// higher downstream pass rates.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TRACES = join(REPO, '.evolve/traces/buildouts.jsonl')
const MAPPING = join(REPO, 'corpus/template-family-mapping.json')
const OUT = join(REPO, '.evolve/traces/family-pass-rate-trend.jsonl')

if (!existsSync(TRACES)) {
  console.error('✗ no buildouts.jsonl — nothing to aggregate')
  process.exit(0)
}

const mapping = existsSync(MAPPING) ? JSON.parse(readFileSync(MAPPING, 'utf8')) : {}

function isoWeek(ts) {
  const d = new Date(ts)
  // ISO week: Thursday-rooted week number.
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((target - yearStart) / 86400000 + 1) / 7)
  return `${target.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

// Aggregate per (family, week).
const stats = new Map()

for (const line of readFileSync(TRACES, 'utf8').split('\n')) {
  if (!line.trim()) continue
  let event
  try {
    event = JSON.parse(line)
  } catch {
    continue
  }
  const sid = event.scenarioId
  if (!sid) continue
  const family = mapping[sid]
  if (!family) continue // scenarios not in the mapping are skipped (e.g. synthetic / untagged)
  const ts = event.firstTs ? Date.parse(event.firstTs) : null
  if (!ts) continue
  const week = isoWeek(ts)
  const outcome = event.outcome ?? {}
  const passed = outcome.allPass === true
  const key = `${family}||${week}`
  const cur = stats.get(key) ?? { family, isoWeek: week, totalBuildouts: 0, passes: 0 }
  cur.totalBuildouts++
  if (passed) cur.passes++
  stats.set(key, cur)
}

mkdirSync(dirname(OUT), { recursive: true })
const rows = [...stats.values()]
  .map((s) => ({ ...s, passRate: s.totalBuildouts === 0 ? 0 : s.passes / s.totalBuildouts }))
  .sort((a, b) =>
    a.family === b.family ? a.isoWeek.localeCompare(b.isoWeek) : a.family.localeCompare(b.family),
  )

writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length > 0 ? '\n' : ''))

console.log(`\n=== family-pass-rate-trend ===`)
console.log(`rows: ${rows.length}`)
const byFamily = new Map()
for (const r of rows) byFamily.set(r.family, (byFamily.get(r.family) ?? 0) + r.totalBuildouts)
const topFamilies = [...byFamily.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
console.log(`top families by buildout volume:`)
for (const [f, n] of topFamilies) {
  const weeklyRates = rows.filter((r) => r.family === f).map((r) => r.passRate)
  const avg = weeklyRates.length ? weeklyRates.reduce((a, b) => a + b, 0) / weeklyRates.length : 0
  console.log(
    `  ${f.padEnd(24)} ${n} buildouts  avg passRate: ${(avg * 100).toFixed(0)}%  weeks: ${weeklyRates.length}`,
  )
}
console.log(`\noutput → ${OUT}`)
