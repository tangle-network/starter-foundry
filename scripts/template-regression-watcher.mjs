#!/usr/bin/env node
// Template-regression watcher — guards against template_v1 promotions that
// actually make things worse. Logic:
//
//   1. For each scaffold-target template (normalized from a tmp path), count
//      how many buildout events in the last 7 days rewrote it vs the prior
//      7-day window.
//   2. If recent-window / prior-window > 1.2 (>20% regression) AND the
//      template was promoted by a template-sweep PR within the last ~14 days,
//      flag it for revert.
//
// Writes .evolve/regressions/watcher.json. When run with --open-pr, uses the
// git log to find the sweep commit + gh CLI to open a revert PR. When run
// without --open-pr, emits a findings file for human review.
//
// CI usage (weekly, after the sweep workflow):
//   node scripts/template-regression-watcher.mjs --open-pr
// Local inspection:
//   node scripts/template-regression-watcher.mjs

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TRACES = join(REPO, '.evolve/traces/buildouts.jsonl')
const OUT = join(REPO, '.evolve/regressions/watcher.json')
const OPEN_PR = process.argv.includes('--open-pr')
const REGRESSION_THRESHOLD = 1.2

if (!existsSync(TRACES)) {
  console.error('✗ no buildout traces — nothing to watch')
  process.exit(0)
}

const now = Date.now()
const DAY = 86400 * 1000
const recentStart = now - 7 * DAY
const priorStart = now - 14 * DAY
const priorEnd = recentStart

// Normalize absolute tmpdir paths down to the scaffold-relative target.
// Buildout traces log /private/var/folders/.../<scaffold>-<hash>/foo/bar.ts
// — we want `foo/bar.ts`.
function normalize(path) {
  const m = path.match(/(?:^|\/)([\w-]+)-[a-zA-Z0-9]{6}\/(.+)$/)
  if (m) return m[2]
  // Alternate format where scaffold has a different shape.
  const m2 = path.match(/\/T\/[^/]+\/[^/]+\/(.+)$/)
  if (m2) return m2[1]
  return path
}

const recentCounts = new Map()
const priorCounts = new Map()

for (const line of readFileSync(TRACES, 'utf8').split('\n')) {
  if (!line.trim()) continue
  let event
  try {
    event = JSON.parse(line)
  } catch {
    continue
  }
  const ts = event.firstTs ? Date.parse(event.firstTs) : null
  if (!ts || !Array.isArray(event.rewrittenFiles)) continue
  const bucket = ts >= recentStart ? recentCounts : ts >= priorStart && ts < priorEnd ? priorCounts : null
  if (!bucket) continue
  for (const rawPath of event.rewrittenFiles) {
    const key = normalize(rawPath)
    bucket.set(key, (bucket.get(key) ?? 0) + 1)
  }
}

const allTargets = new Set([...recentCounts.keys(), ...priorCounts.keys()])
const regressions = []
for (const target of allTargets) {
  const recent = recentCounts.get(target) ?? 0
  const prior = priorCounts.get(target) ?? 0
  if (prior === 0) continue  // nothing to compare against
  if (recent < 3) continue   // too few events to trust
  const ratio = recent / prior
  if (ratio > REGRESSION_THRESHOLD) {
    regressions.push({ target, recent, prior, ratio })
  }
}
regressions.sort((a, b) => b.ratio - a.ratio)

// Attempt to associate each regression with a recent template-sweep commit.
function findSweepCommitFor(target) {
  const log = spawnSync(
    'git',
    ['log', '--since=14 days ago', '--pretty=format:%H\t%s', '--', `registry/`],
    { cwd: REPO, encoding: 'utf8' },
  )
  if (log.status !== 0) return null
  const matches = (log.stdout ?? '')
    .split('\n')
    .filter((l) => l.includes('template-sweep') || l.includes('template-quality'))
    .map((l) => {
      const [sha, ...rest] = l.split('\t')
      return { sha, subject: rest.join('\t') }
    })
  if (matches.length === 0) return null
  // Rough heuristic: pick the commit whose subject contains a token from the target path.
  const tok = target.split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''
  const hit = matches.find((m) => tok && m.subject.toLowerCase().includes(tok.toLowerCase()))
  return hit ?? matches[0]
}

const withCommits = regressions.map((r) => ({
  ...r,
  recentSweepCommit: findSweepCommitFor(r.target),
}))

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      window: { recentDays: 7, priorDays: 7, threshold: REGRESSION_THRESHOLD },
      regressions: withCommits,
    },
    null,
    2,
  ) + '\n',
)

console.log(`\n=== template-regression-watcher ===`)
console.log(`recent-window events: ${[...recentCounts.values()].reduce((a, b) => a + b, 0)}`)
console.log(`prior-window events:  ${[...priorCounts.values()].reduce((a, b) => a + b, 0)}`)
console.log(`regressions flagged:  ${withCommits.length}`)
for (const r of withCommits.slice(0, 10)) {
  const sweepTag = r.recentSweepCommit ? `← ${r.recentSweepCommit.sha.slice(0, 8)} ${r.recentSweepCommit.subject.slice(0, 60)}` : '(no sweep commit found)'
  console.log(`  ${r.target.padEnd(48)} ${r.recent}/${r.prior} (×${r.ratio.toFixed(2)}) ${sweepTag}`)
}

if (!OPEN_PR) process.exit(0)

if (withCommits.length === 0) {
  console.log('\nno regressions — no PR opened')
  process.exit(0)
}

// Open one revert PR per regression that has an associated sweep commit.
const ghCheck = spawnSync('gh', ['--version'], { encoding: 'utf8' })
if (ghCheck.status !== 0) {
  console.error('✗ gh CLI unavailable — skipping PR open')
  process.exit(2)
}

for (const r of withCommits) {
  if (!r.recentSweepCommit) continue
  const branch = `template-sweep-revert/${r.target.replace(/[\/.]/g, '-')}-${Date.now().toString(36)}`
  const steps = [
    ['git', ['checkout', '-b', branch]],
    ['git', ['revert', '--no-edit', r.recentSweepCommit.sha]],
    ['git', ['push', 'origin', branch]],
    [
      'gh',
      [
        'pr',
        'create',
        '--title',
        `template-sweep: REVERT ${r.target} (×${r.ratio.toFixed(2)} regression)`,
        '--body',
        [
          `## Automated regression revert`,
          ``,
          `Template sweep commit ${r.recentSweepCommit.sha.slice(0, 8)} promoted a rewrite of \`${r.target}\`.`,
          `In the 7 days following, agents rewrote this file **${r.recent}×** — up from **${r.prior}×** in the preceding 7 days (×${r.ratio.toFixed(2)}).`,
          ``,
          `This exceeds the regression threshold (×${REGRESSION_THRESHOLD}). Reverting the original sweep commit so the prior-known-good template is restored.`,
          ``,
          `If the regression is spurious (e.g. unrelated traffic spike), close this PR and increase REGRESSION_THRESHOLD in \`scripts/template-regression-watcher.mjs\`.`,
          ``,
          `_Opened by \`scripts/template-regression-watcher.mjs\`._`,
        ].join('\n'),
      ],
    ],
    ['git', ['checkout', '-']],
  ]

  let ok = true
  for (const [cmd, args] of steps) {
    const proc = spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8' })
    if (proc.status !== 0) {
      console.error(`  ✗ ${cmd} ${args.slice(0, 2).join(' ')}: exit ${proc.status} — ${(proc.stderr ?? '').slice(0, 300)}`)
      spawnSync('git', ['checkout', '-'], { cwd: REPO, encoding: 'utf8' })
      ok = false
      break
    }
  }
  if (ok) console.log(`  ✓ revert PR opened for ${r.target}`)
}
