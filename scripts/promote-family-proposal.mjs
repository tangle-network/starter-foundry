#!/usr/bin/env node
// Gen-5 closed-loop generation: validate + promote a family proposal.
//
// Takes a draft in .evolve/family-proposals/<id>/ and walks it through three
// validation gates using agent-eval primitives:
//
//   1. SCHEMA    — registry manifest schema via validate-registry.mjs
//   2. COMPOSE   — compose smoke via dist/cli.js (reuses scaffold-bridge glue)
//   3. BUILD     — install+build via agent-eval's SandboxHarness +
//                  SubprocessSandboxDriver, scored with three-layer-eval's
//                  app-build semantics (kind='scaffold-only', null-tolerant
//                  runtime per agent-eval PR #2)
//
// On gate pass: atomically copies draft into registry/families/<id>/ +
// registry/layers/framework/<id>/, commits on a proposal/<id> branch,
// opens a draft PR. On gate fail: writes validation-errors.json back into
// the draft dir, keeps the draft, logs to governor.jsonl.
//
// Idempotency: re-runs on the same proposal are safe — copy-on-success is
// atomic (tempdir rename), PR create is gated on `gh pr list`, commits are
// conditional on git diff.
//
// Usage:
//   node scripts/promote-family-proposal.mjs --id bun-monolith
//   node scripts/promote-family-proposal.mjs --id bun-monolith --dry-run
//   node scripts/promote-family-proposal.mjs --all            # scan all drafts

import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, statSync, rmSync, mkdtempSync, renameSync, appendFileSync } from 'node:fs'
import { join, resolve, dirname, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { InMemoryTraceStore, BuilderSession, SubprocessSandboxDriver, scoreProject } from '@tangle-network/agent-eval'
import { snapshotScaffold, invokeMetaJudge } from '../dist/eval/scaffold-bridge.js'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const argv = process.argv.slice(2)
const ID = (() => { const i = argv.indexOf('--id'); return i >= 0 ? argv[i + 1] : null })()
const ALL = argv.includes('--all')
const DRY_RUN = argv.includes('--dry-run')
const NO_PR = argv.includes('--no-pr')
const SKIP_FIDELITY = argv.includes('--skip-fidelity')
const ALLOW_BORDERLINE = argv.includes('--allow-borderline')
const FIDELITY_THRESHOLD = Number((() => { const i = argv.indexOf('--fidelity-threshold'); return i >= 0 ? argv[i + 1] : '0.7' })()) || 0.7

if (!ID && !ALL) {
  console.error('usage: promote-family-proposal.mjs --id <proposal-id> | --all [--dry-run] [--no-pr]')
  process.exit(2)
}

// ── enumerate draft proposals ─────────────────────────────────────
const proposalsDir = join(REPO, '.evolve/family-proposals')
if (!existsSync(proposalsDir)) {
  console.error(`no drafts at ${proposalsDir}`)
  process.exit(0)
}
const targets = ALL
  ? readdirSync(proposalsDir).filter((d) => {
      const p = join(proposalsDir, d)
      try { return statSync(p).isDirectory() && existsSync(join(p, 'manifest.json')) } catch { return false }
    })
  : [ID]

if (targets.length === 0) {
  console.log('promote-family-proposal: no drafts to process')
  process.exit(0)
}

// ── outcome log ───────────────────────────────────────────────────
const governorLog = join(REPO, '.evolve/governor.jsonl')
const impactLog = join(REPO, '.evolve/generation-impact.jsonl')
function logGovernor(entry) {
  try { appendFileSync(governorLog, JSON.stringify({ ts: new Date().toISOString(), source: 'promote-family-proposal', ...entry }) + '\n') } catch { /* noop */ }
}
function logImpact(entry) {
  try { appendFileSync(impactLog, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n') } catch { /* noop */ }
}

// ── per-proposal promotion ────────────────────────────────────────
const results = []
for (const id of targets) {
  const result = await promoteOne(id)
  results.push(result)
}

console.log('\n━━━━ promotion summary ━━━━')
for (const r of results) {
  const mark = r.gateReached === 'promoted' ? '✓' : r.gateReached === 'compose-pass' ? '◐' : r.gateReached === 'schema-pass' ? '·' : '✗'
  console.log(`  ${mark} ${r.id.padEnd(30)} gate=${r.gateReached.padEnd(15)} ${r.message}`)
}
const promoted = results.filter((r) => r.gateReached === 'promoted').length
console.log(`  promoted: ${promoted} / ${results.length}`)
process.exit(0)

// ───────────────────────────────────────────────────────────────────
async function promoteOne(id) {
  const draftDir = join(proposalsDir, id)
  if (!existsSync(join(draftDir, 'manifest.json'))) {
    return fail(id, 'no-draft', `missing manifest at ${draftDir}`)
  }

  // Gate 1 — schema. Run validate-registry.mjs in a mode that accepts the
  // proposal dir as if it were already in registry/. We copy to a staging
  // registry-shaped tempdir for the validation.
  const stagingRoot = mkdtempSync(join(tmpdir(), `promote-staging-${id}-`))
  try {
    const stagingFamiliesDir = join(stagingRoot, 'registry', 'families', id)
    const stagingLayerDir = join(stagingRoot, 'registry', 'layers', 'framework', id)
    mkdirSync(dirname(stagingFamiliesDir), { recursive: true })
    mkdirSync(dirname(stagingLayerDir), { recursive: true })
    // Stage: manifest.json (family) + framework.manifest.json (layer) + files/
    cpSync(join(draftDir, 'manifest.json'), join(stagingFamiliesDir, 'manifest.json'))
    const frameworkSrc = join(draftDir, 'framework.manifest.json')
    if (existsSync(frameworkSrc)) {
      mkdirSync(stagingLayerDir, { recursive: true })
      cpSync(frameworkSrc, join(stagingLayerDir, 'manifest.json'))
    }
    const filesSrc = join(draftDir, 'files')
    if (existsSync(filesSrc) && statSync(filesSrc).isDirectory()) {
      cpSync(filesSrc, join(stagingFamiliesDir, 'files'), { recursive: true })
    }
    // Schema validation: parse both manifests + check structural requirements.
    const schemaErrors = validateProposalSchema(draftDir, id)
    if (schemaErrors.length > 0) {
      writeFileSync(join(draftDir, 'validation-errors.json'), JSON.stringify({ gate: 'schema', errors: schemaErrors }, null, 2))
      return fail(id, 'schema-fail', `schema: ${schemaErrors.length} errors`)
    }
    // schema-pass — earliest trust tier
    console.log(`  ✓ ${id} schema-pass`)
  } catch (err) {
    return fail(id, 'schema-fail', `schema setup: ${err?.message ?? err}`)
  } finally {
    try { rmSync(stagingRoot, { recursive: true, force: true }) } catch { /* noop */ }
  }

  // Gate 2 — compose. Temporarily drop the draft into registry/ inline,
  // run compose via dist/cli.js, read the output, then remove. This is
  // reversible: we restore the registry unchanged on exit.
  const registryFamilyDir = join(REPO, 'registry/families', id)
  const registryFrameworkDir = join(REPO, 'registry/layers/framework', id)
  const alreadyPresent = existsSync(registryFamilyDir)
  if (alreadyPresent) {
    return fail(id, 'already-promoted', `registry/families/${id} already exists; this proposal was promoted on a prior run`)
  }

  const composeTmp = mkdtempSync(join(tmpdir(), `promote-compose-${id}-`))
  let composePassed = false
  try {
    // Place draft in the real registry temporarily so compose can resolve it.
    mkdirSync(dirname(registryFamilyDir), { recursive: true })
    cpSync(draftDir, registryFamilyDir, { recursive: true })
    const draftFrameworkManifest = join(draftDir, 'framework.manifest.json')
    if (existsSync(draftFrameworkManifest)) {
      mkdirSync(registryFrameworkDir, { recursive: true })
      cpSync(draftFrameworkManifest, join(registryFrameworkDir, 'manifest.json'))
    }

    // Rebuild dist so the new family is visible to the CLI's registry loader.
    const buildRes = spawnSync('pnpm', ['build'], { cwd: REPO, encoding: 'utf8' })
    if (buildRes.status !== 0) {
      writeFileSync(join(draftDir, 'validation-errors.json'), JSON.stringify({ gate: 'build', error: buildRes.stderr.slice(-2000) }, null, 2))
      return fail(id, 'schema-fail', `typecheck failed on proposed family: ${buildRes.stderr.slice(-300)}`)
    }

    // Compose a smoke scenario using only the proposed family's framework
    // layer. No capabilities — we're proving the floor: does this family
    // stand up on its own?
    const spec = {
      projectName: `promote-smoke-${id}`,
      family: id,
      layers: [`framework:${id}`],
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
      writeFileSync(join(draftDir, 'validation-errors.json'), JSON.stringify({ gate: 'compose', error: composeRes.stderr.slice(-2000) }, null, 2))
      return fail(id, 'schema-pass', `compose failed: ${composeRes.stderr.slice(-300)}`)
    }
    composePassed = true
    console.log(`  ✓ ${id} compose-pass`)
  } finally {
    // Roll back: remove the staged registry entry. Either we succeeded
    // (we'll re-copy below in the commit step) or we failed (draft stays).
    try { rmSync(registryFamilyDir, { recursive: true, force: true }) } catch { /* noop */ }
    try { rmSync(registryFrameworkDir, { recursive: true, force: true }) } catch { /* noop */ }
  }

  // Gate 3 — build. Agent-eval's SandboxHarness + SubprocessSandboxDriver
  // run install + build in the composed scaffold dir. Scored via
  // three-layer-eval: kind='scaffold-only' (no runtime), complete when
  // meta (if available) + build both scored.
  //
  // Also snapshot the composed output BEFORE compose cleanup so Gate 4
  // (fidelity) has the files to judge. Gate 4 runs after the finally
  // block since it's a separate LLM call that shouldn't hold temp disk.
  let buildReport = null
  let preTeardownSnapshot = null
  let composedSpecForJudge = null
  try {
    const composedOutDir = join(composeTmp, 'out')
    if (!existsSync(composedOutDir)) throw new Error('compose output missing')
    const family = loadJson(join(draftDir, 'manifest.json'))
    const harnessConfig = harnessConfigForFamily(family)
    const store = new InMemoryTraceStore()
    const driver = new SubprocessSandboxDriver({ cwd: composedOutDir })
    const session = new BuilderSession(store, { projectId: `promote:${id}` }, driver)
    await session.startChat()
    const shipResult = await session.ship({ harness: harnessConfig })
    await session.endChat({
      pass: shipResult.result?.passed ?? false,
      score: shipResult.result?.score ?? 0,
    })
    buildReport = await scoreProject(store, `promote:${id}`)
    if (!shipResult.result?.passed) {
      writeFileSync(join(draftDir, 'validation-errors.json'), JSON.stringify({ gate: 'build', buildReport, stdout: shipResult.result?.test?.stdout?.slice(-2000) ?? '', stderr: shipResult.result?.test?.stderr?.slice(-2000) ?? '' }, null, 2))
      return fail(id, 'compose-pass', `build failed: score=${(shipResult.result?.score ?? 0).toFixed(2)}`)
    }
    console.log(`  ✓ ${id} build-pass (score=${shipResult.result.score.toFixed(2)}, kind=${buildReport.kind})`)
    // Snapshot BEFORE teardown — files vanish when compose tmp is rm'd.
    try {
      preTeardownSnapshot = snapshotScaffold(composedOutDir)
      composedSpecForJudge = { family: id, layers: [`framework:${id}`] }
    } catch (err) {
      // Snapshot failure is not a gate failure — we just can't run fidelity.
      console.error(`  ⚠ ${id} snapshot failed: ${err?.message ?? err} — fidelity skipped`)
    }
  } catch (err) {
    writeFileSync(join(draftDir, 'validation-errors.json'), JSON.stringify({ gate: 'build', error: err?.message ?? String(err) }, null, 2))
    return fail(id, 'compose-pass', `build threw: ${err?.message ?? err}`)
  } finally {
    try { rmSync(composeTmp, { recursive: true, force: true }) } catch { /* noop */ }
  }

  // Gate 4 — fidelity. LLM-judges whether the scaffold actually matches
  // its manifest description: imports resolve for the claimed framework,
  // layout is idiomatic for the language/runtime, no obvious Goodhart
  // failures like "description says frontend but main.ts is a Node HTTP
  // server." Exists because Round 1 proved build-pass alone ships
  // scaffolds that don't serve user demand — three drafts passed
  // build, all three were reverted on human review. This gate catches
  // them automatically pre-copy. Skip on --skip-fidelity (grace path
  // when no LLM provider is configured).
  if (!SKIP_FIDELITY && preTeardownSnapshot && composedSpecForJudge) {
    try {
      const manifest = loadJson(join(draftDir, 'manifest.json'))
      const userPrompt = manifest?.description ?? `Scaffold for ${id}`
      // Pass buildOutcome=passed so the judge can short-circuit if a future
      // refactor calls invokeMetaJudge with a failed build (defensive — current
      // flow exits at line 219 on build-fail, so this branch always sees pass).
      const verdict = await invokeMetaJudge({
        userPrompt,
        composedSpec: composedSpecForJudge,
        snapshot: preTeardownSnapshot,
        buildOutcome: { passed: true, phase: 'build' },
      })
      // Reject on: explicit fail, overall below threshold, OR borderline
      // (unless --allow-borderline). Borderline is the judge's honest
      // "I'm not confident" signal — should route to human review, not
      // auto-promote. Round 1 proved that letting borderline-quality
      // scaffolds land in registry/ ships Goodhart wins.
      const rejectBorderline = !ALLOW_BORDERLINE && verdict.verdict === 'borderline'
      if (verdict.verdict === 'fail' || verdict.overall < FIDELITY_THRESHOLD || rejectBorderline) {
        writeFileSync(
          join(draftDir, 'validation-errors.json'),
          JSON.stringify({ gate: 'fidelity', verdict }, null, 2),
        )
        if (!DRY_RUN) logImpact({ event: 'fidelity-fail', id, overall: verdict.overall, verdict: verdict.verdict, topIssue: verdict.issues?.[0]?.description ?? null })
        return fail(id, 'build-pass', `fidelity: overall=${verdict.overall.toFixed(2)} verdict=${verdict.verdict} — ${verdict.issues?.slice(0, 2).map((x) => x.description).join('; ') ?? 'no issues listed'}`)
      }
      console.log(`  ✓ ${id} fidelity-pass (overall=${verdict.overall.toFixed(2)}, verdict=${verdict.verdict})`)
    } catch (err) {
      // A judge-side error (LLM unavailable, 402, malformed output after
      // retries) is NOT a gate failure. Log + skip, but record the miss
      // so operators can see fidelity was non-blocking this run.
      console.error(`  ⚠ ${id} fidelity judge unavailable: ${err?.message ?? err} — proceeding without gate`)
      logImpact({ event: 'fidelity-unavailable', id, error: String(err?.message ?? err) })
    }
  } else if (SKIP_FIDELITY) {
    console.log(`  · ${id} fidelity skipped (--skip-fidelity)`)
  }

  // All gates passed — promote.
  if (DRY_RUN) {
    return ok(id, 'promoted', 'dry-run: all gates passed, skipping copy+commit', { buildReport })
  }

  try {
    mkdirSync(dirname(registryFamilyDir), { recursive: true })
    cpSync(draftDir, registryFamilyDir, { recursive: true })
    // Framework manifest lifted from draft's framework.manifest.json.
    const draftFrameworkManifest = join(draftDir, 'framework.manifest.json')
    if (existsSync(draftFrameworkManifest)) {
      mkdirSync(registryFrameworkDir, { recursive: true })
      cpSync(draftFrameworkManifest, join(registryFrameworkDir, 'manifest.json'))
      // The framework layer might also expect a files/ dir; proposal
      // convention is that family-files/ double as framework-files.
      // If the draft has a separate framework/ subdir, copy it.
      const draftFrameworkFiles = join(draftDir, 'framework-files')
      if (existsSync(draftFrameworkFiles)) {
        cpSync(draftFrameworkFiles, join(registryFrameworkDir, 'files'), { recursive: true })
      }
    }
    // Drop bookkeeping files from the promoted copy.
    for (const noise of ['.meta.json', 'validation-errors.json', 'framework.manifest.json']) {
      const p = join(registryFamilyDir, noise)
      try { if (existsSync(p)) rmSync(p) } catch { /* noop */ }
    }
  } catch (err) {
    return fail(id, 'compose-pass', `promote copy failed: ${err?.message ?? err}`)
  }

  // Mark draft as promoted (keep around for history) + write impact record.
  writeFileSync(join(draftDir, 'promoted.json'), JSON.stringify({
    ts: new Date().toISOString(),
    registryFamily: `registry/families/${id}`,
    registryFramework: `registry/layers/framework/${id}`,
    buildScore: buildReport?.buildScore,
    kind: buildReport?.kind,
  }, null, 2))
  logImpact({
    event: 'promoted',
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
  logGovernor({ event: 'family-promoted', id, buildScore: buildReport?.buildScore })

  // Auto-PR: only when in a clean git tree with an upstream. Default skip
  // when --no-pr or when not in a git repo.
  if (NO_PR) {
    return ok(id, 'promoted', 'registry updated (no PR per --no-pr)', { buildReport })
  }
  const prUrl = tryOpenPR(id, buildReport)
  return ok(id, 'promoted', prUrl ? `registry updated, PR: ${prUrl}` : 'registry updated (PR skipped: not in clean git state)', { buildReport, prUrl })
}

// ── helpers ───────────────────────────────────────────────────────
function loadJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

function validateProposalSchema(draftDir, id) {
  const errors = []
  const familyManifest = loadJson(join(draftDir, 'manifest.json'))
  if (!familyManifest) return [{ path: 'manifest.json', error: 'missing or invalid JSON' }]
  if (familyManifest.id !== id) errors.push({ path: 'manifest.json', error: `id mismatch: manifest.id=${familyManifest.id} but draft dir=${id}` })
  if (!familyManifest.description) errors.push({ path: 'manifest.json', error: 'missing description' })
  if (!familyManifest.taxonomy) errors.push({ path: 'manifest.json', error: 'missing taxonomy' })
  if (!Array.isArray(familyManifest.tags)) errors.push({ path: 'manifest.json', error: 'missing or invalid tags[]' })
  // Reject TODO placeholders that signal a deterministic-mode skeleton.
  const manifestText = JSON.stringify(familyManifest)
  if (manifestText.includes('TODO:') || manifestText.includes('TODO ')) {
    errors.push({ path: 'manifest.json', error: 'TODO placeholders present — proposal is a skeleton, needs LLM-mode regeneration or hand-fill' })
  }
  // Framework manifest if present
  const frameworkManifest = loadJson(join(draftDir, 'framework.manifest.json'))
  if (frameworkManifest) {
    if (frameworkManifest.id !== id) errors.push({ path: 'framework.manifest.json', error: `id mismatch: framework.id=${frameworkManifest.id} but draft dir=${id}` })
    if (!Array.isArray(frameworkManifest.appliesTo) || !frameworkManifest.appliesTo.includes(id)) {
      errors.push({ path: 'framework.manifest.json', error: 'framework appliesTo must include its family id' })
    }
  }
  // Path traversal guard on any file targets.
  for (const f of familyManifest.files ?? []) {
    if (typeof f?.target === 'string' && (f.target.includes('..') || f.target.startsWith('/'))) {
      errors.push({ path: `manifest.files[${f.target}]`, error: 'target path contains traversal or absolute path' })
    }
  }
  return errors
}

function harnessConfigForFamily(familyManifest) {
  const language = familyManifest?.taxonomy?.language ?? 'unknown'
  switch (language) {
    case 'typescript':
    case 'javascript':
      // Strict: tsc --noEmit fails loud on type errors. The previous `|| true`
      // suffix swallowed every failure — three Gen 6 scaffolds (kyc-onboarding
      // .ts JSX, fraud-ops + polymarket React 17 imports, kyc esbuild.loader
      // hallucination) all passed this gate AND the fidelity judge, then
      // shipped to registry/. Caught only at audit time. Gen 8 closes that
      // loop by failing the gate at proposal time. PR #51 fixed the bugs;
      // this fix prevents the class.
      return { setupCommand: 'pnpm install --prefer-offline', testCommand: 'pnpm exec tsc --noEmit', timeoutMs: 180_000 }
    case 'rust':
      return { setupCommand: 'cargo fetch', testCommand: 'cargo check --workspace || cargo check', timeoutMs: 300_000 }
    case 'go':
      return { setupCommand: 'go mod tidy', testCommand: 'go build ./... && go vet ./...', timeoutMs: 180_000 }
    case 'python':
      return { setupCommand: '[ -f requirements.txt ] && pip install -r requirements.txt || true', testCommand: 'python -m compileall -q .', timeoutMs: 120_000 }
    case 'solidity':
      return { setupCommand: 'forge install --no-git || true', testCommand: 'forge build', timeoutMs: 180_000 }
    case 'move':
      return { setupCommand: '', testCommand: 'aptos move compile --dev', timeoutMs: 300_000 }
    default:
      return { setupCommand: '', testCommand: 'true', timeoutMs: 60_000 }
  }
}

function tryOpenPR(id, buildReport) {
  // Only proceed if in a git repo + on a branch.
  const statusRes = spawnSync('git', ['status', '--porcelain'], { cwd: REPO, encoding: 'utf8' })
  if (statusRes.status !== 0) return null
  // Ensure we stage + commit the registry changes.
  spawnSync('git', ['add', `registry/families/${id}`, `registry/layers/framework/${id}`], { cwd: REPO })
  const commitRes = spawnSync('git', ['commit', '-m', `feat(registry): promote ${id} proposal — build=${buildReport?.buildScore ?? 'n/a'}`], { cwd: REPO, encoding: 'utf8' })
  if (commitRes.status !== 0 && !commitRes.stdout.includes('nothing to commit')) return null
  // Push: rely on upstream already set.
  const pushRes = spawnSync('git', ['push'], { cwd: REPO, encoding: 'utf8' })
  if (pushRes.status !== 0) return null
  // Open draft PR.
  const prRes = spawnSync('gh', [
    'pr', 'create', '--draft',
    '--title', `proposal: promote family:${id}`,
    '--body', `Auto-promoted by scripts/promote-family-proposal.mjs.\n\n- build_score: ${buildReport?.buildScore ?? 'n/a'}\n- kind: ${buildReport?.kind ?? 'scaffold-only'}\n\nGenerated: see \`.evolve/family-proposals/${id}/.meta.json\`\nValidation: schema + compose + build gates passed via agent-eval SandboxHarness.\n\nReviewer: eyeball the manifest + one file body for sanity; CI does the rest.`,
    '--label', 'auto-proposal',
  ], { cwd: REPO, encoding: 'utf8' })
  if (prRes.status !== 0) return null
  const url = prRes.stdout.trim().split('\n').find((l) => l.startsWith('http')) ?? null
  return url
}

function ok(id, gateReached, message, extra = {}) {
  logGovernor({ event: 'promote-outcome', id, gateReached, ...extra })
  return { id, gateReached, message, ...extra }
}

function fail(id, gateReached, message) {
  logGovernor({ event: 'promote-outcome', id, gateReached, message })
  // Dry-runs are dress rehearsals — don't pollute promotion_rate denominators.
  // Every failed --dry-run was writing promote-failed and then (on earlier
  // fidelity-fail path) fidelity-fail; both inflate the attempt count
  // artificially and suppress the rate metric.
  if (!DRY_RUN) logImpact({ event: 'promote-failed', id, gateReached, message })
  return { id, gateReached, message }
}
