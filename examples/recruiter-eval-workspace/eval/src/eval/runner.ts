// Eval runner — thin shell over @tangle-network/agent-eval primitives.
//
// Lifecycle:
//   1. Load every Scenario exported from `scenarios/*.scenario.ts`.
//   2. For each scenario, build a TestGradedScenario whose harness.testCommand
//      executes every turn against the target URL and records the responses.
//   3. Delegate to `runTestGradedScenario` from agent-eval — it spawns the
//      command via SubprocessSandboxDriver, emits a Run, persists spans
//      via FileSystemTraceStore.
//   4. Run each applicable JudgeFn over the complete conversation and
//      aggregate dimensions by rubric weights.
//   5. Emit a scorecard via `writeScorecard` (see scorecard.ts).
//
// Capture integrity (agent-eval 0.21+):
//   - Allocates a `FileSystemRawProviderSink` per run, rooted under
//     `<tracesDir>/raw-events/<runId>/`, and passes it directly to the
//     run-bound judge client.
//   - When `EVAL_LLM_BASE_URL` is set the runner calls `assertLlmRoute`
//     at preflight so the sweep fails loud if it would silently fall
//     back to the public router.
//   - Strict checks require raw request coverage for every local model
//     span, while non-model scenarios require only a completed outcome.
//
// All primitives come from the published package — this file is the
// integration glue, not new measurement infra.

import { readdir } from 'node:fs/promises'
import { resolve, join, dirname, isAbsolute } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  FileSystemTraceStore,
  fileExperimentStore,
  SubprocessSandboxDriver,
  assertLlmRoute,
  LlmRouteAssertionError,
  runTestGradedScenario,
  type Scenario,
  type TestGradedScenario,
  type TestGradedRunResult,
  type JudgeFn,
  type JudgeInput,
  type CollectedArtifacts,
} from '@tangle-network/agent-eval'
import {
  FileSystemRawProviderSink,
  assertRunCaptured,
  type RawProviderSink,
  type RunIntegrityReport,
} from '@tangle-network/agent-eval/traces'
// Single source of truth for scenario loading: the agent-eval:scenarios
// layer composes `src/eval/scenario-loader.ts` next to this runner. Pre-fix
// the family re-implemented a weaker loader inline (no shape validation),
// silently diverging from the layer's strict checks. Per CLAUDE.md
// "extend, don't duplicate", the runner imports the layer's loader.
import { loadScenarios, type LoadedScenario } from './scenario-loader.js'
import { writeScorecard, type ScorecardFlow } from './scorecard.js'
import { decodeConversationOutput } from './conversation.js'
import { createJudgeClient } from './judge-client.js'
import { aggregateJudgeScores, judgeAppliesTo, type WeightedJudgeScore } from './judge-policy.js'

export type IntegrityMode = 'off' | 'log' | 'strict'

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
  /**
   * Root for per-run `FileSystemRawProviderSink` directories. Default:
   * `<tracesDir>/../raw-events`. Disabled when `integrityMode` is `'off'`.
   */
  rawEventsDir?: string
  /** Where the project-level scorecard.json lands. */
  scorecardPath?: string
  /** Variant label tagged onto every Run for A/B compares. */
  variantId?: string
  /**
   * Capture-integrity behaviour after each `runTestGradedScenario`:
   *
   *   - `'off'`   — skip raw-sink wiring and `assertRunCaptured`.
   *   - `'log'`   — assert and surface issues on the outcome row, but do
   *                 NOT downgrade the scenario verdict. (default)
   *   - `'strict'`— integrity issues mark the scenario as failed with
   *                 `failureClass='integrity'`.
   *
   * Honours `EVAL_INTEGRITY` env var when unset.
   */
  integrityMode?: IntegrityMode
  /**
   * Optional LLM client options carried only for the preflight route guard.
   * When `baseUrl` is set the runner calls `assertLlmRoute` once before any
   * scenario runs so the sweep fails loud if it would silently fall back
   * to the public router. Mirrors the `LlmClientOptions` shape from
   * agent-eval; pass `{ baseUrl, provider, apiKey }` for the LLM judge
   * route you actually want to exercise.
   */
  llmOpts?: {
    baseUrl?: string
    provider?: string
    apiKey?: string
  }
}

interface ScenarioOutcome {
  scenarioId: string
  pass: boolean
  score: number | null
  durationMs: number
  failureClass: string | null
  filePath: string
  runId: string
  applicableJudgeCount: number
  measuredJudgeCount: number
  unmeasuredJudgeCount: number
  judgeErrorCount: number
  evaluationErrors?: string[]
  integrityIssues?: string[]
}

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = resolve(HERE, '..', '..')

function shQuote(s: string): string {
  return `'${String(s).replace(/'/g, `'\\''`)}'`
}

interface LoadedJudge {
  fn: JudgeFn
  filePath: string
  dimensions: readonly string[]
  usesModel: boolean
}

async function loadJudgesFrom(dir: string): Promise<LoadedJudge[]> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }
  const judges: LoadedJudge[] = []
  for (const entry of entries.sort()) {
    if (!entry.endsWith('.judge.ts') && !entry.endsWith('.judge.js')) continue
    const filePath = join(dir, entry)
    const url = pathToFileURL(isAbsolute(filePath) ? filePath : resolve(filePath)).href
    const mod = (await import(url)) as {
      default?: JudgeFn
      dimensions?: unknown
      usesModel?: unknown
    }
    if (typeof mod.default !== 'function') {
      throw new Error(`eval-harness: ${filePath} must default-export a JudgeFn`)
    }
    if (
      !Array.isArray(mod.dimensions) ||
      mod.dimensions.length === 0 ||
      !mod.dimensions.every((value) => typeof value === 'string' && value.length > 0)
    ) {
      throw new Error(`eval-harness: ${filePath} must export a non-empty string[] named dimensions`)
    }
    if (typeof mod.usesModel !== 'boolean') {
      throw new Error(`eval-harness: ${filePath} must export a boolean named usesModel`)
    }
    judges.push({
      fn: mod.default,
      filePath,
      dimensions: mod.dimensions as string[],
      usesModel: mod.usesModel,
    })
  }
  return judges
}

// Translate a Scenario into a TestGradedScenario — the bridge between
// the conversational scenario shape and the test-graded-runner shape.
//
// Default policy: every turn is POST-ed in order by conversation-cli.ts.
// Each request carries the complete user/assistant history accumulated so far.
function toTestGraded(scenario: Scenario, targetUrl: string): TestGradedScenario {
  const customTestCommand = (scenario as Scenario & { testCommand?: string }).testCommand
  const encodedScenario = Buffer.from(
    JSON.stringify({
      id: scenario.id,
      turns: scenario.turns.map((turn) => ({ user: turn.user })),
    }),
    'utf8',
  ).toString('base64')
  const defaultTest =
    `EVAL_SCENARIO_JSON=${shQuote(encodedScenario)} ` +
    `EVAL_TARGET_BASE_URL=${shQuote(targetUrl)} ` +
    'node --import tsx src/eval/conversation-cli.ts'
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
  aggregate: number | null
  measuredScenarioCount: number
  unmeasuredScenarioCount: number
  threshold: number
  outcomes: ScenarioOutcome[]
  tracesDir: string
  rawEventsDir: string | null
  scorecardPath: string
  integrityMode: IntegrityMode
  /** Per-run integrity reports, indexed by runId. */
  integrityReports: Record<string, RunIntegrityReport>
}

const OPERATIONAL_FAILURES = new Set([
  'harness_error',
  'turn_capture_error',
  'judge_error',
  'judge_unmeasured',
  'integrity',
])

export function exitCodeForReport(report: RunReport): 0 | 1 {
  const operationalFailure = report.outcomes.some(
    (outcome) => outcome.failureClass !== null && OPERATIONAL_FAILURES.has(outcome.failureClass),
  )
  return report.aggregate === null ||
    report.aggregate < report.threshold ||
    report.unmeasuredScenarioCount > 0 ||
    operationalFailure
    ? 1
    : 0
}

function resolveIntegrityMode(opt: IntegrityMode | undefined): IntegrityMode {
  if (opt) return opt
  const env = (process.env.EVAL_INTEGRITY ?? '').toLowerCase()
  if (env === 'off' || env === 'log' || env === 'strict') return env
  return 'log'
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
  const rawEventsDir = opts.rawEventsDir ?? join(projectRoot, '.evolve', 'agent-eval', 'raw-events')
  const scorecardPath = opts.scorecardPath ?? join(projectRoot, '.evolve', 'scorecard.json')
  const variantId = opts.variantId ?? process.env.EVAL_VARIANT_ID
  const integrityMode = resolveIntegrityMode(opts.integrityMode)

  // ── 0.21 Directive 2: assert the route at preflight ───────────────────
  // Pure function; no I/O. Only runs when a baseUrl is supplied (env or
  // opts) — the eval-harness ships with no LLM judge by default, so we
  // don't want to block users who never call an LLM. When a route IS
  // declared, fail loud before any scenario runs.
  const llmBaseUrl = opts.llmOpts?.baseUrl ?? process.env.EVAL_LLM_BASE_URL
  const llmApiKey =
    opts.llmOpts?.apiKey ?? process.env.EVAL_LLM_API_KEY ?? process.env.TANGLE_API_KEY
  const llmProvider = opts.llmOpts?.provider ?? process.env.EVAL_LLM_PROVIDER
  if (llmBaseUrl) {
    try {
      assertLlmRoute(
        { baseUrl: llmBaseUrl, apiKey: llmApiKey, provider: llmProvider },
        { requireExplicitBaseUrl: true, requireAuth: true },
      )
    } catch (err) {
      if (err instanceof LlmRouteAssertionError) {
        throw new Error(
          `eval-harness: preflight route check failed (code=${err.code}). ` +
            `Set EVAL_LLM_BASE_URL + auth, or unset to skip the check. ${err.message}`,
        )
      }
      throw err
    }
  }

  const traceStore = new FileSystemTraceStore({ dir: tracesDir })
  // Experiment store: agent-eval 0.99 exposes this as the `fileExperimentStore`
  // factory (replacing the old `FileSystemExperimentStore` class). Constructed
  // so callers extending this runner can persist experiment metadata alongside
  // traces; `void` marks the intentional construct-for-availability.
  void fileExperimentStore(experimentsDir)
  const driver = new SubprocessSandboxDriver({ cwd: projectRoot }) // muffle-ok: agent-eval honors constructor cwd as fallback when HarnessConfig.cwd is unset; runTestGradedScenario does not thread per-call cwd here, so the constructor arg is the active value.

  const loaded: LoadedScenario[] = await loadScenarios(scenariosDir)
  if (loaded.length === 0) {
    throw new Error(
      `eval-harness: no scenarios loaded from ${scenariosDir}. Drop a *.scenario.ts file with a default-exported Scenario.`,
    )
  }
  const judges = await loadJudgesFrom(judgesDir)

  const integrityReports: Record<string, RunIntegrityReport> = {}
  const outcomes: ScenarioOutcome[] = []
  for (const { scenario, filePath } of loaded) {
    const tgs = toTestGraded(scenario, targetUrl)
    const startedAt = Date.now()
    const applicableJudges = judges.filter((judge) =>
      judgeAppliesTo(judge.dimensions, scenario.dimensions),
    )
    const usesModel = applicableJudges.some((judge) => judge.usesModel)

    let result: TestGradedRunResult
    try {
      result = await runTestGradedScenario(tgs, traceStore, { driver, variantId })
    } catch (error) {
      outcomes.push({
        scenarioId: scenario.id,
        pass: false,
        score: null,
        durationMs: Date.now() - startedAt,
        failureClass: 'harness_error',
        filePath,
        runId: '',
        applicableJudgeCount: applicableJudges.length,
        measuredJudgeCount: 0,
        unmeasuredJudgeCount: 0,
        judgeErrorCount: 0,
        evaluationErrors: [error instanceof Error ? error.message : String(error)],
      })
      console.error(
        `  x ${scenario.id} - harness error: ${error instanceof Error ? error.message : String(error)}`,
      )
      continue
    }

    const stdout = result.harness.test?.stdout ?? ''
    let turns
    try {
      turns = decodeConversationOutput(stdout)
    } catch (error) {
      outcomes.push({
        scenarioId: scenario.id,
        pass: false,
        score: null,
        durationMs: Date.now() - startedAt,
        failureClass: 'turn_capture_error',
        filePath,
        runId: result.runId,
        applicableJudgeCount: applicableJudges.length,
        measuredJudgeCount: 0,
        unmeasuredJudgeCount: 0,
        judgeErrorCount: 0,
        evaluationErrors: [error instanceof Error ? error.message : String(error)],
      })
      continue
    }
    if (!turns && scenario.turns.length === 1 && stdout.trim().length > 0) {
      turns = [
        {
          turnIndex: 0,
          userMessage: scenario.turns[0]?.user ?? '',
          agentResponse: stdout,
          durationMs: result.harness.test?.wallMs ?? 0,
        },
      ]
    }
    if (!turns || turns.length !== scenario.turns.length) {
      const captured = turns?.length ?? 0
      outcomes.push({
        scenarioId: scenario.id,
        pass: false,
        score: null,
        durationMs: Date.now() - startedAt,
        failureClass: 'turn_capture_error',
        filePath,
        runId: result.runId,
        applicableJudgeCount: applicableJudges.length,
        measuredJudgeCount: 0,
        unmeasuredJudgeCount: 0,
        judgeErrorCount: 0,
        evaluationErrors: [
          `captured ${captured}/${scenario.turns.length} declared conversation turns`,
        ],
      })
      console.error(
        `  x ${scenario.id} - captured ${captured}/${scenario.turns.length} conversation turns`,
      )
      continue
    }

    const rawSink: RawProviderSink | undefined =
      integrityMode !== 'off' && usesModel
        ? new FileSystemRawProviderSink({ dir: join(rawEventsDir, scenario.id) })
        : undefined
    const evaluationErrors: string[] = []
    const judgeMeans: number[] = []
    let measuredJudgeCount = 0
    let unmeasuredJudgeCount = 0
    let judgeErrorCount = 0

    if (result.pass && applicableJudges.length > 0) {
      const judgeInput: JudgeInput = {
        scenario,
        turns: turns.map((turn) => ({
          ...turn,
          blocksExtracted: [],
          containsCode: turn.agentResponse.includes('```'),
          containsToolCall: false,
        })),
        artifacts: {
          vaultFiles: [],
          blocksExtracted: [],
          codeBlocks: [],
          toolCalls: [],
        } as CollectedArtifacts,
      }
      const judgeClient = createJudgeClient({
        apiKey: llmApiKey,
        baseUrl: llmBaseUrl ?? process.env.LLM_ROUTER_URL,
        provider: llmProvider,
        rawSink,
        traceStore,
        runId: result.runId,
      })
      for (const judge of applicableJudges) {
        try {
          const scores = (await judge.fn(judgeClient, judgeInput)) as WeightedJudgeScore[]
          if (scores.length === 0) {
            unmeasuredJudgeCount += 1
            evaluationErrors.push(`${judge.filePath}: returned no scores`)
            continue
          }
          const aggregate = aggregateJudgeScores(scores)
          if (aggregate.mean === null || aggregate.unmeasuredCount > 0) {
            unmeasuredJudgeCount += 1
            evaluationErrors.push(
              `${judge.filePath}: returned ${aggregate.unmeasuredCount} unmeasured scores`,
            )
            continue
          }
          measuredJudgeCount += 1
          judgeMeans.push(aggregate.mean)
        } catch (error) {
          judgeErrorCount += 1
          evaluationErrors.push(
            `${judge.filePath}: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }
    }

    const judgingIncomplete =
      result.pass &&
      applicableJudges.length > 0 &&
      (judgeErrorCount > 0 ||
        unmeasuredJudgeCount > 0 ||
        measuredJudgeCount !== applicableJudges.length)
    const judgeMean =
      judgeMeans.length === 0
        ? null
        : judgeMeans.reduce((sum, value) => sum + value, 0) / judgeMeans.length
    const score = !result.pass
      ? result.score
      : judgingIncomplete
        ? null
        : (judgeMean ?? result.score)

    let integrityIssues: string[] | undefined
    if (integrityMode !== 'off' && result.runId) {
      const expectedLlmSpans =
        result.pass && !judgingIncomplete
          ? applicableJudges.filter((judge) => judge.usesModel).length
          : 0
      const report =
        expectedLlmSpans === 0
          ? await assertRunCaptured(traceStore, result.runId, { requireOutcome: true })
          : await assertRunCaptured(traceStore, result.runId, {
              rawSink,
              llmSpansMin: expectedLlmSpans,
              requireRawCoverageOfLlmSpans: true,
              requireOutcome: true,
            })
      integrityReports[result.runId] = report
      if (!report.ok) integrityIssues = report.issues.map((issue) => issue.code)
    }

    const integrityFailed = integrityMode === 'strict' && integrityIssues !== undefined
    const scenarioPassed = score !== null && result.pass && score >= threshold
    const failureClass = integrityFailed
      ? 'integrity'
      : judgeErrorCount > 0
        ? 'judge_error'
        : judgingIncomplete
          ? 'judge_unmeasured'
          : (result.failureClass ?? null)
    outcomes.push({
      scenarioId: scenario.id,
      pass: !integrityFailed && scenarioPassed,
      score: integrityFailed ? null : score,
      durationMs: Date.now() - startedAt,
      failureClass,
      filePath,
      runId: result.runId,
      applicableJudgeCount: applicableJudges.length,
      measuredJudgeCount,
      unmeasuredJudgeCount,
      judgeErrorCount,
      ...(evaluationErrors.length > 0 ? { evaluationErrors } : {}),
      ...(integrityIssues ? { integrityIssues } : {}),
    })
    const displayedScore = score?.toFixed(3) ?? 'unmeasured'
    const judgeSuffix =
      applicableJudges.length > 0
        ? ` judges=${measuredJudgeCount} measured/${unmeasuredJudgeCount} unmeasured/${judgeErrorCount} errors`
        : ''
    const issueSuffix =
      evaluationErrors.length > 0 ? ` (evaluation: ${evaluationErrors.join('; ')})` : ''
    const integritySuffix = integrityIssues ? ` (integrity: ${integrityIssues.join(', ')})` : ''
    console.log(
      `  ${!integrityFailed && scenarioPassed ? 'ok' : 'x'} ${scenario.id} - score=${displayedScore}${judgeSuffix}${issueSuffix}${integritySuffix}`,
    )
  }

  const passCount = outcomes.filter((outcome) => outcome.pass).length
  const measuredOutcomes = outcomes.filter(
    (outcome): outcome is ScenarioOutcome & { score: number } => outcome.score !== null,
  )
  const aggregate =
    measuredOutcomes.length === 0
      ? null
      : measuredOutcomes.reduce((sum, outcome) => sum + outcome.score, 0) / measuredOutcomes.length

  const flows: ScorecardFlow[] = outcomes.map((outcome) => ({
    name: outcome.scenarioId,
    value: outcome.score,
    target: threshold,
    status: outcome.score === null ? 'skip' : outcome.pass ? 'pass' : 'fail',
    direction: 'higher-better',
    productValueClaim: `Scenario "${outcome.scenarioId}" pass rate against the agent under test.`,
  }))
  const report: RunReport = {
    timestamp: new Date().toISOString(),
    variantId,
    scenarioCount: outcomes.length,
    passCount,
    aggregate,
    measuredScenarioCount: measuredOutcomes.length,
    unmeasuredScenarioCount: outcomes.length - measuredOutcomes.length,
    threshold,
    outcomes,
    tracesDir,
    rawEventsDir: integrityMode === 'off' ? null : rawEventsDir,
    scorecardPath,
    integrityMode,
    integrityReports,
  }
  await writeScorecard(scorecardPath, {
    product: process.env.EVAL_PRODUCT_NAME ?? 'eval-harness',
    timestamp: report.timestamp,
    aggregate,
    coverage: `${passCount}/${outcomes.length} scenarios passed; ${measuredOutcomes.length}/${outcomes.length} measured`,
    flows,
  })
  const integritySummary =
    integrityMode === 'off'
      ? 'integrity=off'
      : `integrity=${integrityMode} ` +
        `${Object.values(integrityReports).filter((report) => !report.ok).length}/${Object.keys(integrityReports).length} flagged`
  console.log(
    `\naggregate=${aggregate?.toFixed(3) ?? 'unmeasured'} pass=${passCount}/${outcomes.length} threshold=${threshold} ${integritySummary}`,
  )
  return report
}

// CLI-friendly default — invoked from `pnpm eval` when this file is the entry.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const projectRoot = process.env.EVAL_PROJECT_ROOT ?? DEFAULT_ROOT
  runHarness({ projectRoot })
    .then((r) => {
      process.exitCode = exitCodeForReport(r)
    })
    .catch((err) => {
      console.error('[runner] fatal:', err)
      process.exit(2)
    })
}
