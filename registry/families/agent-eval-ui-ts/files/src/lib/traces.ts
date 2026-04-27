// traces — loaders + types for agent-eval artifacts.
//
// Schema is inferred from `.evolve/agent-eval/<runDate>/` outputs produced by
// scripts/agent-eval-scaffold.ts. Documented fields are concrete; speculative
// fields (turns array, per-turn tool-calls) are populated when the trace
// includes them and otherwise left empty arrays. This keeps the UI useful
// against today's run shape while degrading gracefully against future shapes.

export interface Turn {
  idx: number
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: ToolCall[]
  /** Wall-clock for this turn in milliseconds, when the trace records it. */
  latencyMs?: number
  /** Total tokens spent on this turn (prompt + completion), when recorded. */
  tokens?: number
}

export interface ToolCall {
  name: string
  args: unknown
  result: unknown
}

export interface AgentEvalTrace {
  /** Stable trace id, derived from `${runDate}:${seed}` when not present. */
  id: string
  /** Family / scaffold id under test (e.g. "agent-runtime-research"). */
  family: string
  /** Seed prompt id from seeds.json. */
  seed: string
  /** Run date the trace belongs to (YYYY-MM-DD). */
  runDate: string
  /** ISO timestamp when the run was recorded. */
  createdAt: string
  /** "pass" if all dimensions ≥ thresholds; "fail" if any failed; "scaffold" for scaffold-only runs. */
  status: 'pass' | 'fail' | 'scaffold' | 'error'
  /** Optional error message when status === "error". */
  error?: string
  /**
   * Multi-dimensional scores keyed by dimension name. Conventional keys:
   *   correctness, helpfulness, structural, build, runtime, meta, latencyP95, costUsd.
   * Loader normalises agent-eval-scaffold report fields into this shape.
   */
  scores: Record<string, number>
  /** Turn-by-turn replay. Empty when the run is scaffold-only (no agent loop). */
  turns: Turn[]
  /** Total wall time for the run in ms. */
  wallMs?: number
  /** Inferred-but-unverified — populated when traces.jsonl contains a "phase" field. */
  phases?: { phase: string; ok: boolean; error?: string }[]
}

interface TracesApiResponse {
  missing: boolean
  dir: string
  files: { path: string; content: string }[]
  error?: string
}

interface ThreeLayerProject {
  projectId: string
  kind?: string
  buildScore?: number | null
  metaScore?: number | null
  runtimeScore?: number | null
  runtimePassRate?: number | null
  complete?: boolean
}

interface ThreeLayerReport {
  summary?: { timestamp?: string; meanBuildScore?: number | null; meanMetaScore?: number | null }
  projects?: ThreeLayerProject[]
  runReports?: { seed: string; projectId: string; wallMs?: number; structuralScore?: number; buildScore?: number }[]
}

interface CostSummary {
  totalUsd?: number
  bySeed?: Record<string, { totalUsd?: number; latencyP95Ms?: number }>
}

interface PhaseRow {
  seed?: string
  projectId?: string
  phase?: string
  ok?: boolean
  error?: string
  ts?: string
  /** Optional per-row turn payload (only present in fuller runs). */
  turns?: Array<Partial<Turn> & { content?: string; role?: string }>
}

interface StructuralRow {
  seed?: string
  projectId?: string
  pass?: boolean
  score?: number
  total?: number
  failures?: string[]
}

function safeParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function parseJsonl<T>(text: string): T[] {
  const out: T[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parsed = safeParse<T>(trimmed)
    if (parsed !== null) out.push(parsed)
  }
  return out
}

function inferStatus(args: {
  phases: PhaseRow[]
  structural?: StructuralRow
  project?: ThreeLayerProject
}): AgentEvalTrace['status'] {
  const errPhase = args.phases.find((p) => p.error)
  if (errPhase) return 'error'
  if (args.structural && args.structural.pass === false) return 'fail'
  if (args.project?.kind === 'scaffold-only') return 'scaffold'
  if (args.project?.complete) return 'pass'
  if (args.phases.length === 0 && !args.project) return 'scaffold'
  return 'fail'
}

function deriveFamily(seed: string, projectId?: string): string {
  // projectId looks like "scaffold:forge-contracts" or "full:agent-runtime-research:42".
  if (projectId) {
    const segs = projectId.split(':')
    if (segs.length >= 2) return segs[1]!
  }
  return seed
}

function turnsFromPhases(phases: PhaseRow[]): Turn[] {
  const turns: Turn[] = []
  let idx = 0
  for (const p of phases) {
    if (p.turns && Array.isArray(p.turns)) {
      for (const t of p.turns) {
        const role = (t.role as Turn['role']) ?? 'assistant'
        turns.push({
          idx: idx++,
          role,
          content: t.content ?? '',
          toolCalls: t.toolCalls,
          latencyMs: t.latencyMs,
          tokens: t.tokens,
        })
      }
    } else {
      // Synthesise a single tool-style turn from the phase metadata so the
      // timeline view renders something useful even on minimal traces.
      turns.push({
        idx: idx++,
        role: 'tool',
        content: p.error ? `${p.phase ?? 'phase'} failed: ${p.error}` : `${p.phase ?? 'phase'} ok`,
      })
    }
  }
  return turns
}

/**
 * Read every JSONL/JSON artifact under `dir` (via the dev-server middleware
 * mounted at /__traces) and assemble a normalised AgentEvalTrace[]. Sorted
 * newest-first. Returns an empty list on missing dir + logs a warning.
 */
export async function loadTraces(dir = '/__traces'): Promise<AgentEvalTrace[]> {
  const res = await fetch(dir).catch((err) => {
    throw new Error(`Failed to fetch traces from ${dir}: ${err}`)
  })
  if (!res.ok) throw new Error(`traces api returned ${res.status}`)
  const payload = (await res.json()) as TracesApiResponse
  if (payload.error) throw new Error(`traces api error: ${payload.error}`)
  if (payload.missing) {
    console.warn(`[agent-eval-ui] traces dir does not exist: ${payload.dir}`)
    return []
  }

  // Bucket files by run date (top-level subdir). Files at the root (e.g.
  // seeds.json) are global metadata, attached to every trace.
  type RunBucket = {
    date: string
    traces: Map<string, PhaseRow[]>
    structural: Map<string, StructuralRow>
    threeLayer?: ThreeLayerReport
    costs?: CostSummary
  }
  const runs = new Map<string, RunBucket>()
  const ensure = (date: string): RunBucket => {
    let b = runs.get(date)
    if (!b) {
      b = { date, traces: new Map(), structural: new Map() }
      runs.set(date, b)
    }
    return b
  }

  for (const file of payload.files) {
    const segs = file.path.split('/')
    if (segs.length < 2) continue // root-level metadata; skip for per-run bucketing
    const date = segs[0]!
    const name = segs[segs.length - 1]!
    const bucket = ensure(date)
    if (name === 'traces.jsonl') {
      for (const row of parseJsonl<PhaseRow>(file.content)) {
        const key = row.seed ?? row.projectId ?? 'unknown'
        const arr = bucket.traces.get(key) ?? []
        arr.push(row)
        bucket.traces.set(key, arr)
      }
    } else if (name === 'structural-assertions.jsonl') {
      for (const row of parseJsonl<StructuralRow>(file.content)) {
        const key = row.seed ?? row.projectId ?? 'unknown'
        bucket.structural.set(key, row)
      }
    } else if (name === 'three-layer-report.json') {
      const parsed = safeParse<ThreeLayerReport>(file.content)
      if (parsed) bucket.threeLayer = parsed
    } else if (name === 'cost-summary.json') {
      const parsed = safeParse<CostSummary>(file.content)
      if (parsed) bucket.costs = parsed
    }
  }

  const traces: AgentEvalTrace[] = []
  for (const bucket of runs.values()) {
    const projectsBySeed = new Map<string, ThreeLayerProject>()
    for (const p of bucket.threeLayer?.projects ?? []) {
      const segs = p.projectId.split(':')
      const seed = segs[segs.length - 1]!
      projectsBySeed.set(seed, p)
    }
    const reportsBySeed = new Map(bucket.threeLayer?.runReports?.map((r) => [r.seed, r]) ?? [])

    // Union of seeds seen anywhere in this run.
    const seeds = new Set<string>([
      ...bucket.traces.keys(),
      ...bucket.structural.keys(),
      ...projectsBySeed.keys(),
      ...reportsBySeed.keys(),
    ])

    for (const seed of seeds) {
      const phases = bucket.traces.get(seed) ?? []
      const structural = bucket.structural.get(seed)
      const project = projectsBySeed.get(seed)
      const report = reportsBySeed.get(seed)
      const cost = bucket.costs?.bySeed?.[seed]

      const scores: Record<string, number> = {}
      if (typeof report?.structuralScore === 'number') scores.structural = report.structuralScore
      if (typeof report?.buildScore === 'number') scores.build = report.buildScore
      if (typeof project?.buildScore === 'number') scores.build = project.buildScore
      if (typeof project?.metaScore === 'number') scores.meta = project.metaScore
      if (typeof project?.runtimeScore === 'number') scores.runtime = project.runtimeScore
      if (typeof project?.runtimePassRate === 'number') scores.runtimePassRate = project.runtimePassRate
      if (typeof structural?.score === 'number') scores.structural = structural.score
      if (typeof cost?.totalUsd === 'number') scores.costUsd = cost.totalUsd
      if (typeof cost?.latencyP95Ms === 'number') scores.latencyP95 = cost.latencyP95Ms

      const errPhase = phases.find((p) => p.error)
      const trace: AgentEvalTrace = {
        id: `${bucket.date}:${seed}`,
        family: deriveFamily(seed, project?.projectId),
        seed,
        runDate: bucket.date,
        createdAt: bucket.threeLayer?.summary?.timestamp ?? `${bucket.date}T00:00:00.000Z`,
        status: inferStatus({ phases, structural, project }),
        error: errPhase?.error,
        scores,
        turns: turnsFromPhases(phases),
        wallMs: report?.wallMs,
        phases: phases.map((p) => ({ phase: p.phase ?? 'unknown', ok: p.ok ?? !p.error, error: p.error })),
      }
      traces.push(trace)
    }
  }

  traces.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
  return traces
}

/** Concatenate all assistant-text content across turns. Used to detect ::: blocks. */
export function assistantText(trace: AgentEvalTrace): string {
  return trace.turns
    .filter((t) => t.role === 'assistant')
    .map((t) => t.content)
    .join('\n\n')
}
