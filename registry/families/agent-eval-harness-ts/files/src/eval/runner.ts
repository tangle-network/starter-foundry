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

import { resolve, join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  FileSystemTraceStore,
  FileSystemExperimentStore,
  SubprocessSandboxDriver,
  assertLlmRoute,
  LlmRouteAssertionError,
  runTestGradedScenario,
  type Scenario,
  type TestGradedScenario,
  type TestGradedRunResult,
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
  score: number
  durationMs: number
  failureClass: string | null
  filePath: string
  runId: string
  /**
   * Capture-integrity issues observed at run-end. Empty in the common
   * happy-path case. Surfaced on the row so a launch reviewer can spot
   * runs that completed structurally but lost their forensic evidence.
   */
  integrityIssues?: string[]
}

/**
 * Lightweight RawProviderSink handle exposed on `globalThis` for ad-hoc
 * LLM-judge wiring. A judge call site can read this to pass `rawSink`
 * into `callLlm` without the runner having to know about the judge. The
 * canonical pattern is to wire `rawSink` explicitly via dependency
 * injection — this hook exists so the example judge auto-captures.
 */
declare global {
  // eslint-disable-next-line no-var
  var __agentEvalRawSink: RawProviderSink | undefined
}

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = resolve(HERE, '..', '..')

function shQuote(s: string): string {
  return `'${String(s).replace(/'/g, `'\\''`)}'`
}

// Translate a Scenario into a TestGradedScenario — the bridge between
// the conversational scenario shape and the test-graded-runner shape.
//
// Default policy: every scenario's first turn is POST-ed at the target
// URL's /chat route, and the response is checked for non-empty content.
// Override by editing the testCommand in your scenario file's tags.
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
  aggregate: number
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
  // Experiment store is created so callers can persist experiment metadata
  // alongside traces; its mere existence ensures the dir is created.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _experimentStore = new FileSystemExperimentStore({ dir: experimentsDir })
  const driver = new SubprocessSandboxDriver({ cwd: projectRoot })

  const loaded: LoadedScenario[] = await loadScenarios(scenariosDir)
  if (loaded.length === 0) {
    throw new Error(
      `eval-harness: no scenarios loaded from ${scenariosDir}. Drop a *.scenario.ts file with a default-exported Scenario.`,
    )
  }

  const integrityReports: Record<string, RunIntegrityReport> = {}
  const outcomes: ScenarioOutcome[] = []
  for (const { scenario, filePath } of loaded) {
    const tgs = toTestGraded(scenario, targetUrl)
    const startedAt = Date.now()

    // ── 0.21 Directive 1: per-run RawProviderSink ──────────────────────
    // Allocated even when no LLM judge runs — the cost is one (possibly
    // empty) NDJSON file per scenario, and the alternative is a silent
    // partial-capture bug the next time someone wires in an LLM judge.
    // Exposed via globalThis so the ad-hoc judge call sites in this
    // template's `judges/` dir pick it up without explicit plumbing.
    let rawSink: RawProviderSink | undefined
    if (integrityMode !== 'off') {
      rawSink = new FileSystemRawProviderSink({
        dir: join(rawEventsDir, scenario.id),
      })
      globalThis.__agentEvalRawSink = rawSink
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
      })
      console.error(`  ✗ ${scenario.id} — harness error: ${(err as Error).message}`)
      continue
    } finally {
      // Always drop the global handle so the next scenario gets its own
      // sink (or none, when integrity is off).
      globalThis.__agentEvalRawSink = undefined
    }

    // ── 0.21 Directive 3: assert the run captured before declaring done ─
    // Read-only. We do NOT set `requireRawCoverageOfLlmSpans` because
    // the test-graded path may not call any LLM at all (the default
    // testCommand is a curl). When an LLM judge IS wired the sink will
    // be populated and consumers can tighten this in `runIntegrityExpect`.
    let integrityIssues: string[] | undefined
    if (integrityMode !== 'off' && result.runId) {
      const report = await assertRunCaptured(traceStore, result.runId, {
        rawSink,
        // requireOutcome: the harness always sets pass/score, so this is
        // a cheap belt-and-suspenders check.
        requireOutcome: true,
      })
      integrityReports[result.runId] = report
      if (!report.ok) {
        integrityIssues = report.issues.map((i) => i.code)
      }
    }

    const integrityFailed = integrityMode === 'strict' && integrityIssues !== undefined
    outcomes.push({
      scenarioId: scenario.id,
      pass: integrityFailed ? false : result.pass,
      score: integrityFailed ? 0 : result.score,
      durationMs: Date.now() - startedAt,
      failureClass: integrityFailed ? 'integrity' : (result.failureClass ?? null),
      filePath,
      runId: result.runId,
      ...(integrityIssues ? { integrityIssues } : {}),
    })
    const mark = integrityFailed ? '✗' : result.pass ? '✓' : '✗'
    const integritySuffix = integrityIssues ? ` (integrity: ${integrityIssues.join(', ')})` : ''
    console.log(
      `  ${mark} ${scenario.id} — score=${result.score.toFixed(3)}${integritySuffix}`,
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
      process.exitCode = r.aggregate < r.threshold ? 1 : 0
    })
    .catch((err) => {
      console.error('[runner] fatal:', err)
      process.exit(2)
    })
}
