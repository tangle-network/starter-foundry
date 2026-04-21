#!/usr/bin/env node
// sla-probe — probes every registered mirror, records availability, p95
// latency, integrity SHA per mirror. Output: .evolve/sla/probe-<ts>.json.
// Runs every 15 min via cron; scripts/sla-rollup.mjs aggregates dailies.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MIRRORS_PATH = join(REPO, 'registry/_mirrors.json')
const OUT_DIR = join(REPO, '.evolve/sla')

if (!existsSync(MIRRORS_PATH)) {
  console.error('✗ registry/_mirrors.json missing')
  process.exit(2)
}
const mirrors = JSON.parse(readFileSync(MIRRORS_PATH, 'utf8')).mirrors ?? []

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

async function probe(mirror, reps = 3) {
  const latencies = []
  let status = 'ok'
  let integritySha = null
  let lastDetail = ''

  for (let i = 0; i < reps; i++) {
    const start = performance.now()
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 5000)
      const res = await fetch(mirror.url, { signal: ctrl.signal })
      clearTimeout(timer)
      const latency = performance.now() - start
      latencies.push(latency)
      if (!res.ok) {
        status = 'error'
        lastDetail = `http ${res.status}`
        continue
      }
      const body = await res.text()
      integritySha = sha256Hex(body)
    } catch (err) {
      latencies.push(performance.now() - start)
      status = err.name === 'AbortError' ? 'timeout' : 'error'
      lastDetail = err.message?.slice(0, 200) ?? ''
    }
  }

  latencies.sort((a, b) => a - b)
  const p50 = latencies[Math.floor(latencies.length / 2)] ?? 0
  const p95Idx = Math.max(0, Math.floor(latencies.length * 0.95) - 1)
  const p95 = latencies[p95Idx] ?? 0

  return {
    url: mirror.url,
    region: mirror.region ?? 'unknown',
    priority: mirror.priority ?? 100,
    status,
    detail: lastDetail,
    reps,
    p50Ms: +p50.toFixed(2),
    p95Ms: +p95.toFixed(2),
    integritySha,
    probedAt: new Date().toISOString(),
  }
}

const results = []
for (const m of mirrors) results.push(await probe(m))

// Flag integrity mismatch — if any mirror's SHA differs from the others, surface it.
const shas = new Set(results.filter((r) => r.integritySha).map((r) => r.integritySha))
const integrityUnanimous = shas.size <= 1

mkdirSync(OUT_DIR, { recursive: true })
const out = join(OUT_DIR, `probe-${Date.now()}.json`)
writeFileSync(
  out,
  JSON.stringify(
    {
      schemaVersion: 1,
      probedAt: new Date().toISOString(),
      integrityUnanimous,
      distinctShaCount: shas.size,
      mirrors: results,
    },
    null,
    2,
  ) + '\n',
)

console.log(`probed ${results.length} mirrors → ${out}`)
for (const r of results) {
  console.log(`  ${r.status.padEnd(8)} p50=${r.p50Ms.toFixed(0).padStart(5)}ms p95=${r.p95Ms.toFixed(0).padStart(5)}ms  ${r.url}`)
}
if (!integrityUnanimous) {
  console.error(`⚠ integrity mismatch: ${shas.size} distinct SHAs across mirrors`)
  process.exit(1)
}
