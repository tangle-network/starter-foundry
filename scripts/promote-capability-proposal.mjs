#!/usr/bin/env node
// Gen-6 Track C: capability promoter (parallel to promote-family-proposal.mjs).
//
// Takes a draft at .evolve/capability-proposals/<id>/ and walks it through
// three gates:
//   1. SCHEMA   — manifest validation (id, appliesTo, description, files[], no TODOs)
//   2. COMPOSE  — the capability composes into one of its appliesTo families
//   3. BUILD    — the composed scaffold installs + builds, scored via agent-eval
//
// Differences from family promoter:
//   - Compose requires an existing family from appliesTo (capabilities don't
//     stand alone). The capability must actually LAYER on an existing
//     registered family.
//   - Build gate is the compose target's build, not the capability's — so
//     this catches capabilities that break a family they claim to apply to.
//
// Usage:
//   node scripts/promote-capability-proposal.mjs --id foo-capability
//   node scripts/promote-capability-proposal.mjs --all [--dry-run] [--no-pr]

import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { InMemoryTraceStore, BuilderSession, SubprocessSandboxDriver, scoreProject } from '@tangle-network/agent-eval'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const ID = (() => { const i = argv.indexOf('--id'); return i >= 0 ? argv[i + 1] : null })()
const ALL = argv.includes('--all')
const DRY_RUN = argv.includes('--dry-run')

if (!ID && !ALL) {
  console.error('usage: promote-capability-proposal.mjs --id <proposal-id> | --all [--dry-run]')
  process.exit(2)
}

const proposalsDir = join(REPO, '.evolve/capability-proposals')
if (!existsSync(proposalsDir)) {
  console.log(`no drafts at ${proposalsDir}`)
  process.exit(0)
}
const targets = ALL
  ? readdirSync(proposalsDir).filter((d) => {
      const p = join(proposalsDir, d)
      try { return statSync(p).isDirectory() && existsSync(join(p, 'manifest.json')) } catch { return false }
    })
  : [ID]

const governorLog = join(REPO, '.evolve/governor.jsonl')
const impactLog = join(REPO, '.evolve/generation-impact.jsonl')
function logGovernor(entry) {
  try { appendFileSync(governorLog, JSON.stringify({ ts: new Date().toISOString(), source: 'promote-capability-proposal', ...entry }) + '\n') } catch { /* noop */ }
}
function logImpact(entry) {
  try { appendFileSync(impactLog, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n') } catch { /* noop */ }
}

const results = []
for (const id of targets) {
  const r = await promoteOne(id)
  results.push(r)
}

console.log('\n━━━━ capability promotion summary ━━━━')
for (const r of results) {
  const mark = r.gateReached === 'promoted' ? '✓' : r.gateReached === 'compose-pass' ? '◐' : r.gateReached === 'schema-pass' ? '·' : '✗'
  console.log(`  ${mark} ${r.id.padEnd(30)} gate=${r.gateReached.padEnd(15)} ${r.message}`)
}
const promoted = results.filter((r) => r.gateReached === 'promoted').length
console.log(`  promoted: ${promoted} / ${results.length}`)
process.exit(0)

// ────────────────────────────────────────────────────────────────────
async function promoteOne(id) {
  const draftDir = join(proposalsDir, id)
  if (!existsSync(join(draftDir, 'manifest.json'))) {
    return fail(id, 'no-draft', `missing manifest at ${draftDir}`)
  }
  const manifest = loadJson(join(draftDir, 'manifest.json'))
  const schemaErrors = validateCapabilitySchema(draftDir, id, manifest)
  if (schemaErrors.length > 0) {
    writeFileSync(join(draftDir, 'validation-errors.json'), JSON.stringify({ gate: 'schema', errors: schemaErrors }, null, 2))
    return fail(id, 'schema-fail', `schema: ${schemaErrors.length} errors`)
  }
  console.log(`  ✓ ${id} schema-pass`)

  // Gate 2: compose — pick the first existing family from appliesTo.
  const registryCapDir = join(REPO, 'registry/layers/capability', id)
  if (existsSync(registryCapDir)) {
    return fail(id, 'already-promoted', `registry/layers/capability/${id} exists`)
  }
  const composeTmp = mkdtempSync(join(tmpdir(), `promote-cap-${id}-`))
  let composedOutDir = null
  try {
    // Stage the capability into the real registry temporarily.
    mkdirSync(dirname(registryCapDir), { recursive: true })
    cpSync(draftDir, registryCapDir, { recursive: true })
    // Rebuild dist so CLI sees the new capability.
    const buildRes = spawnSync('pnpm', ['build'], { cwd: REPO, encoding: 'utf8' })
    if (buildRes.status !== 0) {
      writeFileSync(join(draftDir, 'validation-errors.json'), JSON.stringify({ gate: 'build-prep', error: buildRes.stderr.slice(-2000) }, null, 2))
      return fail(id, 'schema-pass', `typecheck failed staging capability: ${buildRes.stderr.slice(-300)}`)
    }
    // Pick target family — first appliesTo entry where BOTH family AND
    // matching framework layer exist. Family id can differ from framework
    // layer id (nextjs-ts family uses nextjs-app-router framework), so
    // matching only on family presence leads to compose failures.
    const appliesTo = Array.isArray(manifest.appliesTo) ? manifest.appliesTo : []
    let targetFamily = null
    for (const fam of appliesTo) {
      if (existsSync(join(REPO, 'registry/families', fam)) && existsSync(join(REPO, 'registry/layers/framework', fam))) {
        targetFamily = fam
        break
      }
    }
    if (!targetFamily) {
      writeFileSync(join(draftDir, 'validation-errors.json'), JSON.stringify({ gate: 'compose', error: `no appliesTo family has a matching framework layer: ${appliesTo.join(', ')}` }, null, 2))
      return fail(id, 'schema-pass', `no appliesTo family has matching framework layer: ${appliesTo.join(', ')}`)
    }
    // Compose family + this capability.
    const spec = {
      projectName: `promote-cap-smoke-${id}`,
      family: targetFamily,
      layers: [`framework:${targetFamily}`, `capability:${id}`],
      partner: null,
      slots: {},
      variables: {},
    }
    const specPath = join(composeTmp, 'spec.json')
    writeFileSync(specPath, JSON.stringify(spec))
    const composeRes = spawnSync('node', ['dist/cli.js', 'compose', '--spec', specPath, '--out', join(composeTmp, 'out'), '--json'], {
      cwd: REPO,
      encoding: 'utf8',
    })
    if (composeRes.status !== 0) {
      writeFileSync(join(draftDir, 'validation-errors.json'), JSON.stringify({ gate: 'compose', error: composeRes.stderr.slice(-2000), targetFamily }, null, 2))
      return fail(id, 'schema-pass', `compose failed: ${composeRes.stderr.slice(-300)}`)
    }
    composedOutDir = join(composeTmp, 'out')
    console.log(`  ✓ ${id} compose-pass (on ${targetFamily})`)
  } finally {
    try { rmSync(registryCapDir, { recursive: true, force: true }) } catch { /* noop */ }
  }

  // Gate 3: build — score the composed scaffold via agent-eval.
  let buildReport = null
  try {
    const family = loadJson(join(draftDir, 'manifest.json')) || manifest
    const harnessConfig = harnessConfigForFamily(family)
    const store = new InMemoryTraceStore()
    const driver = new SubprocessSandboxDriver({ cwd: composedOutDir })
    const session = new BuilderSession(store, { projectId: `promote-cap:${id}` }, driver)
    await session.startChat()
    const shipResult = await session.ship({ harness: harnessConfig })
    await session.endChat({
      pass: shipResult.result?.passed ?? false,
      score: shipResult.result?.score ?? 0,
    })
    buildReport = await scoreProject(store, `promote-cap:${id}`)
    if (!shipResult.result?.passed) {
      writeFileSync(join(draftDir, 'validation-errors.json'), JSON.stringify({ gate: 'build', buildReport, stdout: shipResult.result?.test?.stdout?.slice(-2000) ?? '', stderr: shipResult.result?.test?.stderr?.slice(-2000) ?? '' }, null, 2))
      return fail(id, 'compose-pass', `build failed: score=${(shipResult.result?.score ?? 0).toFixed(2)}`)
    }
    console.log(`  ✓ ${id} build-pass (score=${shipResult.result.score.toFixed(2)})`)
  } catch (err) {
    writeFileSync(join(draftDir, 'validation-errors.json'), JSON.stringify({ gate: 'build', error: err?.message ?? String(err) }, null, 2))
    return fail(id, 'compose-pass', `build threw: ${err?.message ?? err}`)
  } finally {
    try { rmSync(composeTmp, { recursive: true, force: true }) } catch { /* noop */ }
  }

  if (DRY_RUN) return ok(id, 'promoted', 'dry-run: all gates passed, skipping copy', { buildReport })

  try {
    mkdirSync(dirname(registryCapDir), { recursive: true })
    cpSync(draftDir, registryCapDir, { recursive: true })
    for (const noise of ['.meta.json', 'validation-errors.json']) {
      const p = join(registryCapDir, noise)
      try { if (existsSync(p)) rmSync(p) } catch { /* noop */ }
    }
  } catch (err) {
    return fail(id, 'compose-pass', `promote copy failed: ${err?.message ?? err}`)
  }

  writeFileSync(join(draftDir, 'promoted.json'), JSON.stringify({
    ts: new Date().toISOString(),
    registryPath: `registry/layers/capability/${id}`,
    buildScore: buildReport?.buildScore,
  }, null, 2))
  logImpact({
    event: 'capability-promoted',
    id,
    buildScore: buildReport?.buildScore,
    draftAgeHours: (() => {
      try {
        const meta = loadJson(join(draftDir, '.meta.json'))
        if (!meta?.generatedAt) return null
        return Number(((Date.now() - Date.parse(meta.generatedAt)) / 3_600_000).toFixed(1))
      } catch { return null }
    })(),
  })
  logGovernor({ event: 'capability-promoted', id, buildScore: buildReport?.buildScore })
  return ok(id, 'promoted', 'registry updated', { buildReport })
}

// ── helpers ──────────────────────────────────────────────────────────
function loadJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null }
}

function validateCapabilitySchema(draftDir, id, manifest) {
  const errors = []
  if (!manifest) return [{ path: 'manifest.json', error: 'missing or invalid JSON' }]
  if (manifest.id !== id) errors.push({ path: 'manifest.json', error: `id mismatch: manifest.id=${manifest.id} but dir=${id}` })
  if (!manifest.description || manifest.description.length < 20) errors.push({ path: 'manifest.json', error: 'description missing or <20 chars' })
  if (!Array.isArray(manifest.appliesTo) || manifest.appliesTo.length === 0) {
    errors.push({ path: 'manifest.json', error: 'appliesTo must be a non-empty array' })
  }
  if (!Array.isArray(manifest.files)) errors.push({ path: 'manifest.json', error: 'files[] must be an array' })
  const text = JSON.stringify(manifest)
  if (text.includes('TODO:') || text.includes('TODO ')) {
    errors.push({ path: 'manifest.json', error: 'TODO placeholders present' })
  }
  // path traversal guard on file targets
  for (const f of manifest.files ?? []) {
    if (typeof f?.target === 'string' && (f.target.includes('..') || f.target.startsWith('/'))) {
      errors.push({ path: `manifest.files[${f.target}]`, error: 'target path traversal/absolute' })
    }
  }
  return errors
}

function harnessConfigForFamily(familyManifest) {
  const language = familyManifest?.taxonomy?.language ?? 'unknown'
  switch (language) {
    case 'typescript':
    case 'javascript':
      // Strict tsc — same fix as promote-family-proposal.mjs (Gen 8). Capability
      // composes onto an existing family; if the composed scaffold doesn't
      // typecheck, the capability is the regression source. Failing loud here
      // catches it at proposal time instead of audit time.
      return { setupCommand: 'pnpm install --prefer-offline', testCommand: 'pnpm exec tsc --noEmit', timeoutMs: 180_000 }
    case 'rust':
      return { setupCommand: 'cargo fetch', testCommand: 'cargo check --workspace || cargo check', timeoutMs: 300_000 }
    case 'go':
      return { setupCommand: 'go mod tidy', testCommand: 'go build ./... && go vet ./...', timeoutMs: 180_000 }
    case 'python':
      return { setupCommand: '[ -f requirements.txt ] && pip install -r requirements.txt || true', testCommand: 'python -m compileall -q .', timeoutMs: 120_000 }
    default:
      return { setupCommand: '', testCommand: 'true', timeoutMs: 60_000 }
  }
}

function ok(id, gateReached, message, extra = {}) {
  logGovernor({ event: 'promote-cap-outcome', id, gateReached, ...extra })
  return { id, gateReached, message, ...extra }
}
function fail(id, gateReached, message) {
  logGovernor({ event: 'promote-cap-outcome', id, gateReached, message })
  logImpact({ event: 'capability-promote-failed', id, gateReached, message })
  return { id, gateReached, message }
}
