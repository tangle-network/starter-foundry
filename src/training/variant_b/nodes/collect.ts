// collect node: reads ideasai + held-out corpora, runs the current planner on
// each prompt, and materializes a typed Trace per scenario. Traces are the
// only thing the train node reads — decoupling the corpus loader from the
// optimizer. A different collect implementation (live prod traffic, synthetic
// scenarios, etc.) can be swapped in without touching train.

import { readFile, mkdir, appendFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

import { planPrompt } from '../../../lib/prompt-planner.js'

export interface Trace {
  scenarioId: string
  corpus: 'ideasai' | 'held-out'
  prompt: string
  partner: string | null
  expectedFamily: string | null
  expectedCapabilities: string[]
  actualFamily: string | null
  actualCapabilities: string[]
  kindMatch: boolean
  familyMatch: boolean
  capabilityHit: number
  latencyMs: number
  error: string | null
  timestamp: string
}

export interface CollectInput {
  corpusPath: string
  tracesDir: string
  limit?: number
  includeHeldOut?: boolean
}

export interface CollectOutput {
  traces: Trace[]
  tracesFile: string
  coverageGaps: { capability: string; missCount: number }[]
}

interface IdeasaiScenario {
  id: string
  prompt: string
  expectedFamily?: string
  expectedCapabilities?: string[]
}

interface HeldOutScenario {
  id: string
  prompt: string
  partner?: string | null
  expected?: { kind?: string; family?: string; capabilities?: string[] }
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

function extractActual(plan: unknown): {
  kind: string | null
  family: string | null
  capabilities: string[]
} {
  const p = plan as {
    kind?: string
    spec?: { family?: string; layers?: string[]; projects?: { layers?: string[] }[] }
  } | null
  if (!p) return { kind: null, family: null, capabilities: [] }
  if (p.kind === 'starter') {
    return { kind: 'starter', family: p.spec?.family ?? null, capabilities: p.spec?.layers ?? [] }
  }
  if (p.kind === 'workspace') {
    const caps: string[] = []
    for (const proj of p.spec?.projects ?? []) {
      for (const layer of proj.layers ?? []) caps.push(layer)
    }
    return { kind: 'workspace', family: 'workspace', capabilities: caps }
  }
  return { kind: p.kind ?? null, family: null, capabilities: [] }
}

export async function collectNode(input: CollectInput): Promise<CollectOutput> {
  const ideasRaw = await readFile(input.corpusPath, 'utf8')
  const ideas = JSON.parse(ideasRaw) as IdeasaiScenario[]

  const scenarios: {
    id: string
    corpus: 'ideasai' | 'held-out'
    prompt: string
    partner: string | null
    expectedFamily: string | null
    expectedCapabilities: string[]
  }[] = []

  for (const s of ideas) {
    scenarios.push({
      id: s.id,
      corpus: 'ideasai',
      prompt: s.prompt,
      partner: null,
      expectedFamily: s.expectedFamily ?? null,
      expectedCapabilities: s.expectedCapabilities ?? [],
    })
  }

  if (input.includeHeldOut !== false) {
    try {
      const heldRaw = await readFile('corpus/held-out-validation.json', 'utf8')
      const held = JSON.parse(heldRaw) as { scenarios: HeldOutScenario[] }
      for (const s of held.scenarios) {
        scenarios.push({
          id: s.id,
          corpus: 'held-out',
          prompt: s.prompt,
          partner: s.partner ?? null,
          expectedFamily: s.expected?.family ?? null,
          expectedCapabilities: s.expected?.capabilities ?? [],
        })
      }
    } catch {
      // held-out missing is fine for unit tests
    }
  }

  const limited = input.limit ? scenarios.slice(0, input.limit) : scenarios
  const traces: Trace[] = []
  const missPerCap = new Map<string, number>()

  await mkdir(input.tracesDir, { recursive: true })
  const tracesFile = path.join(input.tracesDir, `variant_b-${Date.now()}.jsonl`)

  for (const s of limited) {
    const t0 = performance.now()
    let plan: unknown = null
    let error: string | null = null
    try {
      plan = await planPrompt({ prompt: s.prompt, partner: s.partner })
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
    const latencyMs = performance.now() - t0
    const actual = extractActual(plan)
    const familyMatch = s.expectedFamily ? actual.family === s.expectedFamily : true
    const capabilityHit = s.expectedCapabilities.length
      ? jaccard(actual.capabilities, s.expectedCapabilities)
      : 1

    for (const cap of s.expectedCapabilities) {
      if (!actual.capabilities.includes(cap)) {
        missPerCap.set(cap, (missPerCap.get(cap) ?? 0) + 1)
      }
    }

    const trace: Trace = {
      scenarioId: s.id,
      corpus: s.corpus,
      prompt: s.prompt,
      partner: s.partner,
      expectedFamily: s.expectedFamily,
      expectedCapabilities: s.expectedCapabilities,
      actualFamily: actual.family,
      actualCapabilities: actual.capabilities,
      kindMatch: actual.kind !== null,
      familyMatch,
      capabilityHit,
      latencyMs,
      error,
      timestamp: new Date().toISOString(),
    }
    traces.push(trace)
    await appendFile(tracesFile, JSON.stringify(trace) + '\n')
  }

  const coverageGaps = [...missPerCap.entries()]
    .map(([capability, missCount]) => ({ capability, missCount }))
    .sort((a, b) => b.missCount - a.missCount)

  return { traces, tracesFile, coverageGaps }
}
