#!/usr/bin/env node
// dep-cascade-auto-bump — reads .evolve/proposals/dep-cascade.json (emitted
// by scripts/dep-cascade-detector.mjs) and opens a SINGLE PR that bumps
// every out-of-sync instance of a package to the newest version declared
// across the registry.
//
// Conservative by default: dry-run prints the plan. Pass --apply to actually
// open the PR. Intentionally opens ONE PR per cascade (not per family) so
// the reviewer sees the cross-family change as one unit — unifying N layers'
// version pins is a single coordinated decision.
//
// Usage:
//   node scripts/dep-cascade-auto-bump.mjs                 # dry-run
//   node scripts/dep-cascade-auto-bump.mjs --apply         # open PRs
//   node scripts/dep-cascade-auto-bump.mjs --max 3 --apply # cap PR count

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CASCADE_PATH = join(REPO, '.evolve/proposals/dep-cascade.json')

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const APPLY = process.argv.includes('--apply')
const MAX = parseInt(arg('--max', '5'), 10)

if (!existsSync(CASCADE_PATH)) {
  console.log('no dep-cascade.json — run scripts/dep-cascade-detector.mjs first')
  process.exit(0)
}

const cascade = JSON.parse(readFileSync(CASCADE_PATH, 'utf8'))
const candidates = (cascade.cascades ?? []).filter((c) => c.recommendBump)

console.log(`${candidates.length} cascade candidate(s) recommend-bump`)

if (candidates.length === 0) {
  console.log('nothing to bump — exiting')
  process.exit(0)
}

if (!APPLY) {
  console.log('\n=== DRY RUN (pass --apply to open PRs) ===\n')
  for (const c of candidates.slice(0, MAX)) {
    console.log(`  ${c.pkg}: ${c.versions.join(', ')} → ${c.recommendedVersion}`)
    console.log(`    affected layers (${c.affectedLayers.length}):`)
    for (const l of c.affectedLayers.slice(0, 5)) console.log(`      - ${l}`)
    if (c.affectedLayers.length > 5) console.log(`      ... +${c.affectedLayers.length - 5} more`)
    console.log()
  }
  process.exit(0)
}

// ---- apply path ----

function sh(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8', ...opts })
  if (res.status !== 0 && !opts.allowFail) {
    throw new Error(`${cmd} ${args.join(' ')} failed: ${res.stderr?.slice(0, 300)}`)
  }
  return res.stdout?.trim() ?? ''
}

let opened = 0
const errors = []

for (const c of candidates.slice(0, MAX)) {
  const branch = `dep-cascade/${c.pkg.replace(/[@/]/g, '-')}-${c.recommendedVersion}`
  try {
    // Skip if branch already exists on origin.
    const remote = sh('git', ['ls-remote', '--heads', 'origin', branch], { allowFail: true })
    if (remote.trim()) {
      console.log(`  skip ${branch}: already exists`)
      continue
    }

    sh('git', ['checkout', '-B', branch, 'origin/main'])

    // Bump every affected package.json.
    for (const layer of c.affectedLayers) {
      const pkgPath = join(REPO, layer)
      if (!existsSync(pkgPath)) continue
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      for (const target of ['dependencies', 'devDependencies', 'peerDependencies']) {
        if (pkg[target]?.[c.pkg]) pkg[target][c.pkg] = c.recommendedVersion
      }
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
      sh('git', ['add', pkgPath])
    }

    const status = sh('git', ['status', '--porcelain'])
    if (!status.trim()) {
      console.log(`  skip ${branch}: no changes applied (versions already unified)`)
      sh('git', ['checkout', '-'])
      continue
    }

    sh('git', [
      'commit',
      '-m',
      `dep-cascade: unify ${c.pkg} → ${c.recommendedVersion} across ${c.affectedLayers.length} layers`,
    ])
    sh('git', ['push', 'origin', branch])

    sh('gh', [
      'pr',
      'create',
      '--base',
      'main',
      '--head',
      branch,
      '--title',
      `dep-cascade: unify ${c.pkg} → ${c.recommendedVersion}`,
      '--body',
      [
        '## Dep cascade auto-bump',
        '',
        `Unifies \`${c.pkg}\` across ${c.affectedLayers.length} registry layers that currently pin inconsistent versions.`,
        '',
        `**Current versions**: ${c.versions.map((v) => `\`${v}\``).join(', ')}`,
        `**Target**: \`${c.recommendedVersion}\` (newest across the inconsistent set)`,
        '',
        '### Affected layers',
        c.affectedLayers.map((l) => `- \`${l}\``).join('\n'),
        '',
        '### Why this matters',
        'When one layer pins `^6.2.0` and another pins `^6.4.2`, pnpm picks different sub-versions at install time depending on which layer resolves first. That causes non-deterministic installs + duplicate packages in the tree + CVE sweep noise (one layer still flagged as vulnerable while another is clean).',
        '',
        'Unifying to the newest declared version keeps everything on the fix-available line.',
        '',
        'Generated by `scripts/dep-cascade-auto-bump.mjs`. Review layer-by-layer if the newest version introduces a breaking change; otherwise merge.',
      ].join('\n'),
    ])

    sh('git', ['checkout', '-'], { allowFail: true })
    opened++
    console.log(`  ✓ opened PR for ${branch}`)
  } catch (err) {
    errors.push({ branch, message: err.message })
    sh('git', ['checkout', '-'], { allowFail: true })
  }
}

console.log(`\nopened ${opened} PR(s); errors ${errors.length}`)
for (const e of errors) console.error(`  ${e.branch}: ${e.message}`)
process.exit(errors.length > 0 ? 1 : 0)
