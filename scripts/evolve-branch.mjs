#!/usr/bin/env node
// evolve-branch.mjs — fan enrich-family.mjs across every framework family
// that's new-on-this-branch (i.e. not in git HEAD). Parallelism-limited so
// N concurrent pnpm installs don't trash IO on a dev laptop. Writes a
// single .evolve/evolve-summary.json rollup and keeps per-family logs in
// .evolve/review-memory/<family>.run.log so a crashed family doesn't take
// the whole sweep down.
//
// Usage:
//   ANTHROPIC_API_KEY=... node scripts/evolve-branch.mjs
//   node scripts/evolve-branch.mjs --concurrency 3 --max-shots 3
//   node scripts/evolve-branch.mjs --only hipaa-compliance-pack,threejs-game
//   node scripts/evolve-branch.mjs --skip esp32-rust,stm32-rust     # slow toolchains

import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
function arg(flag, fallback) {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : fallback
}
const CONCURRENCY = Math.max(1, Number.parseInt(arg('--concurrency', '2'), 10))
const MAX_SHOTS = Math.max(1, Number.parseInt(arg('--max-shots', '3'), 10))
const BUILDER_MODEL = arg('--builder-model', 'sonnet')
const ONLY = arg('--only', null)?.split(',').map((s) => s.trim()).filter(Boolean) ?? null
const SKIP = new Set((arg('--skip', '') ?? '').split(',').map((s) => s.trim()).filter(Boolean))
const FAMILY_ROOT = join(REPO, 'registry/layers/framework')
const MEMORY_DIR = join(REPO, '.evolve/review-memory')
const SUMMARY_OUT = join(REPO, '.evolve/evolve-summary.json')

mkdirSync(MEMORY_DIR, { recursive: true })

// Discover families that are new-on-branch: directories in
// registry/layers/framework/ that are either untracked or have no
// manifest.json in HEAD. Falls back to "all families" if git introspection
// fails (e.g. not a git repo in CI).
function discoverNewFamilies() {
  let newDirs = new Set()
  try {
    const out = execSync('git status --porcelain registry/layers/framework/', {
      cwd: REPO,
      encoding: 'utf8',
    })
    for (const line of out.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const match = trimmed.match(/^(\?\?|A|M)\s+registry\/layers\/framework\/([^/]+)\//)
      if (match) newDirs.add(match[2])
    }
  } catch {
    /* fall back below */
  }
  // Only keep dirs that actually have a manifest.json and aren't skipped.
  const families = []
  for (const dir of newDirs) {
    const manifest = join(FAMILY_ROOT, dir, 'manifest.json')
    if (!existsSync(manifest)) continue
    if (SKIP.has(dir)) continue
    families.push(dir)
  }
  return families.sort()
}

const discovered = discoverNewFamilies()
const targets = ONLY ? ONLY.filter((f) => existsSync(join(FAMILY_ROOT, f, 'manifest.json'))) : discovered

if (targets.length === 0) {
  console.error('no families to evolve — pass --only <id> or ensure family dirs exist')
  process.exit(2)
}

console.log(`evolve-branch: ${targets.length} families, concurrency=${CONCURRENCY}, max-shots=${MAX_SHOTS}`)
for (const f of targets) console.log(`  • ${f}`)

// ── Concurrent runner ────────────────────────────────────────────────
// Spawn enrich-family.mjs for each family, limit to N concurrent. Each
// run's stdout/stderr is piped to its own log file so a long sweep
// doesn't interleave 49 streams into unreadable noise.

function runFamily(family) {
  return new Promise((resolvePromise) => {
    const log = join(MEMORY_DIR, `${family}.run.log`)
    const stream = createWriteStream(log, { flags: 'w' })
    stream.write(`# enrich-family ${family} @ ${new Date().toISOString()}\n`)
    const t0 = Date.now()
    const child = spawn(
      'node',
      [
        'scripts/enrich-family.mjs',
        '--family', family,
        '--max-shots', String(MAX_SHOTS),
        '--builder-model', BUILDER_MODEL,
      ],
      { cwd: REPO, env: process.env },
    )
    child.stdout.pipe(stream, { end: false })
    child.stderr.pipe(stream, { end: false })
    child.on('exit', (code, signal) => {
      const durMs = Date.now() - t0
      stream.end(`\n# exit code=${code} signal=${signal} duration=${durMs}ms\n`)
      // Summary file written by enrich-family.mjs itself.
      let summary = null
      const summaryPath = join(MEMORY_DIR, `${family}.summary.json`)
      if (existsSync(summaryPath)) {
        try {
          summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
        } catch {
          /* malformed summary — treat as no-data */
        }
      }
      resolvePromise({ family, exitCode: code, signal, durationMs: durMs, summary, log })
    })
  })
}

const results = []
let inFlight = 0
let cursor = 0

function next() {
  return new Promise((resolvePromise) => {
    const tick = () => {
      while (inFlight < CONCURRENCY && cursor < targets.length) {
        const family = targets[cursor++]
        inFlight++
        const pad = (s, n) => s.padEnd(n, ' ')
        console.log(`[${new Date().toISOString().slice(11, 19)}] → ${pad(family, 28)} (${cursor}/${targets.length} started)`)
        runFamily(family).then((res) => {
          inFlight--
          const pass = res.summary?.finalPass === true
          const shots = res.summary?.shotsUsed ?? '?'
          const wallS = (res.durationMs / 1000).toFixed(0)
          const mark = pass ? '✓' : res.exitCode === 0 ? '~' : '✗'
          console.log(`[${new Date().toISOString().slice(11, 19)}] ${mark} ${pad(family, 28)} shots=${shots} ${wallS}s`)
          results.push(res)
          if (cursor >= targets.length && inFlight === 0) resolvePromise()
          else tick()
        })
      }
      if (cursor >= targets.length && inFlight === 0) resolvePromise()
    }
    tick()
  })
}

const t0 = Date.now()
await next()
const wallMs = Date.now() - t0

// ── Roll-up ──────────────────────────────────────────────────────────
const rollup = {
  generatedAt: new Date().toISOString(),
  concurrency: CONCURRENCY,
  maxShots: MAX_SHOTS,
  builderModel: BUILDER_MODEL,
  wallMs,
  targetCount: targets.length,
  passCount: results.filter((r) => r.summary?.finalPass === true).length,
  failCount: results.filter((r) => r.summary?.finalPass === false).length,
  crashCount: results.filter((r) => !r.summary).length,
  results: results
    .sort((a, b) => a.family.localeCompare(b.family))
    .map((r) => ({
      family: r.family,
      exitCode: r.exitCode,
      durationMs: r.durationMs,
      pass: r.summary?.finalPass ?? null,
      shotsUsed: r.summary?.shotsUsed ?? null,
      failingLayers: r.summary?.finalFailingLayers ?? null,
      failureClass: r.summary?.failureClass ?? null,
      log: r.log,
    })),
}
writeFileSync(SUMMARY_OUT, JSON.stringify(rollup, null, 2))

console.log(`\n━━━ evolve-branch complete ━━━`)
console.log(`  families: ${targets.length}`)
console.log(`  passed:   ${rollup.passCount}`)
console.log(`  failed:   ${rollup.failCount}`)
console.log(`  crashed:  ${rollup.crashCount}`)
console.log(`  wall:     ${(wallMs / 1000).toFixed(0)}s`)
console.log(`  summary:  ${SUMMARY_OUT}`)
process.exit(rollup.failCount + rollup.crashCount > 0 ? 1 : 0)
