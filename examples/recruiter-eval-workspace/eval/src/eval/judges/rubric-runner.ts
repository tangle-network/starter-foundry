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
  llmJudge,
  type CalibrationResult,
  type CandidateScore,
  type ChatClient,
  type GoldenItem,
  type JudgeFn,
  type JudgeInput,
  type JudgeRubric,
  type JudgeScore,
  type LlmJudgeDimension,
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
  if (spec.dimensions.length === 0) {
    throw new Error(`rubric "${spec.name}" requires at least one dimension`)
  }
  const names = new Set<string>()
  for (const dimension of spec.dimensions) {
    if (names.has(dimension.name)) {
      throw new Error(`rubric "${spec.name}" repeats dimension "${dimension.name}"`)
    }
    if (!Number.isFinite(dimension.weight) || dimension.weight <= 0) {
      throw new Error(
        `rubric "${spec.name}" dimension "${dimension.name}" requires a positive finite weight`,
      )
    }
    names.add(dimension.name)
  }
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

// Render the rubric's dimensions as `llmJudge` dimension specs: the anchored
// description becomes the per-dimension instruction the judge contract surfaces.
// `llmJudge` owns the JSON output contract + [0,1] normalization, so authors
// only edit the rubric anchors, never the scoring-protocol prose.
function rubricDimensions(rubric: JudgeRubric): LlmJudgeDimension[] {
  return rubric.dimensions.map((d) => ({
    key: d.name,
    description: `${d.description}\n` + `0.0 = ${d.anchor_low}\n` + `1.0 = ${d.anchor_high}`,
  }))
}

// Per-dimension composite weights, normalized from the rubric weights.
function rubricWeights(rubric: JudgeRubric): Record<string, number> {
  return Object.fromEntries(rubric.dimensions.map((d) => [d.name, d.weight]))
}

// Surface the agent transcript as the artifact the judge scores. Mirrors the
// turn-by-turn rendering the legacy judge used so calibration goldens stay
// comparable across the migration.
function renderTranscript(input: JudgeInput): string {
  return input.turns
    .map(
      (t, i) => `Turn ${i + 1}:\nUser: ${t.userMessage}\nAgent: ${t.agentResponse.slice(0, 2000)}`,
    )
    .join('\n\n---\n\n')
}

// Build a single JudgeFn over the published `llmJudge` JudgeConfig. The rubric
// is rendered into `llmJudge`'s dimension specs; `llmJudge.score()` returns the
// canonical `{ dimensions, composite, notes }` object on the [0,1] scale, which
// we fan back out into the per-dimension `JudgeScore[]` rows the runner +
// regression suite consume. Scale is `unit` — the rubric scores on [0,1].
export function buildRubricJudge(spec: RubricSpec): JudgeFn {
  const rubric = buildRubric(spec)
  const dimensions = rubricDimensions(rubric)
  return async (tc, input): Promise<JudgeScore[]> => {
    const judge = llmJudge<string>(rubric.name, renderRubricSystemPrompt(rubric), {
      chat: tc,
      dimensions,
      weights: rubricWeights(rubric),
      scale: 'unit',
      ...(spec.model ? { model: spec.model } : {}),
      temperature: spec.temperature ?? 0,
      renderUser: ({ artifact }) => artifact,
    })
    const verdict = await judge.score({
      artifact: renderTranscript(input),
      scenario: input.scenario as unknown as Parameters<typeof judge.score>[0]['scenario'],
      signal: new AbortController().signal,
    })
    return rubric.dimensions.map((dimension) => {
      const score = verdict.dimensions[dimension.name]
      if (typeof score !== 'number' || !Number.isFinite(score)) {
        throw new Error(`rubric "${rubric.name}" returned no finite score for "${dimension.name}"`)
      }
      return {
        judgeName: rubric.name,
        dimension: dimension.name,
        score,
        reasoning: verdict.notes,
        weight: dimension.weight,
      }
    })
  }
}

function renderRubricSystemPrompt(rubric: JudgeRubric): string {
  return `You are a strict, calibrated evaluator running the rubric "${rubric.name}".

${rubric.description}

Score the agent's response on every rubric dimension. Each dimension is
anchored: 0.0 is the worst response, 1.0 is the best.`
}

export async function runRubric(
  spec: RubricSpec,
  input: JudgeInput,
  chat: ChatClient,
): Promise<JudgeScore[]> {
  const judge = buildRubricJudge(spec)
  return judge(chat, input)
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
