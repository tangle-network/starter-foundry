/**
 * Runner — orchestrates the hypothesis loop end-to-end.
 *
 * Responsibilities:
 *   1. Load `hypotheses/queue.json`.
 *   2. Drive the screener (1 rep / hypothesis).
 *   3. Drive the validator (5 reps / passed-floor hypotheses) with
 *      bootstrap-CI gates.
 *   4. Persist artifacts to `research-results/<runId>/`.
 *   5. (Optional) Compose `OptimizationLoop` from agent-eval for the
 *      steering-bundle variant pathway when the operator passes
 *      `--steering`.
 *
 * The runner is treatment-agnostic. It accepts a `ScenarioRunner` from
 * the consumer and forwards each `Hypothesis` to it; how the treatment
 * is applied is the consumer's call (config delta, prompt swap, code
 * patch — the runner doesn't care).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  OptimizationLoop,
  type OptimizationLoopConfig,
  type OptimizationLoopResult,
} from '@tangle-network/agent-eval'

import { screen, type ScreenerOptions } from './screener.js'
import { validate, type ValidatorOptions } from './validator.js'
import type {
  Hypothesis,
  HypothesisQueue,
  ScenarioRunner,
  ScreenerReport,
  ValidatorReport,
} from './types.js'

export interface SweepOptions {
  queuePath: string
  resultsDir: string
  runner: ScenarioRunner
  screenerFloorTolerance?: number
  validatorReps?: number
  validatorAlpha?: number
  validatorIterations?: number
  validatorEffectFloor?: number
  validatorSeed?: number
  runId?: string
  now?: () => Date
}

export interface SweepReport {
  runId: string
  queueSize: number
  screen: ScreenerReport
  validate: ValidatorReport | null
  scorecardPath: string
}

export function loadQueue(queuePath: string): HypothesisQueue {
  const raw = readFileSync(queuePath, 'utf8')
  const parsed = JSON.parse(raw) as unknown
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(`hypothesis queue at ${queuePath} is not a JSON object`)
  }
  const root = parsed as Record<string, unknown>
  const list = root.hypotheses
  if (!Array.isArray(list)) {
    throw new Error(`hypothesis queue at ${queuePath} missing 'hypotheses' array`)
  }
  // Trust the file shape minimally — full schema check belongs to the proposer.
  return { hypotheses: list as Hypothesis[] }
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true })
}

function writeJson(path: string, value: unknown): void {
  ensureDir(dirname(path))
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function runScreen(args: {
  queuePath: string
  resultsDir: string
  runner: ScenarioRunner
  floorTolerance?: number
  runId?: string
  now?: () => Date
}): Promise<{ report: ScreenerReport; path: string }> {
  const queue = loadQueue(args.queuePath)
  const options: ScreenerOptions = {
    hypotheses: queue.hypotheses,
    runner: args.runner,
  }
  if (args.floorTolerance !== undefined) options.floorTolerance = args.floorTolerance
  if (args.runId !== undefined) options.runId = args.runId
  if (args.now !== undefined) options.now = args.now
  const report = await screen(options)
  const path = join(args.resultsDir, report.runId, 'screen.json')
  writeJson(path, report)
  return { report, path }
}

export async function runValidate(args: {
  queuePath: string
  resultsDir: string
  runner: ScenarioRunner
  candidateIds: readonly string[]
  reps?: number
  alpha?: number
  iterations?: number
  effectFloor?: number
  seed?: number
  runId?: string
  now?: () => Date
}): Promise<{ report: ValidatorReport; path: string }> {
  const queue = loadQueue(args.queuePath)
  const candidates = new Set(args.candidateIds)
  const filtered = queue.hypotheses.filter((h) => candidates.has(h.id))
  if (filtered.length === 0) {
    throw new Error(
      `validator received empty candidate set; refusing to run. queue=${queue.hypotheses.length} candidateIds=${args.candidateIds.length}`,
    )
  }
  const options: ValidatorOptions = {
    hypotheses: filtered,
    runner: args.runner,
  }
  if (args.reps !== undefined) options.reps = args.reps
  if (args.alpha !== undefined) options.alpha = args.alpha
  if (args.iterations !== undefined) options.iterations = args.iterations
  if (args.effectFloor !== undefined) options.effectFloor = args.effectFloor
  if (args.seed !== undefined) options.seed = args.seed
  if (args.runId !== undefined) options.runId = args.runId
  if (args.now !== undefined) options.now = args.now
  const report = await validate(options)
  const path = join(args.resultsDir, report.runId, 'validate.json')
  writeJson(path, report)
  return { report, path }
}

export async function runSweep(options: SweepOptions): Promise<SweepReport> {
  const now = options.now ?? (() => new Date())
  const runId = options.runId ?? `sweep-${now().toISOString().replace(/[:.]/g, '-')}`
  const queue = loadQueue(options.queuePath)

  const screenArgs: Parameters<typeof runScreen>[0] = {
    queuePath: options.queuePath,
    resultsDir: options.resultsDir,
    runner: options.runner,
    runId: `${runId}-screen`,
    now,
  }
  if (options.screenerFloorTolerance !== undefined) {
    screenArgs.floorTolerance = options.screenerFloorTolerance
  }
  const { report: screenReport } = await runScreen(screenArgs)

  let validateReport: ValidatorReport | null = null
  if (screenReport.passedFloor.length > 0) {
    const validateArgs: Parameters<typeof runValidate>[0] = {
      queuePath: options.queuePath,
      resultsDir: options.resultsDir,
      runner: options.runner,
      candidateIds: screenReport.passedFloor,
      runId: `${runId}-validate`,
      now,
    }
    if (options.validatorReps !== undefined) validateArgs.reps = options.validatorReps
    if (options.validatorAlpha !== undefined) validateArgs.alpha = options.validatorAlpha
    if (options.validatorIterations !== undefined) {
      validateArgs.iterations = options.validatorIterations
    }
    if (options.validatorEffectFloor !== undefined) {
      validateArgs.effectFloor = options.validatorEffectFloor
    }
    if (options.validatorSeed !== undefined) validateArgs.seed = options.validatorSeed
    const { report } = await runValidate(validateArgs)
    validateReport = report
  }

  const scorecardPath = join(options.resultsDir, runId, 'scorecard.json')
  const scorecard = {
    runId,
    queueSize: queue.hypotheses.length,
    screen: screenReport,
    validate: validateReport,
  }
  writeJson(scorecardPath, scorecard)

  return {
    runId,
    queueSize: queue.hypotheses.length,
    screen: screenReport,
    validate: validateReport,
    scorecardPath,
  }
}

/**
 * Steering-bundle pathway — direct pass-through to agent-eval's
 * `OptimizationLoop`. Use when the consumer has enumerated steering
 * bundles (vs hypothesis-driven treatments). FDR-corrected pairwise
 * winner with statistical sign-off baked in.
 */
export async function runSteeringLoop(
  config: OptimizationLoopConfig,
): Promise<OptimizationLoopResult> {
  const loop = new OptimizationLoop()
  return loop.run(config)
}
