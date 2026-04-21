// run.ts — template-level propose/verify/review loop. Replaces the previous
// single-shot synthesize→judge→audit pipeline with the primitive from
// @tangle-network/agent-eval so a failing audit feeds the next synthesis
// call instead of being silently dropped.
//
// CLI (unchanged):
//   pnpm tsx src/training/template_v1/run.ts \
//     --template-key src.App.tsx --family react-vite-ts \
//     --template-target src/App.tsx \
//     --source-path registry/layers/framework/react-vite-ts/files/App.tsx \
//     [--dry-run] [--apply --yes] [--max-shots 3]
//
// Role split (why this looks different now):
//   - propose:  multiPropose(...) — generates N candidates, scores each with
//               the deterministic judge, returns the top one. The reviewer's
//               prior `nextShotInstruction` is threaded into synthesize as an
//               extra context line.
//   - verify:   audit(...) — compose + install + typecheck. Authoritative.
//   - review:   LLM via reviewer-route (Anthropic direct preferred). Reads the
//               audit outcome + judge dimensions + prior memory and directs
//               the next shot. NEVER overturns `verify.pass`.
//
// The emit-candidate + --apply gating at the end is preserved unchanged so
// scripts/template-quality-sweep.mjs and downstream CI keep working.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Phase F — VB → starter-foundry feedback pipe (reader side).
 *
 * Loads the most recent VB feedback file for this template key, if any.
 * VB emits these at `<vbRepo>/.evolve/template-feedback/<templateKey>.json`
 * after every sweep. We surface the failing leaves + reviewer diagnoses
 * into the reviewer's system-prompt addendum so the synthesis loop
 * knows which real-world VB failures this template rewrite is expected
 * to fix.
 *
 * Directory override: --vb-feedback-dir <path> (default tries sibling
 * blueprint-agent repo, then in-repo fallback).
 */
interface VbTemplateFeedback {
  schemaVersion: number
  templateKey: string
  family: string | null
  layers: string[]
  generatedAt: string
  vbGeneration: number
  vbVariant: string
  failingLeaves: Array<{
    leafId: string
    verticalId: string
    difficulty: string
    blendedScore: number
    failingLayers: string[]
    reviewerDiagnoses: string[]
    shotsUsed: number
    primaryFailureExcerpt: string | null
  }>
  passingLeaves: Array<{
    leafId: string
    verticalId: string
    blendedScore: number
  }>
  aggregate: {
    totalLeaves: number
    passRate: number
    meanBlended: number
    topFailingLayers: Array<{ layer: string; count: number }>
    commonFailureClusters: string[]
  }
}

function loadVbFeedback(
  templateKey: string,
  feedbackDirOverride: string | undefined,
): VbTemplateFeedback | null {
  const candidates = [
    feedbackDirOverride,
    process.env.VB_TEMPLATE_FEEDBACK_DIR,
    resolve(REPO, '..', 'blueprint-agent', '.evolve', 'template-feedback'),
    resolve(REPO, '.evolve', 'template-feedback'),
  ].filter((p): p is string => !!p)

  for (const dir of candidates) {
    const p = join(dir, `${templateKey}.json`)
    if (!existsSync(p)) continue
    try {
      const raw = JSON.parse(readFileSync(p, 'utf8')) as VbTemplateFeedback
      if (raw.schemaVersion !== 1) {
        console.warn(
          `[vb-feedback] schema v${raw.schemaVersion} at ${p}; this reader expects v1 — skipping`,
        )
        continue
      }
      console.log(
        `[vb-feedback] loaded ${p} (${raw.failingLeaves.length} failing, ${raw.passingLeaves.length} passing, passRate=${(raw.aggregate.passRate * 100).toFixed(0)}%)`,
      )
      return raw
    } catch (err) {
      console.warn(`[vb-feedback] parse failed for ${p}: ${err instanceof Error ? err.message : err}`)
    }
  }
  return null
}

function renderVbFeedbackForReviewer(fb: VbTemplateFeedback): string {
  const parts: string[] = []
  parts.push(
    `VB SWEEP FEEDBACK (from blueprint-agent gen ${fb.vbGeneration} / ${fb.vbVariant}):`,
  )
  parts.push(
    `  passRate=${(fb.aggregate.passRate * 100).toFixed(0)}% meanBlended=${fb.aggregate.meanBlended.toFixed(2)} leaves=${fb.aggregate.totalLeaves}`,
  )
  if (fb.aggregate.topFailingLayers.length > 0) {
    parts.push(
      `  top-failing layers: ${fb.aggregate.topFailingLayers
        .map((l) => `${l.layer}(${l.count})`)
        .join(', ')}`,
    )
  }
  const worst = fb.failingLeaves.slice(0, 3)
  if (worst.length > 0) {
    parts.push('  worst failing leaves:')
    for (const leaf of worst) {
      parts.push(
        `    - ${leaf.verticalId}/${leaf.leafId} (${leaf.difficulty || '?'}) blended=${leaf.blendedScore.toFixed(2)} layers=[${leaf.failingLayers.join(',')}]`,
      )
      if (leaf.reviewerDiagnoses.length > 0) {
        parts.push(`      diagnosis: ${leaf.reviewerDiagnoses[leaf.reviewerDiagnoses.length - 1]!.slice(0, 300)}`)
      }
    }
  }
  parts.push(
    'When rewriting this template, PRIORITIZE fixes that address the top-failing layers above. Do not regress any passing leaves.',
  )
  return parts.join('\n')
}
import {
  runProposeReview,
  createLlmReviewer,
  jsonlReviewStore,
} from '@tangle-network/agent-eval'
import { harvest, type HarvestSummary } from './harvest.js'
import { multiPropose, type MultiProposeResult } from './multi-propose.js'
import { audit, type AuditResult } from './audit.js'
import { judge, type JudgeResult } from './judge.js'
import { selectReviewerRoute, reviewerJsonCall } from '../../lib/reviewer-route.js'
import type { ComposeSpec } from '../../types.js'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const CANDIDATES_DIR = join(REPO, '.evolve/template-candidates')

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const flag = (name: string): boolean => process.argv.includes(name)

interface LoopState {
  candidateSource: string
  mode: 'llm' | 'deterministic'
  reasoning: string
  judge: JudgeResult
  multi: MultiProposeResult
}

interface LoopTrace {
  shot: number
  proposerCount: number
  judgeScore: number
  judgeDimensions: Record<string, number>
  mode: string
  auditStage: string
  auditDurationMs: number
  auditStderrTail: string
  priorInstructionTail: string
}

async function main(): Promise<void> {
  const templateKey = arg('--template-key')
  const family = arg('--family')
  const templateTarget = arg('--template-target')
  const sourcePath = arg('--source-path')
  const maxShots = Number.parseInt(arg('--max-shots', '3') ?? '3', 10)

  if (!templateKey || !family || !templateTarget || !sourcePath) {
    console.error(
      'usage: --template-key <e.g. src.App.tsx> --family <id> --template-target <path in scaffold> --source-path <repo path to the canonical template source> [--dry-run] [--apply --yes] [--max-shots N]',
    )
    process.exit(2)
  }

  const absoluteSource = resolve(REPO, sourcePath)
  if (!existsSync(absoluteSource)) {
    console.error(`source template not found: ${absoluteSource}`)
    process.exit(2)
  }
  const currentSource = readFileSync(absoluteSource, 'utf8')

  console.log(`harvesting: ${templateKey}`)
  const h: HarvestSummary = harvest(templateKey)
  console.log(`  ${h.tupleCount} tuples (${h.writeCount} writes, ${h.editCount} edits)`)
  console.log(`  ${h.frequentlyAddedLines.length} frequently-added lines`)
  console.log(`  ${h.frequentImports.length} frequent imports`)

  if (h.tupleCount < 3) {
    console.log(`✗ not enough tuples to synthesize — need ≥3, have ${h.tupleCount}`)
    process.exit(1)
  }

  const spec: ComposeSpec = {
    projectName: `template-audit-${templateKey.replace(/\./g, '-')}`,
    family,
    layers: [`framework:${family}`, 'capability:shadcn', 'capability:tailwind'].filter(Boolean),
    partner: null,
    slots: {},
    variables: { headline: 'Audit', subheadline: 'Template-audit compose' },
  }

  const memoryPath = join(REPO, '.evolve/review-memory', `template-${templateKey}.jsonl`)
  mkdirSync(dirname(memoryPath), { recursive: true })

  // Dry-run short-circuit: one propose + one judge, no audit, no loop.
  if (flag('--dry-run')) {
    console.log('\n[dry-run] synthesizing one candidate + judging, no audit')
    const multi = await multiPropose({
      templatePath: h.templatePath,
      currentSource,
      harvest: h,
      familyId: family,
      proposerCount: 1,
    })
    const w = multi.winner
    console.log(`  mode:   ${w.candidate.mode}`)
    console.log(`  score:  ${w.score.score.toFixed(3)}`)
    for (const [dim, v] of Object.entries(w.score.dimensions)) {
      console.log(`    ${dim}: ${v.toFixed(3)}`)
    }
    return
  }

  const route = selectReviewerRoute()
  if (!route) {
    console.error('No reviewer key available (ANTHROPIC_API_KEY / GROQ_API_KEY / TANGLE_ROUTER_USER_KEY).')
    process.exit(2)
  }
  console.log(`reviewer: ${route.style} → ${route.model}`)

  // Load any VB feedback available for this template key (Phase F).
  // Surfaces real-world failures the current template produced into the
  // reviewer's addendum so the synthesis loop optimizes for fixing them.
  const vbFeedback = loadVbFeedback(templateKey, arg('--vb-feedback-dir'))

  const review = createLlmReviewer<LoopState, LoopTrace>({
    callJson: (req) => reviewerJsonCall(route, req),
    renderState: (s) =>
      [
        `mode=${s.mode} judgeScore=${s.judge.score.toFixed(3)}`,
        `reasoning: ${s.reasoning.slice(0, 400)}`,
        `--- candidate (first 1000 chars) ---`,
        s.candidateSource.slice(0, 1000),
      ].join('\n'),
    renderTraceSummary: (t) =>
      t === undefined
        ? '(none)'
        : [
            `shot=${t.shot} proposerCount=${t.proposerCount}`,
            `judgeScore=${t.judgeScore.toFixed(3)} mode=${t.mode}`,
            `auditStage=${t.auditStage} auditDurationMs=${t.auditDurationMs}`,
            `auditStderrTail: ${t.auditStderrTail.slice(-600)}`,
            `priorInstructionTail: ${t.priorInstructionTail.slice(-400)}`,
          ].join('\n'),
    systemPromptAddendum: [
      'You are directing a template-rewrite loop for a scaffold file.',
      'The VERIFIER compiled the scaffold with the candidate swapped in: compose → install → typecheck.',
      'Failing stages: compose | install | typecheck | (done = pass).',
      'When the audit fails at typecheck, inspect auditStderrTail for the concrete tsc error and tell the worker which imports or types to fix.',
      'When the audit fails at install, the candidate likely removed or added a dep that isn\'t resolvable — direct the worker accordingly.',
      'If verify.pass is true OR you see identical-shape failures on two consecutive shots, set shouldContinue=false.',
      ...(vbFeedback ? ['', renderVbFeedbackForReviewer(vbFeedback)] : []),
    ].join('\n'),
  })

  const propose = async (input: { shot: number; goal: string; priorReview: { nextShotInstruction?: string } | null }) => {
    const instructionTail = input.priorReview?.nextShotInstruction ?? ''
    // Propose N candidates in parallel (mix of LLM + deterministic), let the
    // deterministic judge pick the winner. Reviewer feedback propagates
    // through the LLM synthesizer via env var (stays out of the type-level
    // contract so other callers of multiPropose don't have to care).
    if (instructionTail) {
      process.env['STARTER_FOUNDRY_TEMPLATE_REVIEW_INSTRUCTION'] = instructionTail
    }
    const multi = await multiPropose({
      templatePath: h.templatePath,
      currentSource,
      harvest: h,
      familyId: family,
      proposerCount: 3,
    })
    const w = multi.winner
    return {
      state: {
        candidateSource: w.candidate.candidate,
        mode: w.candidate.mode,
        reasoning: w.candidate.reasoning,
        judge: w.score,
        multi,
      } satisfies LoopState,
      traceSummary: {
        shot: input.shot,
        proposerCount: multi.proposerCount,
        judgeScore: w.score.score,
        judgeDimensions: w.score.dimensions,
        mode: w.candidate.mode,
        auditStage: 'pending',
        auditDurationMs: 0,
        auditStderrTail: '',
        priorInstructionTail: instructionTail.slice(-400),
      } satisfies LoopTrace,
    }
  }

  let lastAudit: AuditResult | null = null

  const verify = async (state: LoopState) => {
    const a = await audit({ spec, templateTarget, candidateSource: state.candidateSource })
    lastAudit = a
    return {
      pass: a.ok,
      score: a.ok ? 1 : 0,
      failingLayers: a.ok ? [] : [a.stage],
      details: {
        stage: a.stage,
        durationMs: a.durationMs,
        stderrTail: a.stderrTail.slice(-1500),
        judge: {
          score: state.judge.score,
          dimensions: state.judge.dimensions,
          reasoning: state.judge.reasoning,
        },
      },
    }
  }

  console.log(`loop: up to ${maxShots} shots`)
  const initialMulti: MultiProposeResult = {
    winner: {
      candidate: { mode: 'deterministic', candidate: currentSource, reasoning: '(unchanged starting state)' },
      score: judge({
        templatePath: h.templatePath,
        currentSource,
        candidate: currentSource,
        harvest: h,
        familyId: family,
      }),
    },
    runnerUps: [],
    needsHumanTieBreak: false,
    proposerCount: 0,
  }
  const initialState: LoopState = {
    candidateSource: currentSource,
    mode: 'deterministic',
    reasoning: '(unchanged starting state)',
    judge: initialMulti.winner.score,
    multi: initialMulti,
  }

  const report = await runProposeReview<LoopState, LoopTrace>({
    goal:
      `Rewrite template '${templateKey}' in family '${family}' so the composed scaffold installs, typechecks, and ` +
      `incorporates the agent-convergent patterns from harvest (${h.tupleCount} tuples).`,
    initialState,
    propose,
    verify,
    review,
    maxShots,
    maxWallMs: 20 * 60 * 1000,
    memory: jsonlReviewStore(memoryPath),
    fallbackInstruction:
      'Inspect verify.details.stage + stderrTail. Fix the first failing stage — do not change unrelated parts of the template.',
  })

  const finalState = report.finalState
  const finalAudit: AuditResult =
    lastAudit ?? { ok: false, stage: 'compose', stderrTail: '(loop never ran verify)', durationMs: 0 }

  mkdirSync(CANDIDATES_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const candidateFile = join(CANDIDATES_DIR, `${templateKey}.${stamp}.candidate`)
  const reportFile = join(CANDIDATES_DIR, `${templateKey}.${stamp}.report.json`)
  writeFileSync(candidateFile, finalState.candidateSource)
  writeFileSync(
    reportFile,
    JSON.stringify(
      {
        templatePath: h.templatePath,
        templateKey,
        family,
        tupleCount: h.tupleCount,
        synthesizer: { mode: finalState.mode, reasoning: finalState.reasoning },
        judge: finalState.judge,
        audit: finalAudit,
        loop: {
          shotsUsed: report.shots.length,
          maxShots,
          completed: report.completed,
          wallMs: report.wallMs,
          finalPass: report.finalVerification.pass,
          score: report.score,
          failureClass: report.failureClass ?? null,
        },
        decision: finalAudit.ok && finalState.judge.score > 0.55 ? 'promotable' : 'reject',
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  )

  console.log(`\ncandidate → ${candidateFile}`)
  console.log(`report    → ${reportFile}`)
  console.log(`memory    → ${memoryPath}`)
  console.log(`shots     → ${report.shots.length}/${maxShots}  (pass=${report.finalVerification.pass})`)

  if (flag('--apply') && flag('--yes') && finalAudit.ok && finalState.judge.score > 0.55) {
    // Phase F.2 — VB smoke gate. Before applying a template rewrite,
    // dispatch a bounded VB sweep against the same failing leaves the
    // feedback file flagged (or a small sample of verticals when no
    // feedback exists). If the smoke sweep regresses relative to the
    // prior passing leaves, bail out. --skip-vb-smoke to disable.
    if (!flag('--skip-vb-smoke') && vbFeedback && vbFeedback.failingLeaves.length > 0) {
      const smokeOk = await runVbSmoke({
        vertical: vbFeedback.failingLeaves[0]!.verticalId,
        leafCount: Math.min(3, vbFeedback.failingLeaves.length),
        passingBaseline: vbFeedback.passingLeaves.length,
        templateKey,
      })
      if (!smokeOk) {
        console.log(`\n✗ VB smoke gate failed — NOT applying. See stderr for details.`)
        process.exit(3)
      }
    }
    writeFileSync(absoluteSource, finalState.candidateSource)
    console.log(`\n✓ applied candidate to ${absoluteSource} (score ${finalState.judge.score.toFixed(2)})`)
    console.log(`  commit the change + attach the report in the PR body.`)
  } else if (flag('--apply')) {
    console.log('\nnot applied — either audit failed, score too low, or --yes not passed.')
  }
}

/**
 * VB smoke gate (Phase F.2). Invokes blueprint-agent's vb-pipeline
 * via pnpm subprocess against a narrow leaf set, returns true when
 * the candidate template does not regress relative to the feedback's
 * baseline. Non-fatal when blueprint-agent isn't a sibling checkout —
 * we warn and allow the apply to proceed (the promote workflow is
 * only meant to run in a CI environment that has both repos).
 */
async function runVbSmoke(args: {
  vertical: string
  leafCount: number
  passingBaseline: number
  templateKey: string
}): Promise<boolean> {
  const vbRepo = resolve(REPO, '..', 'blueprint-agent')
  if (!existsSync(join(vbRepo, 'scripts', 'experiments', 'vb-pipeline.ts'))) {
    console.warn(
      `[vb-smoke] blueprint-agent not found at ${vbRepo} — skipping smoke gate. Set a CI workspace with both repos for the full promote flow.`,
    )
    return true
  }
  const { spawn } = await import('node:child_process')
  const variant = `smoke-${args.templateKey}-${Date.now().toString(36)}`
  console.log(`\n[vb-smoke] dispatching blueprint-agent sweep: vertical=${args.vertical} variant=${variant}`)
  return await new Promise<boolean>((resolvePromise) => {
    const proc = spawn(
      'pnpm',
      [
        '-s', 'tsx', 'scripts/experiments/vb-pipeline.ts',
        '--vertical', args.vertical,
        '--shots', '3',
        '--verify', 'minimal',
        '--wall-ms', '600000',
        '--generation', '99',
        '--variant', variant,
        '--skip-render',
        '--skip-template-feedback',
      ],
      { cwd: vbRepo, stdio: 'inherit' },
    )
    proc.on('exit', (code) => {
      const ok = code === 0
      console.log(`[vb-smoke] exit=${code} ok=${ok}`)
      resolvePromise(ok)
    })
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
