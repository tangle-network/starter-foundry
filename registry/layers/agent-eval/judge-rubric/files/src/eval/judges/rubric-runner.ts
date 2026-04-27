// Rubric runner — composes a multi-dimensional `JudgeRubric` from a config
// object, fans the judge across dimensions, and emits per-dimension scores
// in the `JudgeScore` shape consumed by ScenarioResult.
//
// Calibration: every rubric ships with an optional `goldens` set. When
// present, `runRubric` will compute κ + Pearson + MAE via `calibrateJudge`
// and persist the calibration report alongside the judge output. Callers
// (e.g. the regression gate) read the calibration report to decide whether
// the judge's score is allowed to gate CI.

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  calibrateJudge,
  createCustomJudge,
  type CalibrationResult,
  type CandidateScore,
  type GoldenItem,
  type JudgeFn,
  type JudgeInput,
  type JudgeRubric,
  type JudgeScore,
  type RubricDimension,
} from '@tangle-network/agent-eval'

export interface RubricSpec {
  name: string
  description: string
  dimensions: RubricDimensionSpec[]
  /** Optional gold set for calibration. */
  goldens?: GoldenItem[]
  /** Override the underlying judge model. */
  model?: string
  /** Override the judge temperature. */
  temperature?: number
}

export interface RubricDimensionSpec extends RubricDimension {
  /** Item-level scoring callable for calibration runs. */
  scoreItem?: (itemId: string) => Promise<number>
}

export function buildRubric(spec: RubricSpec): JudgeRubric {
  return {
    name: spec.name,
    description: spec.description,
    dimensions: spec.dimensions.map((d) => ({
      name: d.name,
      description: d.description,
      anchor_low: d.anchor_low,
      anchor_high: d.anchor_high,
      weight: d.weight,
    })),
  }
}

// Build a single JudgeFn that asks the underlying LLM for one number per
// dimension. Uses createCustomJudge under the hood — the system prompt is
// templated from the rubric so authors only edit the rubric, not the prompt.
export function buildRubricJudge(spec: RubricSpec): JudgeFn {
  const rubric = buildRubric(spec)
  const prompt = renderRubricPrompt(rubric)
  const wrapped = createCustomJudge(rubric.name, prompt, {
    model: spec.model,
    temperature: spec.temperature ?? 0,
  })
  return wrapped
}

function renderRubricPrompt(rubric: JudgeRubric): string {
  const dimsBlock = rubric.dimensions
    .map(
      (d) =>
        `- ${d.name} (weight ${d.weight}): ${d.description}\n` +
        `  0.0: ${d.anchor_low}\n  1.0: ${d.anchor_high}`,
    )
    .join('\n')
  return `You are a strict, calibrated evaluator running the rubric "${rubric.name}".

${rubric.description}

Score the agent's response on every dimension below. Output a JSON array
of {"dimension": string, "score": number 0..1, "reasoning": string}.
No prose outside the JSON.

Dimensions:
${dimsBlock}`
}

export async function runRubric(
  spec: RubricSpec,
  input: JudgeInput,
  // The published JudgeFn signature wants a TCloud — callers thread it in.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tc: any,
): Promise<JudgeScore[]> {
  const judge = buildRubricJudge(spec)
  return judge(tc, input)
}

export interface CalibrationOutput {
  rubricName: string
  result: CalibrationResult
  ranAt: string
}

export async function calibrateRubric(
  spec: RubricSpec,
  outPath: string,
): Promise<CalibrationOutput> {
  if (!spec.goldens || spec.goldens.length === 0) {
    throw new Error(
      `calibrateRubric: rubric "${spec.name}" has no goldens — calibration requires a hand-graded gold set.`,
    )
  }
  const candidate: CandidateScore[] = []
  for (const dim of spec.dimensions) {
    if (!dim.scoreItem) continue
    for (const g of spec.goldens) {
      const score = await dim.scoreItem(g.itemId)
      candidate.push({ itemId: `${g.itemId}::${dim.name}`, score })
    }
  }
  if (candidate.length === 0) {
    throw new Error(
      `calibrateRubric: rubric "${spec.name}" — no dimension provided scoreItem(); cannot calibrate.`,
    )
  }
  // Pair goldens × dimensions so calibrateJudge has matching itemIds.
  const pairedGoldens: GoldenItem[] = []
  for (const dim of spec.dimensions) {
    if (!dim.scoreItem) continue
    for (const g of spec.goldens) {
      pairedGoldens.push({ itemId: `${g.itemId}::${dim.name}`, humanScore: g.humanScore })
    }
  }
  const result = calibrateJudge(pairedGoldens, candidate)
  const out: CalibrationOutput = {
    rubricName: spec.name,
    result,
    ranAt: new Date().toISOString(),
  }
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8')
  return out
}

/** A rubric is "load-bearing" only if its calibration meets these thresholds. */
export const CI_GATING_THRESHOLDS = {
  minPearson: 0.7,
  minKappa: 0.5,
  maxMae: 0.15,
} as const

export function isCiGating(result: CalibrationResult): boolean {
  return (
    result.pearson >= CI_GATING_THRESHOLDS.minPearson &&
    result.kappa >= CI_GATING_THRESHOLDS.minKappa &&
    result.mae <= CI_GATING_THRESHOLDS.maxMae
  )
}
