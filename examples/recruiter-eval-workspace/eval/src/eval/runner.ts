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
  score: number
  durationMs: number
  failureClass: string | null
  filePath: string
  runId: string
  measuredJudgeCount: number
  unmeasuredJudgeCount: number
  evaluationErrors?: string[]
  /**
   * Capture-integrity issues observed at run-end. Empty in the common
   * happy-path case. Surfaced on the row so a launch reviewer can spot
   * runs that completed structurally but lost their forensic evidence.
   */
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
  appliesToDimensions?: string[]
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
      appliesToDimensions?: unknown
    }
    if (typeof mod.default !== 'function') continue
    if (
      mod.appliesToDimensions !== undefined &&
      (!Array.isArray(mod.appliesToDimensions) ||
        !mod.appliesToDimensions.every((dimension) => typeof dimension === 'string'))
    ) {
      throw new Error(`${filePath}: appliesToDimensions must be an array of strings`)
    }
    judges.push({
      fn: mod.default,
      filePath,
      ...(mod.appliesToDimensions
        ? { appliesToDimensions: mod.appliesToDimensions as string[] }
        : {}),
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
  aggregate: number
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

export function exitCodeForReport(report: RunReport): 0 | 1 {
  const executionFailed = report.outcomes.some((outcome) =>
    ['harness_error', 'judge_error', 'integrity'].includes(outcome.failureClass ?? ''),
  )
  return report.aggregate < report.threshold || executionFailed ? 1 : 0
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

    // ── 0.21 Directive 1: per-run RawProviderSink ──────────────────────
    // The sink is passed directly to the run-bound judge client. Strict
    // checks consult it only when that client emitted at least one LLM span.
    let rawSink: RawProviderSink | undefined
    if (integrityMode !== 'off') {
      rawSink = new FileSystemRawProviderSink({
        dir: join(rawEventsDir, scenario.id),
      })
    }

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

    const applicableJudges = judges.filter((judge) =>
      judgeAppliesTo(judge.appliesToDimensions, scenario.dimensions),
    )
    const evaluationErrors: string[] = []
    const judgeScores: WeightedJudgeScore[] = []
    if (result.pass && applicableJudges.length > 0) {
      const stdout = result.harness.test?.stdout ?? ''
      let turns = decodeConversationOutput(stdout)
      if (!turns) {
        if (scenario.turns.length > 1) {
          evaluationErrors.push(
            'multi-turn test command did not emit EVAL_TURNS_JSON conversation output',
          )
          turns = []
        } else {
          turns = [
            {
              turnIndex: 0,
              userMessage: scenario.turns[0]?.user ?? '',
              agentResponse: stdout,
              durationMs: result.harness.test?.wallMs ?? 0,
            },
          ]
        }
      } else if (turns.length !== scenario.turns.length) {
        evaluationErrors.push(
          `conversation returned ${turns.length}/${scenario.turns.length} declared turns`,
        )
      }
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
      if (evaluationErrors.length === 0) {
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
            const scores = await judge.fn(judgeClient, judgeInput)
            judgeScores.push(...(scores as WeightedJudgeScore[]))
          } catch (err) {
            evaluationErrors.push(
              `${judge.filePath}: ${err instanceof Error ? err.message : String(err)}`,
            )
          }
        }
      }
    }

    let measuredJudgeCount = 0
    let unmeasuredJudgeCount = 0
    let judgeMean: number | null = null
    try {
      const aggregate = aggregateJudgeScores(judgeScores)
      measuredJudgeCount = aggregate.measuredJudgeCount
      unmeasuredJudgeCount = aggregate.unmeasuredJudgeCount
      judgeMean = aggregate.mean
    } catch (err) {
      evaluationErrors.push(err instanceof Error ? err.message : String(err))
    }
    const evaluationFailed = evaluationErrors.length > 0
    const score = evaluationFailed ? 0 : (judgeMean ?? result.score)

    // A curl-only scenario has no local model call, so strict mode requires
    // the run outcome but not a provider event. Once a judge calls a model,
    // every LLM span must have a matching raw request.
    let integrityIssues: string[] | undefined
    if (integrityMode !== 'off' && result.runId) {
      const llmSpanCount = (await traceStore.spans({ runId: result.runId, kind: 'llm' })).length
      const report =
        llmSpanCount === 0
          ? await assertRunCaptured(traceStore, result.runId, {
              requireOutcome: true,
            })
          : await assertRunCaptured(traceStore, result.runId, {
              rawSink,
              llmSpansMin: llmSpanCount,
              requireRawCoverageOfLlmSpans: true,
              requireOutcome: true,
            })
      integrityReports[result.runId] = report
      if (!report.ok) {
        integrityIssues = report.issues.map((issue) => issue.code)
      }
    }

    const integrityFailed = integrityMode === 'strict' && integrityIssues !== undefined
    const scenarioPassed = result.pass && !evaluationFailed && score >= threshold
    const pass = !integrityFailed && scenarioPassed
    outcomes.push({
      scenarioId: scenario.id,
      pass,
      score: integrityFailed || evaluationFailed ? 0 : score,
      durationMs: Date.now() - startedAt,
      failureClass: integrityFailed
        ? 'integrity'
        : evaluationFailed
          ? 'judge_error'
          : (result.failureClass ?? null),
      filePath,
      runId: result.runId,
      measuredJudgeCount,
      unmeasuredJudgeCount,
      ...(evaluationErrors.length > 0 ? { evaluationErrors } : {}),
      ...(integrityIssues ? { integrityIssues } : {}),
    })
    const mark = pass ? '✓' : '✗'
    const integritySuffix = integrityIssues ? ` (integrity: ${integrityIssues.join(', ')})` : ''
    const evaluationSuffix =
      evaluationErrors.length > 0 ? ` (evaluation: ${evaluationErrors.join('; ')})` : ''
    const judgeSuffix =
      applicableJudges.length > 0
        ? ` judges=${measuredJudgeCount} measured/${unmeasuredJudgeCount} unmeasured`
        : ''
    console.log(
      `  ${mark} ${scenario.id} — score=${score.toFixed(3)}${judgeSuffix}${evaluationSuffix}${integritySuffix}`,
    )
  }

  const passCount = outcomes.filter((o) => o.pass).length
  const aggregate = outcomes.reduce((a, o) => a + o.score, 0) / Math.max(outcomes.length, 1)

  const flows: ScorecardFlow[] = outcomes.map((o) => ({
    name: o.scenarioId,
    value: o.score,
    target: 1.0,
    status: o.pass ? 'pass' : 'fail',
    direction: 'higher-better',
    productValueClaim: `Scenario "${o.scenarioId}" — pass rate against the agent under test.`,
  }))
  const report: RunReport = {
    timestamp: new Date().toISOString(),
    variantId,
    scenarioCount: outcomes.length,
    passCount,
    aggregate,
    measuredScenarioCount: outcomes.length,
    unmeasuredScenarioCount: 0,
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
    coverage: `${passCount}/${outcomes.length} scenarios passed`,
    flows,
  })
  const integritySummary =
    integrityMode === 'off'
      ? 'integrity=off'
      : `integrity=${integrityMode} ` +
        `${Object.values(integrityReports).filter((r) => !r.ok).length}/${
          Object.keys(integrityReports).length
        } flagged`
  console.log(
    `\naggregate=${aggregate.toFixed(3)} pass=${passCount}/${outcomes.length} threshold=${threshold} ${integritySummary}`,
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
