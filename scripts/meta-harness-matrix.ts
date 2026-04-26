#!/usr/bin/env node
// Runs the meta-harness eval across {baseline, rewriter} × corpora and
// appends aggregate rows to .evolve/experiments.jsonl.
//
// Usage: node scripts/meta-harness-matrix.ts [--smoke]

import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

const smoke = process.argv.includes('--smoke')

const configs = [
  { label: 'baseline', flags: [] },
  { label: 'brief', flags: ['--brief'] },
]

const experimentsPath = '.evolve/experiments.jsonl'
mkdirSync(dirname(experimentsPath), { recursive: true })

for (const cfg of configs) {
  const outPath = `.evolve/meta-harness/runs/matrix-${cfg.label}.jsonl`
  const args = [
    'scripts/meta-harness-eval.ts',
    '--out',
    outPath,
    '--label',
    cfg.label,
    ...cfg.flags,
  ]
  if (smoke) args.push('--smoke')

  console.log(`\n=== config: ${cfg.label} ===`)
  const res = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (res.status !== 0) {
    console.error(`config ${cfg.label} failed with exit ${res.status}`)
    process.exit(res.status ?? 1)
  }

  if (!existsSync(outPath)) {
    console.error(`expected output not found: ${outPath}`)
    continue
  }
  const lines = readFileSync(outPath, 'utf8').trim().split('\n')
  const aggregate = JSON.parse(lines[lines.length - 1])
  const row = {
    kind: 'meta-harness-matrix',
    timestamp: new Date().toISOString(),
    config: cfg.label,
    rewriter: cfg.flags.includes('--rewriter'),
    brief: cfg.flags.includes('--brief'),
    scenarios: aggregate.scenarios,
    passRate: aggregate.passRate,
    meanMs: aggregate.meanMs,
    p50Ms: aggregate.p50Ms,
    p95Ms: aggregate.p95Ms,
    p99Ms: aggregate.p99Ms,
    perCorpus: aggregate.perCorpus,
  }
  appendFileSync(experimentsPath, JSON.stringify(row) + '\n')
  console.log(`appended to ${experimentsPath}`)
}
