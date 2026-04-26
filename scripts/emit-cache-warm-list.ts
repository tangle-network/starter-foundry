#!/usr/bin/env node
/**
 * emit-cache-warm-list — single source of truth for ADC's sandbox warm
 * cache, derived from Starter-Foundry template + layer manifests.
 *
 * Walks registry/{families,layers}/**\/files/** for manifest files and
 * emits entries in ADC's expected format:
 *
 *   npm:<pkg>                  (version-less — pnpm store resolves at install time)
 *   crates:<name>@<version>    (version REQUIRED by ADC's cargo warm loop)
 *   pip:<pkg>                  (new — previously pip was hardcoded inline
 *                               in ADC's warm-package-caches.sh)
 *
 * Output is the union of:
 *   1. Existing ADC cache-warm-list.json entries (preserved — this script
 *      never strips entries, only adds).
 *   2. Newly-discovered entries from SF templates (deduped by prefix+name).
 *
 * Why auto-derive: SF templates are partially agent-authored (template
 * miner / proposer jobs), so manual curation of ADC's warm list drifts
 * quickly. Regenerating from the templates themselves means a new
 * family that adds `phaser` or `@langchain/langgraph` flows into the
 * warm cache on the next SF → ADC sync, no human intervention.
 *
 * Usage:
 *   node scripts/emit-cache-warm-list.ts \
 *     [--adc-path <path-to-agent-dev-container>] \
 *     [--out <path>] \
 *     [--check] \
 *     [--verbose]
 *
 * Flags:
 *   --adc-path  Path to agent-dev-container repo (default: ../agent-dev-container
 *               relative to SF repo root). Used to read the existing
 *               cache-warm-list.json so we preserve manual entries.
 *   --out       Output path (default: <adc-path>/apps/host-agent/cache-warm-list.json).
 *               Pass `-` to write to stdout.
 *   --check     Don't write — exit 1 if the current file on disk differs
 *               from what would be emitted (CI gate).
 *   --verbose   Log per-file parsing details to stderr.
 *
 * Exit codes:
 *   0  success (or --check with no drift)
 *   1  --check drift detected
 *   2  parse error on a manifest (never skipped silently)
 *   3  ADC path not found
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const SF_REPO = resolve(SCRIPT_DIR, '..')

// ─── Argv ──────────────────────────────────────────────────────────────────

function argAfter(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : fallback
}

const ADC_PATH = resolve(
  SF_REPO,
  argAfter('--adc-path', '../agent-dev-container'),
)
const DEFAULT_OUT = join(ADC_PATH, 'apps/host-agent/cache-warm-list.json')
const OUT_PATH = argAfter('--out', DEFAULT_OUT)
const CHECK = process.argv.includes('--check')
const VERBOSE = process.argv.includes('--verbose')

const log = (msg) => { if (VERBOSE) process.stderr.write(`[warm-emit] ${msg}\n`) }

if (!existsSync(ADC_PATH)) {
  console.error(`ERROR: ADC path not found: ${ADC_PATH}`)
  console.error('Pass --adc-path <path> or clone agent-dev-container as a sibling of starter-foundry.')
  process.exit(3)
}

// ─── Template-placeholder detection ────────────────────────────────────────
// Package/crate names can contain {{var}} mustache markers in SF templates
// (e.g. `{{crateName}}` in Cargo.toml). These are invalid as warm entries —
// skip them and log.

const HAS_TEMPLATE_MARKER = /[{}]/

// ─── Walkers ───────────────────────────────────────────────────────────────

function* walkFiles(root) {
  if (!existsSync(root)) return
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git') continue
      const full = join(dir, e.name)
      if (e.isDirectory()) stack.push(full)
      else if (e.isFile()) yield full
    }
  }
}

// ─── Parsers ───────────────────────────────────────────────────────────────

/** Parse package.json `dependencies` + `devDependencies`. Returns plain names. */
function parsePackageJson(path) {
  const raw = readFileSync(path, 'utf8')
  let json
  try { json = JSON.parse(raw) } catch (err) {
    console.error(`ERROR: invalid JSON in ${path}: ${err.message}`)
    process.exit(2)
  }
  const names = new Set()
  for (const k of Object.keys(json.dependencies ?? {})) names.add(k)
  for (const k of Object.keys(json.devDependencies ?? {})) names.add(k)
  return [...names].filter((n) => !HAS_TEMPLATE_MARKER.test(n))
}

/**
 * Parse requirements.txt. Strips version specifiers, markers, and inline
 * comments. Extras are kept in the emitted name (pip install <pkg>[extra]
 * warms both the base and the extra's wheels).
 */
function parseRequirements(path) {
  const out = []
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const stripped = rawLine.split('#')[0].trim()
    if (!stripped) continue
    if (stripped.startsWith('-')) continue // -r nested, -e editable
    // Everything before version ops / markers / spaces is the name(+extras).
    const m = stripped.match(/^([A-Za-z0-9_.\-]+(?:\[[^\]]*\])?)/)
    if (!m) continue
    const name = m[1]
    if (HAS_TEMPLATE_MARKER.test(name)) continue
    out.push(name)
  }
  return out
}

/**
 * Parse Cargo.toml [dependencies] and [dev-dependencies] sections.
 * Handles the three common value shapes: `x = "1"`, `x = { version = "1" }`,
 * and `x = { workspace = true }` (workspace-inherited — version resolved
 * at workspace root, which SF templates don't encode, so these are
 * emitted with no version and later filtered).
 *
 * Returns [{name, version?}]. ADC's cargo warm loop skips entries
 * without a version, so we do too (logged at verbose).
 */
function parseCargoToml(path) {
  const src = readFileSync(path, 'utf8')
  const deps = []
  let currentSection = null
  for (const rawLine of src.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trimEnd()
    if (!line) continue
    const sectionMatch = line.match(/^\s*\[(.+)\]\s*$/)
    if (sectionMatch) { currentSection = sectionMatch[1]; continue }
    if (currentSection !== 'dependencies'
        && currentSection !== 'dev-dependencies'
        && !/\.dependencies$/.test(currentSection ?? '')
        && !/\.dev-dependencies$/.test(currentSection ?? '')) continue
    const kvMatch = line.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*(.+)$/)
    if (!kvMatch) continue
    const [, name, value] = kvMatch
    if (HAS_TEMPLATE_MARKER.test(name)) continue
    // Literal `x = "1.2"` — version is the string.
    const stringMatch = value.match(/^"([^"]+)"/)
    if (stringMatch) { deps.push({ name, version: stringMatch[1] }); continue }
    // Inline table `x = { version = "1", features = [...] }`.
    const inlineVersion = value.match(/version\s*=\s*"([^"]+)"/)
    if (inlineVersion) { deps.push({ name, version: inlineVersion[1] }); continue }
    // Workspace-inherited or path/git dep — no version we can emit.
    deps.push({ name })
  }
  return deps
}

// ─── Discover manifests ────────────────────────────────────────────────────

const ROOTS = [
  join(SF_REPO, 'registry/families'),
  join(SF_REPO, 'registry/layers'),
]

const npmDeps = new Set()
const pipDeps = new Set()
const cargoDeps = new Map() // name -> latest-seen version (coarse dedup)

let manifestCount = 0
for (const root of ROOTS) {
  for (const path of walkFiles(root)) {
    const base = path.split('/').pop()
    if (base === 'package.json') {
      manifestCount += 1
      const names = parsePackageJson(path)
      for (const n of names) npmDeps.add(n)
      log(`${relative(SF_REPO, path)}: +${names.length} npm`)
    } else if (base === 'requirements.txt') {
      manifestCount += 1
      const names = parseRequirements(path)
      for (const n of names) pipDeps.add(n)
      log(`${relative(SF_REPO, path)}: +${names.length} pip`)
    } else if (base === 'Cargo.toml') {
      manifestCount += 1
      const deps = parseCargoToml(path)
      let kept = 0
      for (const d of deps) {
        if (!d.version) continue
        // Prefer the narrower of two observed versions (sort lexicographically
        // for reproducibility — this is good enough until a family needs
        // an exact pin, at which point add a manual override list).
        const existing = cargoDeps.get(d.name)
        if (!existing || d.version < existing) {
          cargoDeps.set(d.name, d.version)
          kept += 1
        }
      }
      log(`${relative(SF_REPO, path)}: +${kept} crates`)
    }
  }
}

log(`parsed ${manifestCount} manifests → ${npmDeps.size} npm, ${pipDeps.size} pip, ${cargoDeps.size} crates`)

// ─── Merge with existing ADC list ──────────────────────────────────────────

const adcListPath = join(ADC_PATH, 'apps/host-agent/cache-warm-list.json')
let existing = []
if (existsSync(adcListPath)) {
  try { existing = JSON.parse(readFileSync(adcListPath, 'utf8')) } catch (err) {
    console.error(`ERROR: failed to parse existing ${adcListPath}: ${err.message}`)
    process.exit(2)
  }
  if (!Array.isArray(existing)) {
    console.error(`ERROR: ${adcListPath} is not a JSON array`)
    process.exit(2)
  }
}

const merged = new Set(existing)
for (const n of npmDeps) merged.add(`npm:${n}`)
for (const n of pipDeps) merged.add(`pip:${n}`)
for (const [name, version] of cargoDeps) merged.add(`crates:${name}@${version}`)

// Stable sort — prefix then name for readable diffs.
const entries = [...merged].sort((a, b) => {
  const [ap, an] = a.split(/:(.+)/)
  const [bp, bn] = b.split(/:(.+)/)
  if (ap !== bp) return ap.localeCompare(bp)
  return (an ?? '').localeCompare(bn ?? '')
})

const addedCount = entries.length - existing.length
log(`merged: ${existing.length} existing + ${addedCount} new = ${entries.length} total`)

const output = JSON.stringify(entries, null, 2) + '\n'

// ─── Check mode ────────────────────────────────────────────────────────────

if (CHECK) {
  const target = OUT_PATH === '-' ? adcListPath : OUT_PATH
  if (!existsSync(target)) {
    console.error(`CHECK failed: ${target} does not exist`)
    process.exit(1)
  }
  const current = readFileSync(target, 'utf8')
  if (current !== output) {
    console.error(`CHECK failed: ${target} is stale.`)
    console.error(`Rerun without --check to regenerate.`)
    console.error(`Would add ${addedCount} new entries.`)
    process.exit(1)
  }
  log('CHECK passed')
  process.exit(0)
}

// ─── Write ─────────────────────────────────────────────────────────────────

if (OUT_PATH === '-') {
  process.stdout.write(output)
} else {
  writeFileSync(OUT_PATH, output)
  process.stderr.write(`wrote ${entries.length} entries → ${OUT_PATH} (+${addedCount} new)\n`)
}
