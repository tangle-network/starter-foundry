#!/usr/bin/env node
// Partner-config refresh loop. For each partner, check its config.json
// against a freshness policy (max age 90 days). Emit a "stale" list to
// .evolve/proposals/partner-refresh.json so a human + LLM (next phase)
// can re-read the partner's docs and propose updates.
//
// Today: detects stale configs. Next phase: LLM reads partner docs page
// + proposes diff.

import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PARTNERS_DIR = join(REPO, 'registry/partners')
const OUT = join(REPO, '.evolve/proposals/partner-refresh.json')

const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000  // 90 days

const stale = []
for (const id of readdirSync(PARTNERS_DIR)) {
  if (id.startsWith('_') || id.startsWith('.')) continue
  const filesDir = join(PARTNERS_DIR, id, 'files')
  if (!existsSync(filesDir)) continue
  for (const f of readdirSync(filesDir)) {
    if (!f.endsWith('.json')) continue
    const abs = join(filesDir, f)
    const mtime = statSync(abs).mtime.getTime()
    const ageMs = Date.now() - mtime
    if (ageMs > MAX_AGE_MS) {
      const config = JSON.parse(readFileSync(abs, 'utf8'))
      stale.push({
        partnerId: id,
        configPath: `registry/partners/${id}/files/${f}`,
        ageMs,
        ageDays: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
        docsUrl: config.docs ?? null,
      })
    }
  }
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), staleCount: stale.length, stale }, null, 2))

console.log(`✓ partner-refresh proposal: ${stale.length} config(s) beyond ${Math.floor(MAX_AGE_MS / (24 * 60 * 60 * 1000))} days old`)
for (const s of stale.slice(0, 10)) {
  console.log(`  ${s.partnerId.padEnd(16)} age=${s.ageDays}d  docs=${s.docsUrl ?? '(none)'}`)
}
if (stale.length === 0) console.log('  (all partner configs fresh — nothing to propose)')
