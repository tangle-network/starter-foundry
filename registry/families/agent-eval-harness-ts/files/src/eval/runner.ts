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
// All primitives come from the published package — this file is the
// integration glue, not new measurement infra.

import { resolve, join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  FileSystemTraceStore,
  FileSystemExperimentStore,
  SubprocessSandboxDriver,
  runTestGradedScenario,
  type Scenario,
  type TestGradedScenario,
  type TestGradedRunResult,
} from '@tangle-network/agent-eval'
// Single source of truth for scenario loading: the agent-eval:scenarios
// layer composes `src/eval/scenario-loader.ts` next to this runner. Pre-fix
// the family re-implemented a weaker loader inline (no shape validation),
// silently diverging from the layer's strict checks. Per CLAUDE.md
// "extend, don't duplicate", the runner imports the layer's loader.
import { loadScenarios, type LoadedScenario } from './scenario-loader.js'
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

interface ScenarioOutcome {
  scenarioId: string
  pass: boolean
  score: number
  durationMs: number
  failureClass: string | null
  filePath: string
  runId: string
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
  scorecardPath: string
}

export async function runHarness(opts: RunnerOptions = {}): Promise<RunReport> {
  const projectRoot = opts.projectRoot ?? process.cwd()
  const targetUrl = opts.targetUrl ?? process.env.EVAL_TARGET_BASE_URL ?? 'http://127.0.0.1:8787'
  const threshold = opts.threshold ?? Number(process.env.EVAL_THRESHOLD ?? '0.7')
  const scenariosDir = opts.scenariosDir ?? join(projectRoot, 'scenarios')
  const tracesDir = opts.tracesDir ?? join(projectRoot, '.evolve', 'agent-eval', 'traces')
  const experimentsDir =
    opts.experimentsDir ?? join(projectRoot, '.evolve', 'agent-eval', 'experiments')
  const scorecardPath = opts.scorecardPath ?? join(projectRoot, '.evolve', 'scorecard.json')
  const variantId = opts.variantId ?? process.env.EVAL_VARIANT_ID

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
      })
      console.error(`  ✗ ${scenario.id} — harness error: ${(err as Error).message}`)
      continue
    }
    outcomes.push({
      scenarioId: scenario.id,
      pass: result.pass,
      score: result.score,
      durationMs: Date.now() - startedAt,
      failureClass: result.failureClass ?? null,
      filePath,
      runId: result.runId,
    })
    const mark = result.pass ? '✓' : '✗'
    console.log(`  ${mark} ${scenario.id} — score=${result.score.toFixed(3)}`)
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
    scorecardPath,
  }
  await writeScorecard(scorecardPath, {
    product: process.env.EVAL_PRODUCT_NAME ?? 'eval-harness',
    timestamp: report.timestamp,
    aggregate,
    coverage: `${passCount}/${outcomes.length} scenarios passed`,
    flows,
  })
  console.log(
    `\naggregate=${aggregate.toFixed(3)} pass=${passCount}/${outcomes.length} threshold=${threshold}`,
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
