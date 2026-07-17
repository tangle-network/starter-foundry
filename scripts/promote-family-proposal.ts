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
//   node scripts/promote-family-proposal.ts --id bun-monolith
//   node scripts/promote-family-proposal.ts --id bun-monolith --dry-run
//   node scripts/promote-family-proposal.ts --all            # scan all drafts

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  cpSync,
  readdirSync,
  statSync,
  rmSync,
  mkdtempSync,
  renameSync,
  appendFileSync,
} from 'node:fs'
import { join, resolve, dirname, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  InMemoryTraceStore,
  SandboxHarness,
  SubprocessSandboxDriver,
  TraceEmitter,
  RunCritic,
} from '@tangle-network/agent-eval'
import { snapshotScaffold, invokeMetaJudge, HARNESS_CONFIGS } from '../dist/eval/scaffold-bridge.js'
import {
  checkDeclaredDepUsed,
  checkScaffoldRuns,
  checkEvalScores,
} from '../dist/lib/promoter-gates.js'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const argv = process.argv.slice(2)
const ID = (() => {
  const i = argv.indexOf('--id')
  return i >= 0 ? argv[i + 1] : null
})()
const ALL = argv.includes('--all')
const DRY_RUN = argv.includes('--dry-run')
const NO_PR = argv.includes('--no-pr')
const SKIP_FIDELITY = argv.includes('--skip-fidelity')
const ALLOW_BORDERLINE = argv.includes('--allow-borderline')
const FIDELITY_THRESHOLD =
  Number(
    (() => {
      const i = argv.indexOf('--fidelity-threshold')
      return i >= 0 ? argv[i + 1] : '0.7'
    })(),
  ) || 0.7

if (!ID && !ALL) {
  console.error(
    'usage: promote-family-proposal.mjs --id <proposal-id> | --all [--dry-run] [--no-pr]',
  )
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
      try {
        return statSync(p).isDirectory() && existsSync(join(p, 'manifest.json'))
      } catch {
        return false
      }
    })
  : [ID]

if (targets.length === 0) {
  console.log('\n━━━━ promotion summary ━━━━')
  console.log('  promoted: 0 / 0 (no drafts to process)')
  process.exit(0)
}

// ── outcome log ───────────────────────────────────────────────────
const governorLog = join(REPO, '.evolve/governor.jsonl')
const impactLog = join(REPO, '.evolve/generation-impact.jsonl')
function logGovernor(entry) {
  try {
    appendFileSync(
      governorLog,
      JSON.stringify({
        ts: new Date().toISOString(),
        source: 'promote-family-proposal',
        ...entry,
      }) + '\n',
    )
  } catch {
    /* noop */
  }
}
function logImpact(entry) {
  // Test runs of the promoter pollute generation-impact.jsonl with
  // fixture-driven failures ("missing manifest", "schema errors" on
  // intentionally-broken drafts, idempotency retries on known-good drafts).
  // That polluted denominator tanks proposal_promotion_rate from the real
  // ~54% to a scorecard-visible ~3.4%. Tests set STARTER_FOUNDRY_SYNTHETIC_RUN=1
  // to no-op this write; production runs don't.
  if (process.env.STARTER_FOUNDRY_SYNTHETIC_RUN === '1') return
  try {
    appendFileSync(impactLog, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n')
  } catch {
    /* noop */
  }
}

// ── per-proposal promotion ────────────────────────────────────────
const results = []
for (const id of targets) {
  const result = await promoteOne(id)
  results.push(result)
}

console.log('\n━━━━ promotion summary ━━━━')
for (const r of results) {
  const mark =
    r.gateReached === 'promoted'
      ? '✓'
      : r.gateReached === 'compose-pass'
        ? '◐'
        : r.gateReached === 'schema-pass'
          ? '·'
          : '✗'
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
      writeFileSync(
        join(draftDir, 'validation-errors.json'),
        JSON.stringify({ gate: 'schema', errors: schemaErrors }, null, 2),
      )
      return fail(id, 'schema-fail', `schema: ${schemaErrors.length} errors`)
    }
    // schema-pass — earliest trust tier
    console.log(`  ✓ ${id} schema-pass`)
  } catch (err) {
    return fail(id, 'schema-fail', `schema setup: ${err?.message ?? err}`)
  } finally {
    try {
      rmSync(stagingRoot, { recursive: true, force: true })
    } catch {
      /* noop */
    }
  }

  // Gate 2 — compose. Temporarily drop the draft into registry/ inline,
  // run compose via dist/cli.js, read the output, then remove. This is
  // reversible: we restore the registry unchanged on exit.
  const registryFamilyDir = join(REPO, 'registry/families', id)
  const registryFrameworkDir = join(REPO, 'registry/layers/framework', id)
  const alreadyPresent = existsSync(registryFamilyDir)
  if (alreadyPresent) {
    return fail(
      id,
      'already-promoted',
      `registry/families/${id} already exists; this proposal was promoted on a prior run`,
    )
  }

  const composeTmp = mkdtempSync(join(tmpdir(), `promote-compose-${id}-`))
  let composePassed = false
  // Markdown-only bundles (taxonomy.language='markdown', surface='agent-runtime')
  // carry their files[] directly on the family manifest and have NO
  // registry/layers/framework/<id>/ counterpart. The `framework.manifest.json`
  // in the draft is either absent or a stub with `files: []`. Composing with
  // `layers: [framework:<id>]` for these throws `Unknown layer framework:<id>`
  // because we (correctly) refuse to stage an empty framework layer. Detect
  // here and route to layers:[] for markdown-only.
  const draftFamily = loadJson(join(draftDir, 'manifest.json'))
  const isMarkdownOnly = isMarkdownOnlyBundle(draftDir, draftFamily)
  const composedLayers: string[] = isMarkdownOnly ? [] : [`framework:${id}`]
  try {
    // Place draft in the real registry temporarily so compose can resolve it.
    mkdirSync(dirname(registryFamilyDir), { recursive: true })
    cpSync(draftDir, registryFamilyDir, { recursive: true })
    const draftFrameworkManifest = join(draftDir, 'framework.manifest.json')
    if (!isMarkdownOnly && existsSync(draftFrameworkManifest)) {
      mkdirSync(registryFrameworkDir, { recursive: true })
      cpSync(draftFrameworkManifest, join(registryFrameworkDir, 'manifest.json'))
    }

    // Rebuild dist so the new family is visible to the CLI's registry loader.
    const buildRes = spawnSync('pnpm', ['build'], { cwd: REPO, encoding: 'utf8' })
    if (buildRes.status !== 0) {
      writeFileSync(
        join(draftDir, 'validation-errors.json'),
        JSON.stringify({ gate: 'build', error: buildRes.stderr.slice(-2000) }, null, 2),
      )
      return fail(
        id,
        'schema-fail',
        `typecheck failed on proposed family: ${buildRes.stderr.slice(-300)}`,
      )
    }

    // Compose a smoke scenario using only the proposed family's framework
    // layer (or no layers, for markdown-only bundles whose files[] is on the
    // family manifest itself). No capabilities — we're proving the floor:
    // does this family stand up on its own?
    const spec = {
      projectName: `promote-smoke-${id}`,
      family: id,
      layers: composedLayers,
      partner: null,
      slots: {},
      variables: {},
    }
    const specPath = join(composeTmp, 'spec.json')
    writeFileSync(specPath, JSON.stringify(spec))
    const composeRes = spawnSync(
      'node',
      ['dist/cli.js', 'compose', '--spec', specPath, '--out', join(composeTmp, 'out'), '--json'],
      {
        cwd: REPO,
        encoding: 'utf8',
      },
    )
    if (composeRes.status !== 0) {
      writeFileSync(
        join(draftDir, 'validation-errors.json'),
        JSON.stringify({ gate: 'compose', error: composeRes.stderr.slice(-2000) }, null, 2),
      )
      return fail(id, 'schema-pass', `compose failed: ${composeRes.stderr.slice(-300)}`)
    }
    composePassed = true
    console.log(`  ✓ ${id} compose-pass`)
  } finally {
    // Roll back: remove the staged registry entry. Either we succeeded
    // (we'll re-copy below in the commit step) or we failed (draft stays).
    try {
      rmSync(registryFamilyDir, { recursive: true, force: true })
    } catch {
      /* noop */
    }
    try {
      rmSync(registryFrameworkDir, { recursive: true, force: true })
    } catch {
      /* noop */
    }
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
    // CRITICAL: SubprocessSandboxDriver.exec reads cwd from the per-call
    // HarnessConfig, not the constructor. Pre-Gen-8b we passed cwd to the
    // constructor (silently ignored) and the testCommand ran in
    // starter-foundry's working dir — where `tsc --noEmit` always passes.
    // That's why the strict gate from Gen 8 didn't actually catch broken
    // scaffolds in end-to-end testing. Set cwd on the harness instead.
    const harnessConfig = { ...harnessConfigForFamily(family), cwd: composedOutDir }
    const store = new InMemoryTraceStore()
    const driver = new SubprocessSandboxDriver()
    const harness = new SandboxHarness(driver)
    const emitter = new TraceEmitter(store)
    const run = await emitter.startRun({ projectId: `promote:${id}`, layer: 'app-build' })
    const harnessResult = await harness.run(harnessConfig, emitter)
    await emitter.endRun({
      pass: harnessResult.passed,
      score: harnessResult.score,
    })
    const shipResult = { result: harnessResult }
    const critic = new RunCritic()
    const critScore = await critic.score(store, run.runId)
    buildReport = {
      kind: 'scaffold-only' as const,
      buildScore: harnessResult.score,
      complete: harnessResult.passed,
      runScore: critScore,
    }
    if (!shipResult.result?.passed) {
      writeFileSync(
        join(draftDir, 'validation-errors.json'),
        JSON.stringify(
          {
            gate: 'build',
            buildReport,
            stdout: shipResult.result?.test?.stdout?.slice(-2000) ?? '',
            stderr: shipResult.result?.test?.stderr?.slice(-2000) ?? '',
          },
          null,
          2,
        ),
      )
      return fail(
        id,
        'compose-pass',
        `build failed: score=${(shipResult.result?.score ?? 0).toFixed(2)}`,
      )
    }
    console.log(
      `  ✓ ${id} build-pass (score=${shipResult.result.score.toFixed(2)}, kind=${buildReport.kind})`,
    )
    // Snapshot BEFORE teardown — files vanish when compose tmp is rm'd.
    try {
      preTeardownSnapshot = snapshotScaffold(composedOutDir)
      composedSpecForJudge = { family: id, layers: composedLayers }
    } catch (err) {
      // Snapshot failure is not a gate failure — we just can't run fidelity.
      console.error(`  ⚠ ${id} snapshot failed: ${err?.message ?? err} — fidelity skipped`)
    }

    // ── Gen 9 dogfood gates (declared-dep-used / scaffold-runs / eval-scores).
    // These run AFTER build-pass and BEFORE fidelity. They catch the
    // class of bug a compile-gate can't: declared-but-unused deps,
    // scaffolds that compile but don't boot, and "ships with eval"
    // capabilities whose own eval would fail. See src/lib/promoter-gates.ts.
    const dogfoodOutcome = await runDogfoodGates({
      id,
      draftDir,
      composedOutDir,
      manifest: family,
      composedLayers,
    })
    if (dogfoodOutcome.failure) return dogfoodOutcome.failure
  } catch (err) {
    writeFileSync(
      join(draftDir, 'validation-errors.json'),
      JSON.stringify({ gate: 'build', error: err?.message ?? String(err) }, null, 2),
    )
    return fail(id, 'compose-pass', `build threw: ${err?.message ?? err}`)
  } finally {
    try {
      rmSync(composeTmp, { recursive: true, force: true })
    } catch {
      /* noop */
    }
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
        if (!DRY_RUN)
          logImpact({
            event: 'fidelity-fail',
            id,
            overall: verdict.overall,
            verdict: verdict.verdict,
            topIssue: verdict.issues?.[0]?.description ?? null,
          })
        return fail(
          id,
          'build-pass',
          `fidelity: overall=${verdict.overall.toFixed(2)} verdict=${verdict.verdict} — ${
            verdict.issues
              ?.slice(0, 2)
              .map((x) => x.description)
              .join('; ') ?? 'no issues listed'
          }`,
        )
      }
      console.log(
        `  ✓ ${id} fidelity-pass (overall=${verdict.overall.toFixed(2)}, verdict=${verdict.verdict})`,
      )
    } catch (err) {
      // A judge-side error (LLM unavailable, 402, malformed output after
      // retries) is NOT a gate failure. Log + skip, but record the miss
      // so operators can see fidelity was non-blocking this run.
      console.error(
        `  ⚠ ${id} fidelity judge unavailable: ${err?.message ?? err} — proceeding without gate`,
      )
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
    // Skipped for markdown-only bundles (taxonomy.language='markdown' /
    // surface='agent-runtime') — they carry files[] on the family manifest
    // itself and have no separate framework layer; staging an empty layer
    // here would create dead registry entries that compose ignores.
    const draftFrameworkManifest = join(draftDir, 'framework.manifest.json')
    if (!isMarkdownOnly && existsSync(draftFrameworkManifest)) {
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
      try {
        if (existsSync(p)) rmSync(p)
      } catch {
        /* noop */
      }
    }
  } catch (err) {
    return fail(id, 'compose-pass', `promote copy failed: ${err?.message ?? err}`)
  }

  // Mark draft as promoted (keep around for history) + write impact record.
  writeFileSync(
    join(draftDir, 'promoted.json'),
    JSON.stringify(
      {
        ts: new Date().toISOString(),
        registryFamily: `registry/families/${id}`,
        registryFramework: `registry/layers/framework/${id}`,
        buildScore: buildReport?.buildScore,
        kind: buildReport?.kind,
      },
      null,
      2,
    ),
  )
  logImpact({
    event: 'promoted',
    id,
    buildScore: buildReport?.buildScore,
    draftAgeHours: (() => {
      try {
        const meta = loadJson(join(draftDir, '.meta.json'))
        if (!meta?.generatedAt) return null
        return Number(((Date.now() - Date.parse(meta.generatedAt)) / 3_600_000).toFixed(1))
      } catch {
        return null
      }
    })(),
  })
  logGovernor({ event: 'family-promoted', id, buildScore: buildReport?.buildScore })

  // Auto-PR: only when in a clean git tree with an upstream. Default skip
  // when --no-pr or when not in a git repo.
  if (NO_PR) {
    return ok(id, 'promoted', 'registry updated (no PR per --no-pr)', { buildReport })
  }
  const prUrl = tryOpenPR(id, buildReport)
  return ok(
    id,
    'promoted',
    prUrl
      ? `registry updated, PR: ${prUrl}`
      : 'registry updated (PR skipped: not in clean git state)',
    { buildReport, prUrl },
  )
}

// ── helpers ───────────────────────────────────────────────────────
function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Markdown-only bundles (the agent-runtime family pattern) carry their
 * files[] directly on the family manifest and have no companion entry
 * under registry/layers/framework/<id>/. Detection is conservative: any
 * one of the three signals below is enough.
 *
 *   1. taxonomy.language === 'markdown' OR taxonomy.surface === 'agent-runtime'
 *   2. framework.manifest.json missing
 *   3. framework.manifest.json present but its files[] is empty
 *
 * For these, the compose smoke must use `layers: []` — there is no
 * `framework:<id>` layer to resolve.
 */
function isMarkdownOnlyBundle(draftDir, familyManifest) {
  const taxonomy = familyManifest?.taxonomy ?? {}
  if (taxonomy.language === 'markdown') return true
  if (taxonomy.surface === 'agent-runtime') return true
  const fwPath = join(draftDir, 'framework.manifest.json')
  if (!existsSync(fwPath)) return true
  const fw = loadJson(fwPath)
  if (!fw) return true
  if (!Array.isArray(fw.files) || fw.files.length === 0) return true
  return false
}

function validateProposalSchema(draftDir, id) {
  const errors = []
  const familyManifest = loadJson(join(draftDir, 'manifest.json'))
  if (!familyManifest) return [{ path: 'manifest.json', error: 'missing or invalid JSON' }]
  if (familyManifest.id !== id)
    errors.push({
      path: 'manifest.json',
      error: `id mismatch: manifest.id=${familyManifest.id} but draft dir=${id}`,
    })
  if (!familyManifest.description)
    errors.push({ path: 'manifest.json', error: 'missing description' })
  if (!familyManifest.taxonomy) errors.push({ path: 'manifest.json', error: 'missing taxonomy' })
  if (!Array.isArray(familyManifest.tags))
    errors.push({ path: 'manifest.json', error: 'missing or invalid tags[]' })
  // Reject TODO placeholders that signal a deterministic-mode skeleton.
  const manifestText = JSON.stringify(familyManifest)
  if (manifestText.includes('TODO:') || manifestText.includes('TODO ')) {
    errors.push({
      path: 'manifest.json',
      error:
        'TODO placeholders present — proposal is a skeleton, needs LLM-mode regeneration or hand-fill',
    })
  }
  // Framework manifest if present
  const frameworkManifest = loadJson(join(draftDir, 'framework.manifest.json'))
  if (frameworkManifest) {
    if (frameworkManifest.id !== id)
      errors.push({
        path: 'framework.manifest.json',
        error: `id mismatch: framework.id=${frameworkManifest.id} but draft dir=${id}`,
      })
    if (!Array.isArray(frameworkManifest.appliesTo) || !frameworkManifest.appliesTo.includes(id)) {
      errors.push({
        path: 'framework.manifest.json',
        error: 'framework appliesTo must include its family id',
      })
    }
  }
  // Path traversal guard on any file targets.
  for (const f of familyManifest.files ?? []) {
    if (typeof f?.target === 'string' && (f.target.includes('..') || f.target.startsWith('/'))) {
      errors.push({
        path: `manifest.files[${f.target}]`,
        error: 'target path contains traversal or absolute path',
      })
    }
  }
  return errors
}

function harnessConfigForFamily(familyManifest) {
  // Single source of truth: HARNESS_CONFIGS from scaffold-bridge. Gen 9
  // centralized the per-language dispatch to eliminate the drift surface
  // where Gen 8b had to fix three copies of the same table and silently
  // missed the runtime one (see .evolve/patterns/muffled-gate.md).
  const language = familyManifest?.taxonomy?.language ?? 'unknown'
  const config = HARNESS_CONFIGS[language]
  if (!config) {
    throw new Error(
      `harnessConfigForFamily: unsupported taxonomy.language '${language}' for family ` +
        `${familyManifest?.id ?? '<unknown>'}. Add it to HARNESS_CONFIGS in ` +
        `src/eval/scaffold-bridge.ts (strict, fail-loud testCommand) before promoting.`,
    )
  }
  return config
}

function tryOpenPR(id, buildReport) {
  // Only proceed if in a git repo + on a branch.
  const statusRes = spawnSync('git', ['status', '--porcelain'], { cwd: REPO, encoding: 'utf8' })
  if (statusRes.status !== 0) return null
  // Ensure we stage + commit the registry changes. The framework layer
  // path is only present for non-markdown-only bundles; skip it when
  // it doesn't exist so `git add` doesn't error on a missing pathspec.
  const stagePaths = [`registry/families/${id}`]
  if (existsSync(join(REPO, `registry/layers/framework/${id}`))) {
    stagePaths.push(`registry/layers/framework/${id}`)
  }
  spawnSync('git', ['add', ...stagePaths], { cwd: REPO })
  const commitRes = spawnSync(
    'git',
    [
      'commit',
      '-m',
      `feat(registry): promote ${id} proposal — build=${buildReport?.buildScore ?? 'n/a'}`,
    ],
    { cwd: REPO, encoding: 'utf8' },
  )
  if (commitRes.status !== 0 && !commitRes.stdout.includes('nothing to commit')) return null
  // Push: rely on upstream already set.
  const pushRes = spawnSync('git', ['push'], { cwd: REPO, encoding: 'utf8' })
  if (pushRes.status !== 0) return null
  // Open draft PR.
  const prRes = spawnSync(
    'gh',
    [
      'pr',
      'create',
      '--draft',
      '--title',
      `proposal: promote family:${id}`,
      '--body',
      `Auto-promoted by scripts/promote-family-proposal.ts.\n\n- build_score: ${buildReport?.buildScore ?? 'n/a'}\n- kind: ${buildReport?.kind ?? 'scaffold-only'}\n\nGenerated: see \`.evolve/family-proposals/${id}/.meta.json\`\nValidation: schema + compose + build gates passed via agent-eval SandboxHarness.\n\nReviewer: eyeball the manifest + one file body for sanity; CI does the rest.`,
      '--label',
      'auto-proposal',
    ],
    { cwd: REPO, encoding: 'utf8' },
  )
  if (prRes.status !== 0) return null
  const url =
    prRes.stdout
      .trim()
      .split('\n')
      .find((l) => l.startsWith('http')) ?? null
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

/**
 * Run the Gen 9 dogfood gates (declared-dep-used / scaffold-runs /
 * eval-scores) on an already-built composed scaffold. Returns
 * `{ failure }` where `failure` is a fail() return value if any gate
 * tripped, else `{ failure: null }`.
 *
 * Gate 2 keeps the process running so gate 3 can reuse it; the process
 * is SIGTERM'd before returning regardless of outcome.
 */
async function runDogfoodGates({ id, draftDir, composedOutDir, manifest, composedLayers }) {
  // Gate 1: declared-dep-used. Structural — no subprocess.
  const depUsed = checkDeclaredDepUsed({ manifest, composedDir: composedOutDir })
  if (depUsed.status === 'fail') {
    writeFileSync(join(draftDir, 'validation-errors.json'), JSON.stringify(depUsed, null, 2))
    return {
      failure: fail(
        id,
        'declared-dep-used',
        depUsed.message ?? `unused deps: ${(depUsed.unusedDeps ?? []).join(', ')}`,
      ),
    }
  }
  console.log(
    `  ${depUsed.status === 'pass' ? '✓' : '·'} ${id} declared-dep-used: ${depUsed.status}${depUsed.status === 'skipped' ? ` (${depUsed.reason})` : ''}`,
  )

  // Gate 2: scaffold-runs. Boots the agent if the scaffold declares `start`.
  const composesAgentEval = composedLayers.some(
    (l) => l === 'capability:agent-eval' || l.endsWith(':agent-eval'),
  )
  const runsResult = await checkScaffoldRuns({
    composedDir: composedOutDir,
    manifest,
    options: { keepProcess: composesAgentEval },
  })
  if (runsResult.status === 'fail') {
    writeFileSync(
      join(draftDir, 'validation-errors.json'),
      JSON.stringify({ ...runsResult, process: undefined }, null, 2),
    )
    return {
      failure: fail(
        id,
        'scaffold-runs',
        runsResult.message ?? runsResult.reason ?? 'scaffold failed to boot',
      ),
    }
  }
  console.log(
    `  ${runsResult.status === 'pass' ? '✓' : '·'} ${id} scaffold-runs: ${runsResult.status}${runsResult.status === 'skipped' ? ` (${runsResult.reason})` : ''}`,
  )

  // Gate 3: eval-scores. Only if the scaffold composed capability:agent-eval
  // AND gate 2 handed back a live process.
  try {
    if (runsResult.status === 'pass' && composesAgentEval && runsResult.port) {
      const evalResult = await checkEvalScores({
        composedDir: composedOutDir,
        manifest,
        composedLayers,
        options: { port: runsResult.port },
      })
      if (evalResult.status === 'fail') {
        writeFileSync(join(draftDir, 'validation-errors.json'), JSON.stringify(evalResult, null, 2))
        return {
          failure: fail(
            id,
            'eval-scores',
            evalResult.message ?? evalResult.reason ?? 'eval scores below threshold',
          ),
        }
      }
      console.log(
        `  ${evalResult.status === 'pass' ? '✓' : '·'} ${id} eval-scores: ${evalResult.status}${evalResult.status === 'skipped' ? ` (${evalResult.reason})` : ''}`,
      )
    }
  } finally {
    // Always SIGTERM the gate-2 process before leaving the dogfood block —
    // gate 3 (if it ran) is done; any other path means we shouldn't hold
    // the port either way.
    if (runsResult.status === 'pass' && runsResult.process) {
      try {
        runsResult.process.kill()
      } catch {
        /* noop */
      }
    }
  }
  return { failure: null }
}
