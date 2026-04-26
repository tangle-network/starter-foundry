#!/usr/bin/env node
// Template-quality sweep: orchestrates template_v1/run.ts (propose/verify/
// review loop, up to 3 shots per template) across the top-N rewritten
// templates per .evolve/buildout-analysis.json. Emits candidates + reports
// to .evolve/template-candidates/, plus a summary JSON so CI can open PRs
// for promotable candidates.
//
// run.ts uses agent-eval's runProposeReview primitive: synthesize as the
// proposer, audit (compose+install+typecheck) as the verifier, LLM reviewer
// (Anthropic direct preferred → Groq → tangle-router). Reviewer memory is
// persisted per-template at .evolve/review-memory/template-<key>.jsonl so
// subsequent sweeps resume with all prior observations intact.
//
// CI invocation:
//   ANTHROPIC_API_KEY=... node scripts/template-quality-sweep.ts --top 5
//   # or fall back to TANGLE_ROUTER_USER_KEY
// Local dry-run:
//   node scripts/template-quality-sweep.ts --top 3 --dry-run

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ANALYSIS = join(REPO, '.evolve/buildout-analysis.json')
const SUMMARY_OUT = join(REPO, '.evolve/template-candidates/sweep-summary.json')

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const flag = (n) => process.argv.includes(n)

const TOP_N = Number.parseInt(arg('--top', '5'), 10)
const DRY_RUN = flag('--dry-run')
const LLM_ONLY = flag('--llm-only')

if (!existsSync(ANALYSIS)) {
  console.error('✗ .evolve/buildout-analysis.json missing. Run `node scripts/run-buildout-pipeline.ts` first.')
  process.exit(2)
}

const analysis = JSON.parse(readFileSync(ANALYSIS, 'utf8'))
const topFiles = (analysis.topRewrittenFiles ?? []).slice(0, TOP_N)

if (topFiles.length === 0) {
  console.log('no top-rewritten files in analysis — nothing to sweep')
  process.exit(0)
}

// Walk registry/ to index templates by their scaffold target path.
// Returns Map<scaffoldTarget, Array<{ sourcePath, family, key }>>
function indexTemplates() {
  const idx = new Map()
  for (const root of ['families', 'layers/framework', 'layers/capability']) {
    const rootDir = join(REPO, 'registry', root)
    if (!existsSync(rootDir)) continue
    for (const id of readdirSync(rootDir)) {
      if (id.startsWith('_') || id.startsWith('.')) continue
      const manifestPath = join(rootDir, id, 'manifest.json')
      if (!existsSync(manifestPath)) continue
      try {
        const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
        if (!Array.isArray(m.files)) continue
        for (const entry of m.files) {
          if (!entry.source || !entry.target) continue
          const sourcePath = join(rootDir, id, entry.source)
          if (!existsSync(sourcePath)) continue
          if (!statSync(sourcePath).isFile()) continue
          const key = entry.target.replace(/\//g, '.')
          const bucket = idx.get(entry.target) ?? []
          bucket.push({
            sourcePath: join('registry', root, id, entry.source),
            family: id,
            templateKey: key,
            scaffoldTarget: entry.target,
            layerKind: root.startsWith('layers/') ? root.split('/')[1] : 'family',
          })
          idx.set(entry.target, bucket)
        }
      } catch {
        /* skip malformed manifests */
      }
    }
  }
  return idx
}

const templateIdx = indexTemplates()

const sweepResults = []
for (const entry of topFiles) {
  const scaffoldFile = entry.file
  const candidates = templateIdx.get(scaffoldFile) ?? []
  if (candidates.length === 0) {
    sweepResults.push({
      scaffoldFile,
      timesRewritten: entry.timesRewritten,
      status: 'no-template-source',
      reason: `no registry/ entry ships ${scaffoldFile} — either it is agent-generated from scratch or the scaffold target is dynamic.`,
    })
    continue
  }

  // Prefer framework-layer source over capability over family for the same target.
  const preferred = candidates.sort((a, b) => {
    const rank = (x) => (x.layerKind === 'framework' ? 0 : x.layerKind === 'capability' ? 1 : 2)
    return rank(a) - rank(b)
  })[0]

  const runArgs = [
    'tsx',
    'src/training/template_v1/run.ts',
    '--template-key',
    preferred.templateKey,
    '--family',
    preferred.family,
    '--template-target',
    preferred.scaffoldTarget,
    '--source-path',
    preferred.sourcePath,
  ]
  if (DRY_RUN) runArgs.push('--dry-run')

  console.log(`\n── sweeping ${scaffoldFile} (${entry.timesRewritten}× rewritten) ──`)
  console.log(`  family: ${preferred.family}`)
  console.log(`  template source: ${preferred.sourcePath}`)

  const env = { ...process.env }
  if (LLM_ONLY && !env.TANGLE_ROUTER_USER_KEY && !env.ANTHROPIC_API_KEY) {
    sweepResults.push({
      scaffoldFile,
      timesRewritten: entry.timesRewritten,
      family: preferred.family,
      status: 'skip-no-key',
      reason: '--llm-only set but no router/anthropic key in env',
    })
    continue
  }

  const proc = spawnSync('pnpm', runArgs, {
    cwd: REPO,
    encoding: 'utf8',
    env,
    timeout: 300_000,
  })

  const stdout = proc.stdout ?? ''
  const stderr = proc.stderr ?? ''

  // run.ts writes report to .evolve/template-candidates/<key>.<stamp>.report.json
  // Find the newest for this key.
  const candidatesDir = join(REPO, '.evolve/template-candidates')
  let latestReport = null
  if (existsSync(candidatesDir)) {
    const keyPrefix = preferred.templateKey
    const matches = readdirSync(candidatesDir)
      .filter((f) => f.startsWith(keyPrefix + '.') && f.endsWith('.report.json'))
      .map((f) => ({ f, stat: statSync(join(candidatesDir, f)) }))
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
    if (matches.length > 0) {
      try {
        latestReport = JSON.parse(readFileSync(join(candidatesDir, matches[0].f), 'utf8'))
      } catch {
        /* ignore */
      }
    }
  }

  sweepResults.push({
    scaffoldFile,
    timesRewritten: entry.timesRewritten,
    family: preferred.family,
    templateKey: preferred.templateKey,
    sourcePath: preferred.sourcePath,
    status: proc.status === 0 ? 'ran' : 'run-failed',
    exitCode: proc.status,
    stderrTail: stderr.slice(-800),
    stdoutTail: stdout.slice(-800),
    report: latestReport,
  })
}

// Write summary.
mkdirSync(dirname(SUMMARY_OUT), { recursive: true })
writeFileSync(
  SUMMARY_OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      topN: TOP_N,
      dryRun: DRY_RUN,
      results: sweepResults,
    },
    null,
    2,
  ) + '\n',
)

console.log(`\n✓ sweep complete — ${sweepResults.length} template(s) processed`)
console.log(`  summary → ${SUMMARY_OUT}`)
const promotable = sweepResults.filter((r) => r.report?.decision === 'promotable').length
const ran = sweepResults.filter((r) => r.status === 'ran').length
const shotsTotal = sweepResults.reduce((acc, r) => acc + (r.report?.loop?.shotsUsed ?? 0), 0)
const looped = sweepResults.filter((r) => (r.report?.loop?.shotsUsed ?? 0) > 1).length
console.log(`  ran: ${ran}, promotable: ${promotable}, multi-shot runs: ${looped}, shots total: ${shotsTotal}`)
