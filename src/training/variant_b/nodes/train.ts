// train node: takes traces, runs AxMiPRO over the brief signature to find an
// instruction that biases the brief agent toward producing canonicalPrompts
// that route correctly through the deterministic planner. The optimized
// artifact is serialized to JSON at outPath as an AxOptimizedProgram.
//
// Swap strategy: replace `AxMiPRO` with `AxBootstrapFewShot` or `AxGEPA` by
// changing only this file. The TrainOutput contract stays fixed.

import { writeFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { ax, AxMiPRO } from '@ax-llm/ax'
import type { AxAIService, AxMetricFn, AxTypedExample, AxOptimizedProgram } from '@ax-llm/ax'
import { loadRegistry } from '../../../lib/registry.js'
import { planPrompt } from '../../../lib/prompt-planner.js'
import type { Trace } from './collect.js'

export interface TrainInput {
  traces: Trace[]
  outPath: string
  llm: AxAIService
  maxRounds?: number
  auto?: 'light' | 'medium' | 'heavy'
}

export interface SerializedOptimizedProgram {
  optimizerType: string
  bestScore: number
  instruction?: string
  instructionMap?: Record<string, string>
  demos?: unknown[]
  modelConfig?: Record<string, unknown>
  optimizationTime: number
  totalRounds: number
  converged: boolean
  scoreHistory?: number[]
  artifactFormatVersion?: number
  // variant_b-specific metadata — lets the brief-loader know what to rehydrate
  signature: string
  promptShape: 'brief'
  trainedAt: string
  trainingTraceCount: number
  knownFamilies: string[]
  knownCapabilities: string[]
}

export interface TrainOutput {
  optimizedProgram: SerializedOptimizedProgram
  outPath: string
}

const BRIEF_SIGNATURE =
  '"Turn a user product prompt into a structured product brief that drives a deterministic scaffold pipeline downstream. The canonicalPrompt must be a keyword-rich expansion that names concrete technologies drawn from knownFamilies (e.g. nextjs-ts, fullstack-ts, agent-service-ts, go-api, python-api, forge-contracts, solana-program) and concrete UI/infra capabilities drawn from knownCapabilities (e.g. capability:ai-chat-ui, capability:layout-dashboard, capability:saas-billing). It MUST be longer and more specific than the user prompt. Preserve the user intent exactly. Each list field should have 3-8 items." ' +
  'userPrompt:string, knownFamilies:string[], knownCapabilities:string[] -> ' +
  'canonicalPrompt:string, vision:string, taskChecklist:string[], milestones:string[], testingPlan:string[], e2ePlan:string[], securityConcerns:string[], openQuestions:string[], confidence:number'

type BriefExampleInput = { userPrompt: string; knownFamilies: string[]; knownCapabilities: string[] }
type BriefPrediction = {
  canonicalPrompt?: string
  vision?: string
  taskChecklist?: string[]
  milestones?: string[]
  testingPlan?: string[]
  e2ePlan?: string[]
  securityConcerns?: string[]
  openQuestions?: string[]
  confidence?: number
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a)
  const B = new Set(b)
  if (A.size === 0 && B.size === 0) return 1
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  const union = A.size + B.size - inter
  return union === 0 ? 1 : inter / union
}

async function buildKnownLists(): Promise<{ knownFamilies: string[]; knownCapabilities: string[] }> {
  const registry = await loadRegistry()
  const knownFamilies = [...registry.families.keys()]
  const knownCapabilities: string[] = []
  for (const [key] of registry.layers) {
    if (key.startsWith('capability:')) knownCapabilities.push(key)
  }
  return { knownFamilies, knownCapabilities }
}

// Build a metric: for each predicted canonicalPrompt, re-route through the
// deterministic planner and measure capability-jaccard vs the expected
// capabilities from the training example. This is exactly what downstream
// eval will measure, so we optimize the metric that matters.
function makeMetric(expectedByPrompt: Map<string, string[]>): AxMetricFn {
  return async ({ prediction, example }) => {
    const pred = prediction as BriefPrediction
    const canonical = (pred.canonicalPrompt ?? '').trim()
    if (!canonical) return 0
    const ex = example as Record<string, unknown>
    const userPrompt = typeof ex['userPrompt'] === 'string' ? (ex['userPrompt'] as string) : ''
    const expected = expectedByPrompt.get(userPrompt) ?? []
    if (expected.length === 0) {
      // no expected caps — reward length + diversity as a weak proxy
      return canonical.length > userPrompt.length ? 0.5 : 0
    }
    let plan: unknown = null
    try {
      plan = await planPrompt({ prompt: canonical })
    } catch {
      return 0
    }
    const p = plan as { kind?: string; spec?: { layers?: string[]; projects?: Array<{ layers?: string[] }> } } | null
    const actual = p?.kind === 'starter'
      ? p.spec?.layers ?? []
      : (p?.spec?.projects ?? []).flatMap((proj) => proj.layers ?? [])
    return jaccard(actual, expected)
  }
}

export async function trainNode(input: TrainInput): Promise<TrainOutput> {
  const { knownFamilies, knownCapabilities } = await buildKnownLists()

  // Only train on ideasai traces that have expected capabilities. held-out is
  // measurement, not training. We also skip traces where capabilityHit was
  // already 1.0 (nothing to learn).
  const trainables = input.traces.filter(
    (t) => t.corpus === 'ideasai' && t.expectedCapabilities.length > 0 && t.capabilityHit < 1.0,
  )

  const examples: AxTypedExample<BriefExampleInput>[] = trainables.slice(0, 30).map((t) => ({
    userPrompt: t.prompt,
    knownFamilies,
    knownCapabilities,
  }))

  const expectedByPrompt = new Map<string, string[]>()
  for (const t of trainables) expectedByPrompt.set(t.prompt, t.expectedCapabilities)

  const briefProgram = ax(BRIEF_SIGNATURE)
  const metric = makeMetric(expectedByPrompt)

  let bestScore = 0
  let instruction: string | undefined
  let instructionMap: Record<string, string> | undefined
  let demos: unknown[] | undefined
  let modelConfig: Record<string, unknown> | undefined
  let optimizerType = 'variant_b.fallback'
  let optimizationTime = 0
  let totalRounds = 0
  let converged = false
  let scoreHistory: number[] | undefined

  if (examples.length >= 3) {
    try {
      const optimizer = new AxMiPRO({
        studentAI: input.llm,
        numTrials: 3,
        numCandidates: 3,
        minibatch: true,
        minibatchSize: Math.min(6, examples.length),
        verbose: false,
        seed: 42,
      })
      optimizer.configureAuto(input.auto ?? 'light')

      const t0 = Date.now()
      const result = await optimizer.compile(briefProgram, examples, metric, {
        maxMetricCalls: Math.max(examples.length * 2, 12),
        auto: input.auto ?? 'light',
        verbose: false,
      })
      optimizationTime = Date.now() - t0

      const opt = result.optimizedProgram as AxOptimizedProgram<BriefPrediction> | undefined
      if (opt) {
        bestScore = opt.bestScore
        instruction = opt.instruction
        instructionMap = opt.instructionMap
        demos = opt.demos as unknown[] | undefined
        modelConfig = opt.modelConfig
        optimizerType = opt.optimizerType
        totalRounds = opt.totalRounds
        converged = opt.converged
        scoreHistory = opt.scoreHistory
      } else if (result.bestScore !== undefined) {
        bestScore = result.bestScore
      }
    } catch (err) {
      // Rate-limits, provider blips — fall back to the corpus-mined instruction
      // so the variant still produces an artifact.
      // eslint-disable-next-line no-console
      console.warn('[variant_b/train] AxMiPRO failed, using fallback:', err instanceof Error ? err.message : err)
    }
  }

  // Always attach a corpus-mined instruction as a floor. This is the part that
  // reliably moves capHit because it surfaces the exact vocabulary the
  // deterministic planner keys off. Real optimization can only improve on it.
  if (!instruction) {
    instruction = buildCorpusMinedInstruction(trainables, knownCapabilities)
    optimizerType = optimizerType === 'variant_b.fallback' ? 'variant_b.corpus-mined' : optimizerType
  }

  const artifact: SerializedOptimizedProgram = {
    optimizerType,
    bestScore,
    instruction,
    instructionMap,
    demos: Array.isArray(demos) ? demos.slice(0, 8) : demos,
    modelConfig,
    optimizationTime,
    totalRounds,
    converged,
    scoreHistory,
    artifactFormatVersion: 1,
    signature: BRIEF_SIGNATURE,
    promptShape: 'brief',
    trainedAt: new Date().toISOString(),
    trainingTraceCount: trainables.length,
    knownFamilies,
    knownCapabilities,
  }

  await mkdir(path.dirname(input.outPath), { recursive: true })
  await writeFile(input.outPath, JSON.stringify(artifact, null, 2))

  return { optimizedProgram: artifact, outPath: input.outPath }
}

// Mine the training traces to learn the high-signal vocabulary. For each
// expected capability that was missed, collect the keywords from the original
// prompt that co-occur with it. Build those into a tight instruction that
// tells the brief agent to SURFACE the capability name explicitly when it
// sees those keywords. This is the deterministic floor the optimizer must
// beat. In practice it already lifts ideasaiCapHit materially because the
// brief's canonicalPrompt will contain the exact layer IDs the planner scans.
export function buildCorpusMinedInstruction(trainables: Trace[], knownCapabilities: string[]): string {
  const capToKeywords = new Map<string, Map<string, number>>()
  for (const t of trainables) {
    const words = t.prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4)
    for (const cap of t.expectedCapabilities) {
      if (t.actualCapabilities.includes(cap)) continue // already hit, no lesson
      if (!capToKeywords.has(cap)) capToKeywords.set(cap, new Map())
      const m = capToKeywords.get(cap)!
      for (const w of words) m.set(w, (m.get(w) ?? 0) + 1)
    }
  }
  const lines: string[] = []
  lines.push('ALWAYS name the capability IDs explicitly in canonicalPrompt when the user prompt matches.')
  lines.push('For ambiguous AI-saas prompts, prefer fullstack-ts or nextjs-ts family.')
  lines.push('Route rules (ordered):')
  const entries = [...capToKeywords.entries()]
    .map(([cap, m]) => ({ cap, top: [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w) }))
    .filter((e) => knownCapabilities.includes(e.cap))
    .slice(0, 12)
  for (const { cap, top } of entries) {
    lines.push(`- If prompt mentions any of [${top.join(', ')}] include "${cap}" in canonicalPrompt.`)
  }
  lines.push('ALWAYS include capability:tailwind for any UI that renders pages.')
  lines.push('ALWAYS include capability:layout-dashboard when prompt describes analytics, tracking, monitoring, or multiple views.')
  lines.push('ALWAYS include capability:layout-chat when prompt describes messaging, conversation, or companion UX.')
  lines.push('ALWAYS include capability:ai-chat-ui when the product is AI-driven or talks to the user.')
  return lines.join('\n')
}

export async function loadOptimizedProgram(optimizedPath: string): Promise<SerializedOptimizedProgram | null> {
  try {
    const raw = await readFile(optimizedPath, 'utf8')
    return JSON.parse(raw) as SerializedOptimizedProgram
  } catch {
    return null
  }
}
