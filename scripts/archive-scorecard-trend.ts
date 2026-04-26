#!/usr/bin/env node
// Per-scenario trend archive. Rolls daily scorecard snapshots into a
// single .evolve/trends/trend.jsonl — one entry per flow per day.
// Downstream: a trend-viewer consumer (or just `jq`) charts week-over-week.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, appendFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DAILY_DIR = join(REPO, '.evolve/daily')
const OUT = join(REPO, '.evolve/trends/trend.jsonl')

if (!existsSync(DAILY_DIR)) {
  console.log('no .evolve/daily yet — nightly workflow produces these. Nothing to aggregate.')
  process.exit(0)
}

mkdirSync(dirname(OUT), { recursive: true })
const seen = existsSync(OUT)
  ? new Set(readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map((l) => {
      try { const e = JSON.parse(l); return `${e.date}:${e.flow}` } catch { return '' }
    }))
  : new Set()

let added = 0
for (const f of readdirSync(DAILY_DIR)) {
  if (!f.startsWith('scorecard-') || !f.endsWith('.json')) continue
  const date = f.slice('scorecard-'.length, -'.json'.length)
  const sc = JSON.parse(readFileSync(join(DAILY_DIR, f), 'utf8'))
  for (const flow of sc.flows ?? []) {
    const key = `${date}:${flow.name}`
    if (seen.has(key)) continue
    appendFileSync(OUT, JSON.stringify({
      date,
      flow: flow.name,
      value: flow.value,
      target: flow.target,
      status: flow.status,
      direction: flow.direction,
    }) + '\n')
    added++
  }
}

console.log(`✓ scorecard trend: +${added} data points → ${OUT}`)
