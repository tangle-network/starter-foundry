import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Shape of events emitted by blueprint-agent / vibecode-bench (VB) to
 * `<starter-foundry-root>/.evolve/traces/vb-execution-<variant>.jsonl`.
 * The producer lives in blueprint-agent repo (lib/vb-execution-trace.ts)
 * commit 9f9e381f4. This is the real-outcome signal the training loop
 * was missing — every event is a full downstream scaffold buildout
 * with its labeled pass/fail outcome per layer category.
 */
export interface VBExecutionTrace {
  scenarioId: string
  partner: string
  latencyMs: number
  timestamp: string
  error: string | null
  execution: {
    verticalId: string
    generation: number
    variantName: string
    model: string
    outcome: 'satisfied' | 'max-wall-time' | 'error' | string
    blendedScore: number
    allPass: boolean
    failingLayers: string[]
    shotsToConvergence: number | null
    shotsRun: number
    wallMs: number
    totalCostUsd: number | null
    toolCallsTotal: number
    toolCallSuccesses: number
    toolCallFailures: number
    filesTouchedCount: number
    bashCommandsTop: Array<{ cmd: string; count: number }>
    sessionDir: string
  }
}

/** Aggregate stats per scenarioId — the training-relevant projection. */
interface ScenarioOutcome {
  scenarioId: string
  partner: string
  runs: number
  passed: number
  passRate: number
  meanBlendedScore: number
  meanWallMs: number
  meanToolCalls: number
  failingLayersByKind: Record<string, number>
  failingLayersPerRun: number
}

/** Load every VB trace file from the traces directory. */
export async function loadVBTraces(
  tracesDir: string = '.evolve/traces',
): Promise<VBExecutionTrace[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(tracesDir)
  } catch {
    return []
  }
  const files = entries.filter((f) => f.startsWith('vb-execution-') && f.endsWith('.jsonl'))
  const all: VBExecutionTrace[] = []
  for (const file of files) {
    const raw = await fs.readFile(path.join(tracesDir, file), 'utf8')
    for (const line of raw.trim().split('\n')) {
      if (!line) continue
      try {
        all.push(JSON.parse(line) as VBExecutionTrace)
      } catch {
        // skip malformed
      }
    }
  }
  return all
}

/** Roll up per-scenario stats. */
export function aggregateByScenario(traces: VBExecutionTrace[]): ScenarioOutcome[] {
  const byScenario = new Map<string, ScenarioOutcome>()
  for (const t of traces) {
    const key = `${t.scenarioId}::${t.partner}`
    let s = byScenario.get(key)
    if (!s) {
      s = {
        scenarioId: t.scenarioId,
        partner: t.partner,
        runs: 0,
        passed: 0,
        passRate: 0,
        meanBlendedScore: 0,
        meanWallMs: 0,
        meanToolCalls: 0,
        failingLayersByKind: {},
        failingLayersPerRun: 0,
      }
      byScenario.set(key, s)
    }
    s.runs++
    if (t.execution.allPass) s.passed++
    s.meanBlendedScore += t.execution.blendedScore
    s.meanWallMs += t.execution.wallMs
    s.meanToolCalls += t.execution.toolCallsTotal
    for (const layer of t.execution.failingLayers ?? []) {
      s.failingLayersByKind[layer] = (s.failingLayersByKind[layer] ?? 0) + 1
    }
  }
  for (const s of byScenario.values()) {
    s.passRate = s.runs > 0 ? s.passed / s.runs : 0
    s.meanBlendedScore /= s.runs || 1
    s.meanWallMs /= s.runs || 1
    s.meanToolCalls /= s.runs || 1
    s.failingLayersPerRun =
      Object.values(s.failingLayersByKind).reduce((a, b) => a + b, 0) / (s.runs || 1)
  }
  return [...byScenario.values()].sort((a, b) => b.passRate - a.passRate)
}

/** Flat failure-category histogram across every trace. */
export function failingLayerHistogram(traces: VBExecutionTrace[]): Record<string, number> {
  const hist: Record<string, number> = {}
  for (const t of traces) {
    for (const layer of t.execution.failingLayers ?? []) {
      hist[layer] = (hist[layer] ?? 0) + 1
    }
  }
  return hist
}

/** Scenarios with zero pass rate — the scaffolds that never build. */
export function brokenScenarios(outcomes: ScenarioOutcome[]): ScenarioOutcome[] {
  return outcomes.filter((o) => o.passRate === 0 && o.runs >= 2)
}

/** Scenarios consistently reaching satisfied — high-confidence positives. */
export function strongScenarios(outcomes: ScenarioOutcome[]): ScenarioOutcome[] {
  return outcomes.filter((o) => o.passRate === 1 && o.meanBlendedScore >= 0.9 && o.runs >= 2)
}
