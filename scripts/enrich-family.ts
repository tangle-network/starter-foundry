#!/usr/bin/env node
// Family-level enrichment driver using agent-eval's propose/verify/review
// primitive. One shot = builder edits the family scaffold → audit composes
// + installs + typechecks → reviewer reads the audit and directs the
// next shot. Memory persisted to .evolve/review-memory/<family>.jsonl so
// a second run resumes with all prior observations intact.
//
// Strict role separation (the whole reason we adopted this primitive):
//   - propose (worker):  claude -p, file edits in registry/layers/framework/<family>/
//   - verify:            scripts/audit-scaffold-quality.ts --layer framework:<family>
//   - review:            LLM via tangle-router, JSON-only, NEVER overturns verify
//
// Usage:
//   TANGLE_API_KEY=... node scripts/enrich-family.ts --family hipaa-compliance-pack
//   node scripts/enrich-family.ts --family <id> --max-shots 3 --builder-model sonnet

import { spawnSync, spawn } from 'node:child_process'
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  cpSync,
} from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { runProposeReview, createLlmReviewer, jsonlReviewStore } from '@tangle-network/agent-eval'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
function arg(flag, fallback) {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : fallback
}
const familyId = arg('--family', null)
if (!familyId) {
  console.error('missing --family <id>')
  process.exit(2)
}
const maxShots = Number.parseInt(arg('--max-shots', '3'), 10)
const builderModel = arg('--builder-model', 'sonnet')
const reviewerModel = arg('--reviewer-model', null)
const dryRun = argv.includes('--dry-run')

// Route precedence: direct Anthropic API (best quality, unlimited) → direct
// Groq → router (rate-limited on free tier). The reviewer just needs a JSON
// reasoner; we don't need to pay router governance tax for a local driver.
function selectReviewerRoute() {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      model: reviewerModel ?? 'claude-sonnet-4-6',
      auth: {
        header: 'x-api-key',
        value: process.env.ANTHROPIC_API_KEY,
        extra: { 'anthropic-version': '2023-06-01' },
      },
      style: 'anthropic',
    }
  }
  if (process.env.GROQ_API_KEY) {
    return {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      model: reviewerModel ?? 'llama-3.3-70b-versatile',
      auth: { header: 'Authorization', value: `Bearer ${process.env.GROQ_API_KEY}` },
      style: 'openai',
    }
  }
  if (process.env.TANGLE_API_KEY) {
    return {
      url: 'https://router.tangle.tools/v1/chat/completions',
      model: reviewerModel ?? 'llama-3.1-8b-instant',
      auth: { header: 'Authorization', value: `Bearer ${process.env.TANGLE_API_KEY}` },
      style: 'openai',
    }
  }
  return null
}

const familyDir = join(REPO, 'registry/layers/framework', familyId)
if (!existsSync(familyDir)) {
  console.error(`family dir not found: ${familyDir}`)
  process.exit(2)
}

const layerId = `framework:${familyId}`
const memoryPath = join(REPO, '.evolve/review-memory', `${familyId}.jsonl`)
mkdirSync(dirname(memoryPath), { recursive: true })

const reviewerRoute = selectReviewerRoute()
if (!reviewerRoute) {
  console.error(
    'No reviewer API key available. Set ANTHROPIC_API_KEY, GROQ_API_KEY, or TANGLE_API_KEY.',
  )
  process.exit(2)
}

// ── Propose (builder) ────────────────────────────────────────────────
// Shell out to `claude -p` headless. Claude gets file tools, permission
// to edit the family directory, and the prior reviewer's instruction.
// Worker state is on disk — we return a lightweight summary of what
// changed, which feeds the reviewer's "trace summary".

function snapshotFamily() {
  const files = []
  if (!existsSync(familyDir)) return files
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const s = statSync(full)
      if (s.isDirectory()) walk(full)
      else files.push({ path: relative(familyDir, full), size: s.size })
    }
  }
  walk(familyDir)
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

function diffSnapshots(before, after) {
  const beforeMap = new Map(before.map((f) => [f.path, f.size]))
  const afterMap = new Map(after.map((f) => [f.path, f.size]))
  const added = [...afterMap.keys()].filter((p) => !beforeMap.has(p))
  const removed = [...beforeMap.keys()].filter((p) => !afterMap.has(p))
  const changed = [...afterMap.keys()].filter(
    (p) => beforeMap.has(p) && beforeMap.get(p) !== afterMap.get(p),
  )
  return { added, removed, changed }
}

async function propose(input) {
  const { shot, goal, priorReview } = input
  const instruction =
    priorReview?.nextShotInstruction ??
    'Make this scaffold compose cleanly: install works, typecheck passes, main entrypoint boots. Start from the manifest and build out from there.'

  const before = snapshotFamily()

  const prompt = [
    `You are the BUILDER in a propose/verify/review loop. This is shot ${shot}.`,
    ``,
    `=== GOAL ===`,
    goal,
    ``,
    `=== FAMILY ID ===`,
    familyId,
    ``,
    `=== FAMILY DIR (your workspace) ===`,
    familyDir,
    ``,
    `=== REVIEWER'S INSTRUCTION FOR THIS SHOT ===`,
    instruction,
    ``,
    `=== CONTEXT ===`,
    `This is a starter-scaffold framework LAYER. When composed into a`,
    `starter, its files/ directory is copied into the project root and`,
    `its manifest declares packageDeps, archetype signals, and first-`,
    `steps docs for AGENTS.md.`,
    ``,
    `=== LAYER MANIFEST SCHEMA (authoritative — do not invent fields) ===`,
    `Required: id (string), description (string), appliesTo (string[])`,
    `Optional: files[{source, target}], packageDeps.{dependencies|devDependencies},`,
    `         buildHints.{whenToUse, firstSteps, gotchas, architectureNotes, placeholders},`,
    `         contextHints.{commands, entrypoints, preview, extensionPoints}`,
    `Do NOT add: slot, slots, name, deps, src, dest, tags — those belong on the`,
    `*family* manifest (registry/families/<id>/), not the layer manifest.`,
    `Reference example: registry/layers/framework/threejs-game/manifest.json.`,
    `The family this layer applies to already exists at`,
    `registry/families/${familyId}/manifest.json — read it first so you`,
    `understand what files the FAMILY supplies (don't duplicate them in the layer).`,
    ``,
    `A scaffold is "starter-grade" when:`,
    `  1. pnpm install (or cargo/uv/forge equivalent) succeeds on a clean compose`,
    `  2. typecheck passes with zero edits`,
    `  3. pnpm run build succeeds (for bundled projects) — catches dead imports, missing public assets`,
    `  4. The family's own validationChecks in registry/families/${familyId}/manifest.json all pass —`,
    `     this is ground truth. If a check says \`file-exists: src/main.ts\`, that file MUST exist in files/.`,
    `  5. manifest has a real description, correct appliesTo, and populated files[]`,
    `  6. no TODOs, no placeholder imports, no unresolved deps`,
    ``,
    `=== TASK ===`,
    `Edit files in ${familyDir} to advance the scaffold toward starter-grade.`,
    `Do NOT modify files outside that directory. Do NOT commit.`,
    `Make concrete file edits — fill manifest.files[], add files/ entries,`,
    `wire deps in manifest.packageDeps, add a README if missing.`,
    `When done, print a ONE-LINE summary of what you changed.`,
  ].join('\n')

  if (dryRun) {
    console.log('[dry-run] would invoke claude builder with prompt:')
    console.log(prompt)
    return {
      state: { familyId, familyDir },
      traceSummary: { dryRun: true, added: [], changed: [], removed: [] },
    }
  }

  const t0 = Date.now()
  const res = spawnSync(
    'claude',
    [
      '-p',
      '--permission-mode',
      'acceptEdits',
      '--model',
      builderModel,
      '--add-dir',
      familyDir,
      '--output-format',
      'text',
      prompt,
    ],
    { cwd: REPO, encoding: 'utf8', timeout: 15 * 60 * 1000 },
  )
  const dur = Date.now() - t0
  const out = (res.stdout ?? '').trim().split('\n').slice(-10).join('\n')
  if (res.status !== 0) {
    console.warn(`[propose] builder non-zero exit=${res.status} after ${dur}ms`)
  }

  const after = snapshotFamily()
  const diff = diffSnapshots(before, after)
  console.log(
    `[propose shot=${shot}] +${diff.added.length} ~${diff.changed.length} -${diff.removed.length} files (${dur}ms)`,
  )

  return {
    state: { familyId, familyDir },
    traceSummary: {
      shot,
      durationMs: dur,
      builderTail: out.slice(-800),
      added: diff.added,
      changed: diff.changed,
      removed: diff.removed,
    },
  }
}

// ── Verify (deterministic) ───────────────────────────────────────────
// Shell out to audit-scaffold-quality.mjs. The verifier has absolute
// authority on pass/fail — reviewer cannot overturn.

async function verify(_state) {
  // Rebuild dist first so the audit uses the latest compose logic.
  const build = spawnSync('pnpm', ['build'], { cwd: REPO, encoding: 'utf8' })
  if (build.status !== 0) {
    return {
      pass: false,
      failingLayers: ['starter-foundry-build'],
      details: { stderrTail: (build.stderr ?? '').slice(-2000) },
    }
  }

  const outFile = join(REPO, `.evolve/review-memory/${familyId}.audit.json`)
  const audit = spawnSync(
    'node',
    [
      'scripts/audit-scaffold-quality.ts',
      '--layer',
      layerId,
      '--out',
      outFile,
      // Gen-1 strict verifier: compile clean ISN'T enough. Also run `pnpm
      // build` (bundler errors, dead imports) and the family's declared
      // validationChecks (ground-truth file-exists + validate-*.mjs).
      '--build',
      '--validation-checks',
    ],
    { cwd: REPO, encoding: 'utf8', timeout: 15 * 60 * 1000 },
  )
  if (audit.status !== 0 || !existsSync(outFile)) {
    return {
      pass: false,
      failingLayers: ['audit-runner'],
      details: { stderrTail: (audit.stderr ?? '').slice(-2000) },
    }
  }

  const report = JSON.parse(readFileSync(outFile, 'utf8'))
  const row = report.audits.find((a) => a.layerId === layerId)
  if (!row) {
    return {
      pass: false,
      failingLayers: ['not-audited'],
      details: { hint: 'layer not found in audit' },
    }
  }
  if (row.skipped) {
    return { pass: false, failingLayers: [`skipped:${row.skipped}`], details: row }
  }
  const phases = row.phases ?? []
  const failing = phases.filter((p) => !p.ok).map((p) => p.phase)
  const pass = failing.length === 0 && phases.length > 0
  const score = phases.length === 0 ? 0 : (phases.length - failing.length) / phases.length
  return {
    pass,
    score,
    failingLayers: failing,
    details: {
      pm: row.pm,
      phases: phases.map((p) => ({
        phase: p.phase,
        ok: p.ok,
        skipped: p.skipped,
        stderrTail: (p.stderrTail ?? '').slice(-600),
        stdoutTail: (p.stdoutTail ?? '').slice(-300),
      })),
    },
  }
}

// ── Review (LLM) ─────────────────────────────────────────────────────
// Router-backed. Senior-engineer directing, never grading.

async function routerJson({ system, user }) {
  const { url, model, auth, style } = reviewerRoute
  const headers = {
    'Content-Type': 'application/json',
    [auth.header]: auth.value,
    ...(auth.extra ?? {}),
  }
  const body =
    style === 'anthropic'
      ? {
          model,
          system,
          messages: [
            { role: 'user', content: `${user}\n\nReturn JSON only, no prose outside the object.` },
          ],
          max_tokens: 2048,
          temperature: 0.2,
        }
      : {
          model,
          stream: false,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`reviewer ${res.status}: ${txt.slice(0, 400)}`)
  }
  const json = await res.json()
  const content =
    style === 'anthropic'
      ? json.content?.find((c) => c.type === 'text')?.text
      : json.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('reviewer returned no text content')
  // Anthropic will sometimes wrap the JSON in ```json fences despite the instruction.
  const stripped = content
    .trim()
    .replace(/^```(?:json)?\s*/, '')
    .replace(/```\s*$/, '')
  return JSON.parse(stripped)
}

const review = createLlmReviewer({
  callJson: routerJson,
  renderState: (s) => `familyId=${s.familyId}\nfamilyDir=${s.familyDir}`,
  renderTraceSummary: (s) =>
    s === undefined
      ? '(none)'
      : [
          `shot=${s.shot} durationMs=${s.durationMs}`,
          `added(${s.added?.length ?? 0}): ${(s.added ?? []).slice(0, 10).join(', ')}`,
          `changed(${s.changed?.length ?? 0}): ${(s.changed ?? []).slice(0, 10).join(', ')}`,
          `removed(${s.removed?.length ?? 0}): ${(s.removed ?? []).slice(0, 10).join(', ')}`,
          `builderTail: ${(s.builderTail ?? '').slice(-600)}`,
        ].join('\n'),
  systemPromptAddendum: [
    'You are directing a code builder working on a starter-scaffold framework layer.',
    'The VERIFIER ran: compose → install → typecheck (all in temp dirs).',
    'Failing layers you will see: install, typecheck, audit-runner, starter-foundry-build, skipped:*',
    'Write nextShotInstruction as concrete file-level directives (which manifest keys to fill, which files to add, what deps to pin).',
    'If the verification passed, shouldContinue must be false.',
    'If two consecutive shots have identical failures, escalate the diagnosis rather than repeating the instruction.',
  ].join('\n'),
})

// ── Run ──────────────────────────────────────────────────────────────

const goal = [
  `Make the '${familyId}' framework layer a starter-grade scaffold:`,
  `install + typecheck succeed on a bare compose, manifest is populated,`,
  `and a downstream AI agent can consume it without guessing what's missing.`,
].join(' ')

console.log(`enrich-family: ${familyId}`)
console.log(`  layer:    ${layerId}`)
console.log(`  dir:      ${familyDir}`)
console.log(`  shots:    ${maxShots}`)
console.log(`  builder:  claude -p --model ${builderModel}`)
console.log(`  reviewer: ${reviewerRoute.style} → ${reviewerRoute.model}`)
console.log(`  memory:   ${memoryPath}`)
console.log()

const report = await runProposeReview({
  goal,
  initialState: { familyId, familyDir },
  propose,
  verify,
  review,
  maxShots,
  maxWallMs: 25 * 60 * 1000,
  memory: jsonlReviewStore(memoryPath),
  fallbackInstruction:
    'Inspect the latest audit.details.phases for the first failing phase. Fix that phase first — do not edit anything unrelated.',
})

// ── Write summary ────────────────────────────────────────────────────

const summaryPath = join(REPO, '.evolve/review-memory', `${familyId}.summary.json`)
writeFileSync(
  summaryPath,
  JSON.stringify(
    {
      familyId,
      runAt: new Date().toISOString(),
      completed: report.completed,
      shotsUsed: report.shots.length,
      finalPass: report.finalVerification.pass,
      finalScore: report.score,
      finalFailingLayers: report.finalVerification.failingLayers ?? [],
      failureClass: report.failureClass ?? null,
      wallMs: report.wallMs,
      shots: report.shots.map((s) => ({
        shot: s.shot,
        pass: s.verification.pass,
        failing: s.verification.failingLayers ?? [],
        confidence: s.review?.confidence ?? null,
        shouldContinue: s.review?.shouldContinue ?? null,
        durationMs: s.durationMs,
        reviewAvailable: s.reviewAvailable,
      })),
    },
    null,
    2,
  ),
)

// ── Library snapshot ─────────────────────────────────────────────────
// On success (or near-success), snapshot the layer dir into the template
// library so runs accumulate history instead of destroying it. Hash is
// content-addressed over the manifest + file tree so identical versions
// dedupe.
let libraryVersionDir = null
if (report.finalVerification.pass) {
  const contentHash = createHash('sha256')
  const manifestPath = join(familyDir, 'manifest.json')
  if (existsSync(manifestPath)) contentHash.update(readFileSync(manifestPath))
  const filesRoot = join(familyDir, 'files')
  if (existsSync(filesRoot)) {
    const paths = []
    const walk = (dir) => {
      for (const entry of readdirSync(dir).sort()) {
        const full = join(dir, entry)
        const s = statSync(full)
        if (s.isDirectory()) walk(full)
        else paths.push(full)
      }
    }
    walk(filesRoot)
    for (const p of paths) {
      contentHash.update(relative(familyDir, p))
      contentHash.update(readFileSync(p))
    }
  }
  const hash = contentHash.digest('hex').slice(0, 12)
  const libDir = join(REPO, '.evolve/template-library', familyId, `v_${hash}`)
  if (!existsSync(libDir)) {
    mkdirSync(libDir, { recursive: true })
    if (existsSync(manifestPath)) cpSync(manifestPath, join(libDir, 'manifest.json'))
    if (existsSync(filesRoot)) cpSync(filesRoot, join(libDir, 'files'), { recursive: true })
    // Sidecar metadata: summary + audit report + shot log copy so the
    // version is self-describing even if .evolve/review-memory/ is wiped.
    writeFileSync(join(libDir, 'summary.json'), readFileSync(summaryPath, 'utf8'))
    const auditCopy = join(REPO, `.evolve/review-memory/${familyId}.audit.json`)
    if (existsSync(auditCopy)) cpSync(auditCopy, join(libDir, 'audit.json'))
    if (existsSync(memoryPath)) cpSync(memoryPath, join(libDir, 'shot-log.jsonl'))
    libraryVersionDir = libDir
  } else {
    // Same content hash → already captured. Touch _index? Not here —
    // promote-template.mjs handles ranking. We just skip re-writing.
    libraryVersionDir = libDir
  }
}

console.log()
console.log(`--- enrichment summary ---`)
console.log(`  family:    ${familyId}`)
console.log(`  completed: ${report.completed}`)
console.log(`  shots:     ${report.shots.length}/${maxShots}`)
console.log(`  pass:      ${report.finalVerification.pass}`)
console.log(`  score:     ${report.score.toFixed(2)}`)
console.log(`  failing:   ${(report.finalVerification.failingLayers ?? []).join(', ') || '(none)'}`)
console.log(`  wall:      ${(report.wallMs / 1000).toFixed(1)}s`)
console.log(`  summary:   ${summaryPath}`)
console.log(`  memory:    ${memoryPath}`)
if (libraryVersionDir) console.log(`  library:   ${libraryVersionDir}`)

process.exit(report.finalVerification.pass ? 0 : 1)
