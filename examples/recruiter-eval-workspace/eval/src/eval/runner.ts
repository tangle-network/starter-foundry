// Eval runner — thin shell over @tangle-network/agent-eval primitives.
//
// Lifecycle:
//   1. Load every Scenario exported from `scenarios/*.scenario.ts`.
//   2. For each scenario, build a TestGradedScenario whose harness.testCommand
//      is a curl-based assertion against the target URL (or skip the test
//      command entirely when running in `judge-only` mode).
//   3. Delegate to `runTestGradedScenario` from agent-eval — it spawns the
//      command via SubprocessSandboxDriver, emits a Run, persists spans
//      via FileSystemTraceStore.
//   4. Run every JudgeFn in `judges/*.judge.ts` over the collected
//      ScenarioResult. Aggregate via `aggregateJudgeScores` so any judge
//      returning `status: 'unmeasured'` (e.g. the rubric-quality LLM
//      judge when TANGLE_API_KEY is absent) is EXCLUDED from the
//      mean — never averaged in as a fake zero. See
//      `judges/aggregate.ts` and .evolve/patterns/muffled-gate.md.
//   5. Emit a scorecard via `writeScorecard` (see scorecard.ts). Flow
//      values are `number | null`; `null` means unmeasured, never 0.
//
// All primitives come from the published package — this file is the
// integration glue, not new measurement infra.

import { readdir } from 'node:fs/promises'
import { resolve, join, dirname, isAbsolute } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  FileSystemTraceStore,
  FileSystemExperimentStore,
  SubprocessSandboxDriver,
  runTestGradedScenario,
  type Scenario,
  type TestGradedScenario,
  type TestGradedRunResult,
  type JudgeFn,
  type JudgeInput,
  type JudgeScore,
  type CollectedArtifacts,
} from '@tangle-network/agent-eval'
import { TCloud } from '@tangle-network/tcloud'
import { writeScorecard, type ScorecardFlow } from './scorecard.js'

export interface RunnerOptions {
  /** Project root — defaults to cwd of the runner. */
  projectRoot?: string
  /** HTTP target URL the test commands hit. */
  targetUrl?: string
  /** Pass threshold for the aggregate. CI gate uses this. */
  threshold?: number
  /** Override scenarios dir (default: <root>/scenarios). */
  scenariosDir?: string
  /** Override judges dir (default: <root>/judges). */
  judgesDir?: string
  /** Override traces dir (default: <root>/.evolve/agent-eval/traces). */
  tracesDir?: string
  /** Override experiments dir (default: <root>/.evolve/agent-eval/experiments). */
  experimentsDir?: string
  /** Where the project-level scorecard.json lands. */
  scorecardPath?: string
  /** Variant label tagged onto every Run for A/B compares. */
  variantId?: string
}

interface LoadedScenario {
  scenario: Scenario
  filePath: string
}

interface ScenarioOutcome {
  scenarioId: string
  pass: boolean
  /** Null when no measurable judge produced a score. */
  score: number | null
  durationMs: number
  failureClass: string | null
  filePath: string
  runId: string
  measuredJudgeCount: number
  unmeasuredJudgeCount: number
}

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = resolve(HERE, '..', '..')

function normalizeRouterBaseURL(baseURL: string): string {
  const trimmed = baseURL.replace(/\/+$/, '')
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`
}

function createJudgeClient(): TCloud | undefined {
  const apiKey = process.env.EVAL_LLM_API_KEY ?? process.env.TANGLE_API_KEY
  if (!apiKey) return undefined

  const baseURL =
    process.env.EVAL_LLM_BASE_URL ?? process.env.TANGLE_ROUTER_BASE_URL ?? process.env.LLM_ROUTER_URL

  return TCloud.create({
    apiKey,
    ...(baseURL ? { baseURL: normalizeRouterBaseURL(baseURL) } : {}),
  })
}

function shQuote(s: string): string {
  return `'${String(s).replace(/'/g, `'\\''`)}'`
}

async function loadScenariosFrom(dir: string): Promise<LoadedScenario[]> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }
  const out: LoadedScenario[] = []
  for (const entry of entries) {
    if (!entry.endsWith('.scenario.ts') && !entry.endsWith('.scenario.js')) continue
    const filePath = join(dir, entry)
    const url = pathToFileURL(isAbsolute(filePath) ? filePath : resolve(filePath)).href
    const mod = (await import(url)) as { default?: Scenario | Scenario[] }
    if (!mod.default) continue
    const list = Array.isArray(mod.default) ? mod.default : [mod.default]
    for (const scenario of list) {
      if (!scenario?.id) continue
      out.push({ scenario, filePath })
    }
  }
  return out
}

interface LoadedJudge {
  fn: JudgeFn
  filePath: string
}

async function loadJudgesFrom(dir: string): Promise<LoadedJudge[]> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }
  const out: LoadedJudge[] = []
  for (const entry of entries) {
    if (!entry.endsWith('.judge.ts') && !entry.endsWith('.judge.js')) continue
    const filePath = join(dir, entry)
    const url = pathToFileURL(isAbsolute(filePath) ? filePath : resolve(filePath)).href
    const mod = (await import(url)) as { default?: JudgeFn }
    if (typeof mod.default !== 'function') continue
    out.push({ fn: mod.default, filePath })
  }
  return out
}

// Translate a Scenario into a TestGradedScenario.
function toTestGraded(scenario: Scenario, targetUrl: string): TestGradedScenario {
  const customTestCommand = (scenario as Scenario & { testCommand?: string }).testCommand
  const firstTurn = scenario.turns[0]
  const userMessage = firstTurn?.user ?? ''
  const defaultTest =
    `curl -sS -o /tmp/eval-body -w '%{http_code}' -X POST -H 'content-type: application/json' ` +
    `--data ${shQuote(JSON.stringify({ message: userMessage, scenarioId: scenario.id }))} ` +
    `${shQuote(`${targetUrl}/chat`)} | grep -E '^(200|201)$' >/dev/null && ` +
    `test $(wc -c < /tmp/eval-body) -ge 1`
  return {
    id: scenario.id,
    description: scenario.label ?? scenario.thesis ?? scenario.id,
    harness: {
      testCommand: customTestCommand ?? defaultTest,
      timeoutMs: 30_000,
    },
    passThreshold: 1.0,
    tags: { persona: scenario.persona, dimensions: scenario.dimensions.join(',') },
  }
}

export interface RunReport {
  timestamp: string
  variantId?: string
  scenarioCount: number
  passCount: number
  /** Aggregate over MEASURED scenarios only. Null when zero measured. */
  aggregate: number | null
  measuredScenarioCount: number
  unmeasuredScenarioCount: number
  threshold: number
  outcomes: ScenarioOutcome[]
  tracesDir: string
  scorecardPath: string
}

/** Aggregate measured-only mean. Mirrors `eval/judges/aggregate.ts`'s
 * `aggregateJudgeScores` so the same contract applies at every layer. */
function aggregateScenarios(outcomes: ScenarioOutcome[]): {
  mean: number | null
  measuredCount: number
  unmeasuredCount: number
} {
  let sum = 0
  let measured = 0
  let unmeasured = 0
  for (const o of outcomes) {
    if (o.score === null || !Number.isFinite(o.score)) {
      unmeasured += 1
      continue
    }
    sum += o.score
    measured += 1
  }
  return {
    mean: measured > 0 ? sum / measured : null,
    measuredCount: measured,
    unmeasuredCount: unmeasured,
  }
}

export async function runHarness(opts: RunnerOptions = {}): Promise<RunReport> {
  const projectRoot = opts.projectRoot ?? process.cwd()
  const targetUrl = opts.targetUrl ?? process.env.EVAL_TARGET_BASE_URL ?? 'http://127.0.0.1:8787'
  const threshold = opts.threshold ?? Number(process.env.EVAL_THRESHOLD ?? '0.7')
  const scenariosDir = opts.scenariosDir ?? join(projectRoot, 'scenarios')
  const judgesDir = opts.judgesDir ?? join(projectRoot, 'judges')
  const tracesDir = opts.tracesDir ?? join(projectRoot, '.evolve', 'agent-eval', 'traces')
  const experimentsDir =
    opts.experimentsDir ?? join(projectRoot, '.evolve', 'agent-eval', 'experiments')
  const scorecardPath = opts.scorecardPath ?? join(projectRoot, '.evolve', 'scorecard.json')
  const variantId = opts.variantId ?? process.env.EVAL_VARIANT_ID

  const traceStore = new FileSystemTraceStore({ dir: tracesDir })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _experimentStore = new FileSystemExperimentStore({ dir: experimentsDir })
  const driver = new SubprocessSandboxDriver({ cwd: projectRoot }) // muffle-ok: agent-eval 0.7.1+ honors constructor cwd as fallback when HarnessConfig.cwd is unset; runTestGradedScenario does not thread per-call cwd here, so the constructor arg is the active value.

  const loaded = await loadScenariosFrom(scenariosDir)
  if (loaded.length === 0) {
    throw new Error(
      `eval-harness: no scenarios loaded from ${scenariosDir}. Drop a *.scenario.ts file with a default-exported Scenario.`,
    )
  }

  const judges = await loadJudgesFrom(judgesDir)
  const judgeClient = createJudgeClient()

  const outcomes: ScenarioOutcome[] = []
  for (const { scenario, filePath } of loaded) {
    const tgs = toTestGraded(scenario, targetUrl)
    const startedAt = Date.now()
    let result: TestGradedRunResult
    try {
      result = await runTestGradedScenario(tgs, traceStore, { driver, variantId })
    } catch (err) {
      outcomes.push({
        scenarioId: scenario.id,
        pass: false,
        score: 0,
        durationMs: Date.now() - startedAt,
        failureClass: 'harness_error',
        filePath,
        runId: '',
        measuredJudgeCount: 0,
        unmeasuredJudgeCount: 0,
      })
      console.error(`  ✗ ${scenario.id} — harness error: ${(err as Error).message}`)
      continue
    }

    // Run every judge over this scenario. Each JudgeFn returns one or
    // more JudgeScore[]; we aggregate measured-only via the local
    // aggregator so unmeasured signals don't pollute the per-scenario
    // score.
    const judgeScores: JudgeScore[] = []
    if (judges.length > 0) {
      const judgeInput: JudgeInput = {
        scenario,
        turns: [],
        artifacts: {
          vaultFiles: [],
          blocksExtracted: [],
          codeBlocks: [],
          toolCalls: [],
        } as CollectedArtifacts,
      }
      for (const j of judges) {
        try {
          const out = await j.fn(judgeClient as TCloud, judgeInput)
          judgeScores.push(...out)
        } catch (err) {
          console.warn(`  ! judge ${j.filePath} threw: ${(err as Error).message}`)
        }
      }
    }
    let measuredJudgeCount = 0
    let unmeasuredJudgeCount = 0
    let judgeSum = 0
    for (const s of judgeScores) {
      const status = (s as JudgeScore & { status?: string }).status
      if (status === 'unmeasured' || !Number.isFinite(s.score)) {
        unmeasuredJudgeCount += 1
        continue
      }
      judgeSum += s.score
      measuredJudgeCount += 1
    }
    const combined =
      measuredJudgeCount > 0 ? (result.score + judgeSum) / (1 + measuredJudgeCount) : result.score

    outcomes.push({
      scenarioId: scenario.id,
      pass: result.pass,
      score: combined,
      durationMs: Date.now() - startedAt,
      failureClass: result.failureClass ?? null,
      filePath,
      runId: result.runId,
      measuredJudgeCount,
      unmeasuredJudgeCount,
    })
    const mark = result.pass ? '✓' : '✗'
    const detail =
      unmeasuredJudgeCount > 0
        ? ` (${measuredJudgeCount} measured + ${unmeasuredJudgeCount} unmeasured judge${
            unmeasuredJudgeCount === 1 ? '' : 's'
          })`
        : ''
    console.log(`  ${mark} ${scenario.id} — score=${combined.toFixed(3)}${detail}`)
  }

  const passCount = outcomes.filter((o) => o.pass).length
  const agg = aggregateScenarios(outcomes)

  const flows: ScorecardFlow[] = outcomes.map((o) => ({
    name: o.scenarioId,
    value: o.score,
    target: 1.0,
    status:
      o.score === null || !Number.isFinite(o.score)
        ? ('unmeasured' as const)
        : o.pass
          ? ('pass' as const)
          : ('fail' as const),
    direction: 'higher-better',
    productValueClaim: `Scenario "${o.scenarioId}" — pass rate against the agent under test.`,
    ...(o.unmeasuredJudgeCount > 0
      ? {
          notes: `judges: ${o.measuredJudgeCount} measured, ${o.unmeasuredJudgeCount} unmeasured`,
        }
      : {}),
  }))
  const report: RunReport = {
    timestamp: new Date().toISOString(),
    variantId,
    scenarioCount: outcomes.length,
    passCount,
    aggregate: agg.mean,
    measuredScenarioCount: agg.measuredCount,
    unmeasuredScenarioCount: agg.unmeasuredCount,
    threshold,
    outcomes,
    tracesDir,
    scorecardPath,
  }
  await writeScorecard(scorecardPath, {
    product: process.env.EVAL_PRODUCT_NAME ?? 'eval-harness',
    timestamp: report.timestamp,
    aggregate: agg.mean,
    measuredCount: agg.measuredCount,
    unmeasuredCount: agg.unmeasuredCount,
    coverage: `${passCount}/${outcomes.length} scenarios passed (${agg.measuredCount} measured)`,
    flows,
  })
  const aggDisplay = agg.mean === null ? 'unmeasured' : agg.mean.toFixed(3)
  console.log(
    `\naggregate=${aggDisplay} pass=${passCount}/${outcomes.length} measured=${agg.measuredCount} unmeasured=${agg.unmeasuredCount} threshold=${threshold}`,
  )
  return report
}

// CLI-friendly default — invoked from `pnpm eval` when this file is the entry.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const projectRoot = process.env.EVAL_PROJECT_ROOT ?? DEFAULT_ROOT
  runHarness({ projectRoot })
    .then((r) => {
      // CI gate semantics: unmeasured aggregate => exit 0 (don't block
      // PR on a missing key), but log loudly. Measured aggregate is
      // gated on the threshold.
      if (r.aggregate === null) {
        console.warn(
          'aggregate is unmeasured — gate skipped, no measurement to compare to threshold.',
        )
        process.exitCode = 0
      } else {
        process.exitCode = r.aggregate < r.threshold ? 1 : 0
      }
    })
    .catch((err) => {
      console.error('[runner] fatal:', err)
      process.exit(2)
    })
}
