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
//      ScenarioResult; aggregate via `JudgeRunner` when sandbox-graded.
//   5. Emit a scorecard via `writeScorecard` (see scorecard.ts).
//
// Capture integrity (agent-eval 0.21+):
//   - Allocates a `FileSystemRawProviderSink` per run, rooted under
//     `<tracesDir>/raw-events/<runId>/`. LLM-as-judge call sites that
//     read `globalThis.__agentEvalRawSink` (or that consumers wire
//     explicitly) auto-capture every provider HTTP request/response.
//   - When `EVAL_LLM_BASE_URL` is set the runner calls `assertLlmRoute`
//     at preflight so the sweep fails loud if it would silently fall
//     back to the public router.
//   - After every `runTestGradedScenario` the runner calls
//     `assertRunCaptured` to verify the run wrote the expected spans
//     (and, when judges ran, that every LlmSpan has a matching raw
//     `request` event). Integrity issues are surfaced on the outcome
//     row but only fail the scenario when `EVAL_INTEGRITY=strict`.
//
// All primitives come from the published package — this file is the
// integration glue, not new measurement infra.

import { randomUUID } from 'node:crypto'
import { readdir } from 'node:fs/promises'
import { resolve, join, dirname, isAbsolute } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  FileSystemTraceStore,
  fileExperimentStore,
  SubprocessSandboxDriver,
  assertLlmRoute,
  createChatClient,
  LlmRouteAssertionError,
  runTestGradedScenario,
  type ChatClient,
  type Scenario,
  type TestGradedScenario,
  type TestGradedRunResult,
  type JudgeFn,
  type JudgeInput,
  type JudgeScore,
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
  /**
   * Capture-integrity issues observed at run-end. Empty in the common
   * happy-path case. Surfaced on the row so a launch reviewer can spot
   * runs that completed structurally but lost their forensic evidence.
   */
  integrityIssues?: string[]
}

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = resolve(HERE, '..', '..')
const TURN_MARKER = '__STARTER_FOUNDRY_TURN_'

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
      throw new Error(
        `eval-harness: ${filePath} must export a non-empty string[] named dimensions`,
      )
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

function createJudgeClient(apiKey: string | undefined, baseUrl: string | undefined): ChatClient {
  if (!apiKey) {
    return createChatClient({
      transport: 'custom',
      maximumAttempts: 1,
      chat: async () => {
        throw new Error('TANGLE_API_KEY not set; model-based judges cannot run')
      },
    })
  }
  const trimmed = baseUrl?.replace(/\/+$/, '')
  const baseURL = trimmed ? (trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`) : undefined
  return createChatClient({
    transport: 'router',
    apiKey,
    ...(baseURL ? { baseUrl: baseURL } : {}),
  })
}

function withRawCapture(
  chat: ChatClient,
  rawSink: RawProviderSink,
  runId: string,
  baseUrl: string | undefined,
): ChatClient {
  let callIndex = 0
  const normalizedBaseUrl = baseUrl?.replace(/\/+$/, '') ?? 'https://router.tangle.tools'
  return {
    transport: chat.transport,
    defaultModel: chat.defaultModel,
    maximumAttempts: chat.maximumAttempts,
    async chat(request, options) {
      const index = callIndex++
      const startedAt = Date.now()
      const model = request.model ?? chat.defaultModel ?? 'unknown'
      const eventBase = {
        runId,
        provider: 'judge-chat-client',
        model,
        endpoint: '/v1/chat/completions',
        baseUrl: normalizedBaseUrl,
        attemptIndex: 0,
        redactedFields: [] as string[],
      }
      await rawSink.record({
        ...eventBase,
        eventId: `${runId}:judge:${index}:request`,
        direction: 'request',
        timestamp: startedAt,
        requestBody: request,
      })
      try {
        const response = await chat.chat(request, options)
        await rawSink.record({
          ...eventBase,
          eventId: `${runId}:judge:${index}:response`,
          direction: 'response',
          timestamp: Date.now(),
          durationMs: Date.now() - startedAt,
          requestBody: request,
          responseBody: response.raw ?? response,
        })
        return response
      } catch (error) {
        await rawSink.record({
          ...eventBase,
          eventId: `${runId}:judge:${index}:error`,
          direction: 'error',
          timestamp: Date.now(),
          durationMs: Date.now() - startedAt,
          requestBody: request,
          errorMessage: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
  }
}

// Translate a Scenario into a TestGradedScenario — the bridge between
// the conversational scenario shape and the test-graded-runner shape.
//
// Default policy: every scenario turn is POST-ed to one resumed session.
// Each response is base64-framed so arbitrary model text cannot corrupt the
// turn boundary parsed after the command exits.
function toTestGraded(scenario: Scenario, targetUrl: string): TestGradedScenario {
  const customTestCommand = (scenario as Scenario & { testCommand?: string }).testCommand
  const safeId = scenario.id.replace(/[^a-zA-Z0-9_-]/g, '_')
  const sessionId = `${scenario.id}:${randomUUID()}`
  const commands = scenario.turns.map((turn, turnIndex) => {
    const bodyPath = `/tmp/eval-body-${safeId}-${turnIndex}`
    const requestBody = JSON.stringify({
      message: turn.user,
      scenarioId: scenario.id,
      sessionId,
      turnIndex,
    })
    return (
      `body=${shQuote(bodyPath)}; ` +
      `status=$(curl -sS -o "$body" -w '%{http_code}' -X POST -H 'content-type: application/json' ` +
      `--data ${shQuote(requestBody)} ${shQuote(`${targetUrl}/chat`)}); ` +
      `printf '%s' "$status" | grep -E '^(200|201)$' >/dev/null; ` +
      `test "$(wc -c < "$body")" -ge 1; ` +
      `printf '${TURN_MARKER}${turnIndex}__'; base64 < "$body" | tr -d '\\n'; printf '\\n'`
    )
  })
  const defaultTest = `set -eu; ${commands.join('; ')}`
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

export function parseTurnResponses(stdout: string, expectedTurns: number): string[] {
  const responses: string[] = []
  const marker = new RegExp(`^${TURN_MARKER}(\\d+)__([A-Za-z0-9+/=]*)$`, 'gm')
  for (const match of stdout.matchAll(marker)) {
    const turnIndex = Number(match[1])
    if (!Number.isInteger(turnIndex) || turnIndex < 0 || turnIndex >= expectedTurns) continue
    responses[turnIndex] = Buffer.from(match[2] ?? '', 'base64').toString('utf8')
  }
  if (responses.filter((value) => value !== undefined).length === expectedTurns) {
    return responses
  }
  return expectedTurns === 1 ? [stdout] : []
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
  const rawEventsDir =
    opts.rawEventsDir ?? join(projectRoot, '.evolve', 'agent-eval', 'raw-events')
  const scorecardPath = opts.scorecardPath ?? join(projectRoot, '.evolve', 'scorecard.json')
  const variantId = opts.variantId ?? process.env.EVAL_VARIANT_ID
  const integrityMode = resolveIntegrityMode(opts.integrityMode)

  // ── 0.21 Directive 2: assert the route at preflight ───────────────────
  // Pure function; no I/O. Only runs when a baseUrl is supplied (env or
  // opts) — the eval-harness ships with no LLM judge by default, so we
  // don't want to block users who never call an LLM. When a route IS
  // declared, fail loud before any scenario runs.
  const llmBaseUrl = opts.llmOpts?.baseUrl ?? process.env.EVAL_LLM_BASE_URL
  const llmApiKey = opts.llmOpts?.apiKey ?? process.env.EVAL_LLM_API_KEY ?? process.env.TANGLE_API_KEY
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
  const judgeBaseUrl = llmBaseUrl ?? process.env.LLM_ROUTER_URL

  const integrityReports: Record<string, RunIntegrityReport> = {}
  const outcomes: ScenarioOutcome[] = []
  for (const { scenario, filePath } of loaded) {
    const tgs = toTestGraded(scenario, targetUrl)
    const startedAt = Date.now()
    const applicableJudges = judges.filter((judge) =>
      judge.dimensions.some((dimension) => scenario.dimensions.includes(dimension)),
    )

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
        applicableJudgeCount: applicableJudges.length,
        measuredJudgeCount: 0,
        unmeasuredJudgeCount: 0,
        judgeErrorCount: 0,
      })
      console.error(`  ✗ ${scenario.id} — harness error: ${(err as Error).message}`)
      continue
    }

    const stdout = result.harness.test?.stdout ?? ''
    const responses = parseTurnResponses(stdout, scenario.turns.length)
    if (responses.length !== scenario.turns.length) {
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
      })
      console.error(
        `  ✗ ${scenario.id} — captured ${responses.length}/${scenario.turns.length} turn responses`,
      )
      continue
    }

    const usesModel = applicableJudges.some((judge) => judge.usesModel)
    const rawSink =
      integrityMode !== 'off' && usesModel
        ? new FileSystemRawProviderSink({ dir: join(rawEventsDir, scenario.id) })
        : undefined
    const baseJudgeClient = createJudgeClient(llmApiKey, judgeBaseUrl)
    const judgeClient = rawSink
      ? withRawCapture(baseJudgeClient, rawSink, result.runId, judgeBaseUrl)
      : baseJudgeClient
    const judgeScores: JudgeScore[] = []
    let judgeErrorCount = 0
    if (applicableJudges.length > 0) {
      const perTurnDuration = (result.harness.test?.wallMs ?? 0) / scenario.turns.length
      const judgeInput: JudgeInput = {
        scenario,
        turns: scenario.turns.map((turn, turnIndex) => {
          const response = responses[turnIndex] ?? ''
          return {
            turnIndex,
            userMessage: turn.user,
            agentResponse: response,
            durationMs: perTurnDuration,
            blocksExtracted: [],
            containsCode: response.includes('```'),
            containsToolCall: false,
          }
        }),
        artifacts: {
          vaultFiles: [],
          blocksExtracted: [],
          codeBlocks: [],
          toolCalls: [],
        } as CollectedArtifacts,
      }
      for (const judge of applicableJudges) {
        try {
          const scores = await judge.fn(judgeClient, judgeInput)
          if (scores.length === 0) {
            judgeScores.push({
              judgeName: judge.filePath,
              dimension: judge.dimensions[0]!,
              score: Number.NaN,
              status: 'unmeasured',
              reasoning: 'Judge returned no scores.',
            } as JudgeScore)
          } else {
            judgeScores.push(...scores)
          }
        } catch (err) {
          judgeErrorCount += 1
          console.error(`  ✗ judge ${judge.filePath} threw: ${(err as Error).message}`)
        }
      }
    }
    let measuredJudgeCount = 0
    let unmeasuredJudgeCount = 0
    let judgeScoreTotal = 0
    for (const score of judgeScores) {
      const status = (score as JudgeScore & { status?: string }).status
      if (status === 'unmeasured' || !Number.isFinite(score.score)) {
        unmeasuredJudgeCount += 1
      } else {
        measuredJudgeCount += 1
        judgeScoreTotal += score.score
      }
    }
    const judgingIncomplete =
      applicableJudges.length > 0 &&
      (judgeErrorCount > 0 || unmeasuredJudgeCount > 0 || measuredJudgeCount === 0)
    const score = judgingIncomplete
      ? null
      : measuredJudgeCount > 0
        ? (result.score + judgeScoreTotal) / (measuredJudgeCount + 1)
        : result.score

    let integrityIssues: string[] | undefined
    if (integrityMode !== 'off' && result.runId) {
      const requireRawEvents = usesModel && !judgingIncomplete && measuredJudgeCount > 0
      const report = await assertRunCaptured(traceStore, result.runId, {
        requireOutcome: true,
        ...(requireRawEvents ? { rawSink, rawProviderEventsMin: 1 } : {}),
      })
      integrityReports[result.runId] = report
      if (!report.ok) {
        integrityIssues = report.issues.map((i) => i.code)
      }
    }

    const integrityFailed = integrityMode === 'strict' && integrityIssues !== undefined
    const scenarioPassed = score !== null && result.pass && score >= threshold
    const failureClass =
      judgeErrorCount > 0
        ? 'judge_error'
        : judgingIncomplete
          ? 'judge_unmeasured'
          : (result.failureClass ?? null)
    outcomes.push({
      scenarioId: scenario.id,
      pass: integrityFailed ? false : scenarioPassed,
      score: integrityFailed ? null : score,
      durationMs: Date.now() - startedAt,
      failureClass: integrityFailed ? 'integrity' : failureClass,
      filePath,
      runId: result.runId,
      applicableJudgeCount: applicableJudges.length,
      measuredJudgeCount,
      unmeasuredJudgeCount,
      judgeErrorCount,
      ...(integrityIssues ? { integrityIssues } : {}),
    })
    const mark = integrityFailed ? '✗' : scenarioPassed ? '✓' : '✗'
    const integritySuffix = integrityIssues ? ` (integrity: ${integrityIssues.join(', ')})` : ''
    const judgeSuffix =
      applicableJudges.length > 0
        ? ` judges=${measuredJudgeCount} measured/${unmeasuredJudgeCount} unmeasured/${judgeErrorCount} errors`
        : ''
    console.log(
      `  ${mark} ${scenario.id} — score=${score?.toFixed(3) ?? 'unmeasured'}${judgeSuffix}${integritySuffix}`,
    )
  }

  const passCount = outcomes.filter((o) => o.pass).length
  const measuredOutcomes = outcomes.filter(
    (outcome): outcome is ScenarioOutcome & { score: number } => outcome.score !== null,
  )
  const aggregate =
    measuredOutcomes.length > 0
      ? measuredOutcomes.reduce((total, outcome) => total + outcome.score, 0) /
        measuredOutcomes.length
      : null

  const flows: ScorecardFlow[] = outcomes.map((o) => ({
    name: o.scenarioId,
    value: o.score,
    target: 1.0,
    status: o.score === null ? 'skip' : o.pass ? 'pass' : 'fail',
    direction: 'higher-better',
    productValueClaim: `Scenario "${o.scenarioId}" — pass rate against the agent under test.`,
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
        `${Object.values(integrityReports).filter((r) => !r.ok).length}/${
          Object.keys(integrityReports).length
        } flagged`
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
      process.exitCode = r.aggregate === null || r.aggregate < r.threshold ? 1 : 0
    })
    .catch((err) => {
      console.error('[runner] fatal:', err)
      process.exit(2)
    })
}
