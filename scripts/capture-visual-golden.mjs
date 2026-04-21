#!/usr/bin/env node
// Capture the visual regression golden set. Composes N representative
// specs (one per archetype), SHA-256-hashes the composed file tree, and
// writes the snapshot to .evolve/visual-golden/<archetype>.sha256.
//
// CI (nightly) re-runs this with --check and fails the build if any
// hash drifts — you changed the scaffold without updating the golden.
//
// Usage:
//   node scripts/capture-visual-golden.mjs           # capture fresh goldens
//   node scripts/capture-visual-golden.mjs --check   # compare against committed
//   node scripts/capture-visual-golden.mjs --specs specs/golden/*.json

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GOLDEN_DIR = join(REPO, '.evolve/visual-golden')
const CHECK = process.argv.includes('--check')

// Golden specs — one per archetype. Add new ones when a new family
// graduates to "must not regress" status. Keep small and representative.
const SPECS = [
  { name: 'react-vite-ts-landing', spec: { projectName: 'golden-rv', family: 'react-vite-ts', layers: ['framework:react-vite-ts', 'capability:layout-landing'], partner: null, slots: {}, variables: { headline: 'Golden', subheadline: 'Golden' } } },
  { name: 'nextjs-ts-dashboard', spec: { projectName: 'golden-nx', family: 'nextjs-ts', layers: ['framework:nextjs-ts', 'capability:layout-dashboard', 'capability:layout-admin'], partner: null, slots: {}, variables: { headline: 'Golden', subheadline: 'Golden' } } },
  { name: 'fullstack-ts-saas', spec: { projectName: 'golden-fs', family: 'fullstack-ts', layers: ['framework:fullstack-node-ts', 'capability:saas-teams', 'capability:multi-tenancy'], partner: null, slots: {}, variables: { headline: 'Golden', subheadline: 'Golden' } } },
  { name: 'astro-static-landing', spec: { projectName: 'golden-as', family: 'astro-static', layers: ['framework:astro-static', 'capability:layout-landing'], partner: null, slots: {}, variables: { headline: 'Golden', subheadline: 'Golden' } } },
  { name: 'bun-http-api', spec: { projectName: 'golden-bn', family: 'bun-http', layers: ['framework:bun-http'], partner: null, slots: {}, variables: { headline: 'Golden', subheadline: 'Golden' } } },
]

function hashTree(rootDir) {
  const entries = []
  function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      if (name === 'node_modules' || name === '.starter-foundry') continue
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) walk(full)
      else if (st.isFile()) {
        const rel = relative(rootDir, full)
        const content = readFileSync(full)
        const h = createHash('sha256').update(content).digest('hex')
        entries.push(`${h}  ${rel}`)
      }
    }
  }
  walk(rootDir)
  const manifest = entries.join('\n')
  return {
    manifestSha: createHash('sha256').update(manifest).digest('hex'),
    fileCount: entries.length,
    manifest,
  }
}

async function composeSpec(spec) {
  // Shell out to the CLI to avoid importing heavy graph at script start.
  const dir = mkdtempSync(join(tmpdir(), 'sf-golden-'))
  const specPath = join(dir, 'spec.json')
  writeFileSync(specPath, JSON.stringify(spec))
  const outDir = join(dir, 'out')
  const res = spawnSync('node', ['dist/cli.js', 'compose', '--spec', specPath, '--out', outDir], {
    cwd: REPO,
    encoding: 'utf8',
  })
  if (res.status !== 0) {
    rmSync(dir, { recursive: true, force: true })
    throw new Error(`compose failed: ${res.stderr?.slice(0, 500) ?? 'unknown'}`)
  }
  const hash = hashTree(outDir)
  rmSync(dir, { recursive: true, force: true })
  return hash
}

if (!CHECK) mkdirSync(GOLDEN_DIR, { recursive: true })

let drifted = 0
let captured = 0

for (const { name, spec } of SPECS) {
  try {
    const { manifestSha, fileCount, manifest } = await composeSpec(spec)
    const goldenPath = join(GOLDEN_DIR, `${name}.sha256`)
    if (CHECK) {
      if (!existsSync(goldenPath)) {
        console.error(`  ! ${name}: no committed golden — run without --check to capture`)
        drifted++
        continue
      }
      const committed = readFileSync(goldenPath, 'utf8').split('\n')[0]?.trim()
      if (committed !== manifestSha) {
        console.error(`  ! ${name}: DRIFT — committed ${committed}, actual ${manifestSha} (${fileCount} files)`)
        drifted++
      } else {
        console.log(`  ✓ ${name}: ${manifestSha.slice(0, 12)}... (${fileCount} files)`)
      }
    } else {
      const content = `${manifestSha}\n# ${fileCount} files\n${manifest}\n`
      writeFileSync(goldenPath, content)
      console.log(`  ✓ captured ${name}: ${manifestSha.slice(0, 12)}... (${fileCount} files)`)
      captured++
    }
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`)
    if (CHECK) drifted++
  }
}

if (CHECK) {
  console.log(`\nvisual golden check: ${SPECS.length - drifted}/${SPECS.length} match`)
  process.exit(drifted > 0 ? 1 : 0)
} else {
  console.log(`\nvisual golden capture: ${captured}/${SPECS.length} written to ${GOLDEN_DIR}`)
}
