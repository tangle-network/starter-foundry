#!/usr/bin/env node
// Join stage: reads .evolve/traces/buildouts.jsonl + every vb-execution-*.jsonl
// and rewrites buildouts.jsonl in place with each event's `outcome` populated.
//
// Idempotent: running against an already-joined file just re-applies the same
// annotations. If a buildout event has no matching VB trace, outcome stays null.
//
// Match key: (scenarioId, partnerGuess-mapped-to-partner). Multiple VB traces
// can match one buildout (replays); we pick the most-recent-success if any,
// else the most recent of any outcome.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_PATHS,
  VERTICAL_TO_PARTNER,
} from '../dist/lib/buildout-traces.js'

if (!existsSync(DEFAULT_PATHS.buildoutsJsonl)) {
  console.error(`no buildouts file at ${DEFAULT_PATHS.buildoutsJsonl} — run mine-buildout-sessions first`)
  process.exit(2)
}

// Load every VB execution trace.
const vbByKey = new Map()
if (existsSync(DEFAULT_PATHS.vbTracesDir)) {
  for (const f of readdirSync(DEFAULT_PATHS.vbTracesDir)) {
    if (!f.startsWith('vb-execution-') || !f.endsWith('.jsonl')) continue
    const raw = readFileSync(join(DEFAULT_PATHS.vbTracesDir, f), 'utf8')
    for (const line of raw.trim().split('\n')) {
      if (!line) continue
      try {
        const t = JSON.parse(line)
        const key = `${t.scenarioId}::${t.partner}`
        const existing = vbByKey.get(key)
        // Prefer the most recent allPass=true; else most recent overall.
        if (!existing) {
          vbByKey.set(key, t)
        } else {
          const newTs = Date.parse(t.timestamp ?? '') || 0
          const oldTs = Date.parse(existing.timestamp ?? '') || 0
          const newIsBetter =
            (t.execution?.allPass && !existing.execution?.allPass) ||
            ((t.execution?.allPass === existing.execution?.allPass) && newTs > oldTs)
          if (newIsBetter) vbByKey.set(key, t)
        }
      } catch {
        // skip malformed
      }
    }
  }
}

console.log(`loaded VB traces: ${vbByKey.size} keys (scenarioId,partner)`)

const lines = readFileSync(DEFAULT_PATHS.buildoutsJsonl, 'utf8').trim().split('\n').filter((l) => l.length > 0)
let annotated = 0
let missing = 0
const rewritten = []
for (const line of lines) {
  let e
  try {
    e = JSON.parse(line)
  } catch {
    // Keep malformed lines verbatim (don't lose data), but skip join attempt.
    rewritten.push(line)
    continue
  }
  const partner = VERTICAL_TO_PARTNER[e.partnerGuess] ?? e.partnerGuess
  const key = `${e.scenarioId}::${partner}`
  const vb = vbByKey.get(key)
  if (vb && vb.execution) {
    e.outcome = {
      source: 'vb-execution',
      allPass: vb.execution.allPass,
      blendedScore: vb.execution.blendedScore,
      failingLayers: vb.execution.failingLayers ?? [],
      shotsRun: vb.execution.shotsRun ?? 0,
      shotsToConvergence: vb.execution.shotsToConvergence ?? null,
      wallMs: vb.execution.wallMs ?? 0,
      toolCallsTotal: vb.execution.toolCallsTotal ?? 0,
    }
    annotated++
  } else {
    e.outcome = null
    missing++
  }
  rewritten.push(JSON.stringify(e))
}

writeFileSync(DEFAULT_PATHS.buildoutsJsonl, rewritten.join('\n') + '\n')
console.log(`annotated: ${annotated} / ${lines.length}`)
console.log(`unmatched: ${missing}`)
console.log(`wrote: ${DEFAULT_PATHS.buildoutsJsonl}`)
