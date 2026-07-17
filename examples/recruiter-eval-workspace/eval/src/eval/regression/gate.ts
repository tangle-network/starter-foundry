// Statistical regression gate.
//
// Reads two scorecards (baseline + head), treats every flow's value as a
// single sample (since scorecards are aggregates, not raw runs), and runs:
//
//   1. Per-flow `bootstrapCi` on baseline-vs-head — non-parametric, robust.
//      With single-sample-per-side scorecards we still get a delta point
//      estimate; the CI degenerates but the verdict is honest about it
//      (returns INCONCLUSIVE rather than fake-confident).
//   2. `welchsTTest` and `cohensD` when the caller passes raw per-scenario
//      sample arrays via `withSamples`.
//   3. `compareToBaseline` for a wholesale per-metric verdict shape.
//   4. `benjaminiHochberg` over the p-values to control FDR across flows.
//
// Final verdict is the worst of all flows:
//   - REVERT if any flow's verdict is `regressed` AND BH-significant.
//   - HOLD if any flow is `unstable` and no flow is regressed.
//   - PROMOTE otherwise.

import {
  bootstrapCi,
  welchsTTest,
  cohensD,
  compareToBaseline,
  benjaminiHochberg,
  type BootstrapResult,
  type MetricSamples,
  type MetricVerdict,
} from '@tangle-network/agent-eval'
import type { Scorecard, ScorecardFlow } from '../scorecard.js'

export type GateVerdict = 'PROMOTE' | 'HOLD' | 'REVERT'
export const GATE_EXIT: Record<GateVerdict, number> = {
  PROMOTE: 0,
  REVERT: 1,
  HOLD: 2,
}

export interface GateOptions {
  /** Confidence level alpha for bootstrap. Default 0.05 → 95% CI. */
  alpha?: number
  /** False-discovery-rate target for Benjamini–Hochberg. Default 0.1. */
  fdr?: number
  /** Effect size threshold for compareToBaseline. Default 0.5 (medium). */
  effectThreshold?: number
  /** Stability threshold for compareToBaseline. Default 0.30. */
  unstableCvThreshold?: number
  /** Optional raw samples per metric for higher-rigor gating. */
  withSamples?: Map<string, { baseline: number[]; candidate: number[] }>
  /** Optional dimension filter — when set, only these flows gate the build. */
  onlyFlows?: ReadonlySet<string>
}

export interface PerFlowVerdict {
  flow: string
  baseline: number
  head: number
  delta: number
  bootstrap: BootstrapResult | null
  welch: { t: number; df: number; p: number } | null
  cohensD: number | null
  metricVerdict: MetricVerdict | null
  bhSignificant: boolean
  bhQValue: number | null
  verdict: 'improved' | 'regressed' | 'stable' | 'unstable' | 'inconclusive'
  direction: 'higher-better' | 'lower-better'
}

export interface GateReport {
  verdict: GateVerdict
  reason: string
  perFlow: PerFlowVerdict[]
  generatedAt: string
  baselineProduct: string
  headProduct: string
  alpha: number
  fdr: number
}

const STABILITY_EPSILON = 0.005

function flowsByName(s: Scorecard): Map<string, ScorecardFlow> {
  const m = new Map<string, ScorecardFlow>()
  for (const f of s.flows) m.set(f.name, f)
  return m
}

export function gate(baseline: Scorecard, head: Scorecard, opts: GateOptions = {}): GateReport {
  const alpha = opts.alpha ?? 0.05
  const fdr = opts.fdr ?? 0.1
  const effectThreshold = opts.effectThreshold ?? 0.5
  const unstableCvThreshold = opts.unstableCvThreshold ?? 0.3
  const baselineFlows = flowsByName(baseline)
  const headFlows = flowsByName(head)
  const allNames = new Set<string>([...baselineFlows.keys(), ...headFlows.keys()])
  const filteredNames = opts.onlyFlows
    ? Array.from(allNames).filter((n) => opts.onlyFlows!.has(n))
    : Array.from(allNames)

  // Build MetricSamples for compareToBaseline. When the caller provides
  // raw per-scenario samples, use them; otherwise treat the scorecard
  // values as single-sample arrays (limited rigor, but honest verdicts).
  const metricSamples: MetricSamples[] = []
  for (const name of filteredNames) {
    const b = baselineFlows.get(name)
    const h = headFlows.get(name)
    if (!b || !h) continue
    const samples = opts.withSamples?.get(name)
    metricSamples.push({
      metric: name,
      higherIsBetter: (b.direction ?? 'higher-better') === 'higher-better',
      baseline: samples?.baseline ?? [b.value],
      candidate: samples?.candidate ?? [h.value],
    })
  }
  const baselineReport = compareToBaseline(metricSamples, {
    alpha,
    effectThreshold,
    unstableCvThreshold,
  })
  const verdictByMetric = new Map<string, MetricVerdict>()
  for (const m of baselineReport.metrics) verdictByMetric.set(m.metric, m)

  // BH-correct the per-flow p-values.
  const orderedNames: string[] = []
  const orderedP: number[] = []
  for (const m of baselineReport.metrics) {
    orderedNames.push(m.metric)
    orderedP.push(m.welchP)
  }
  const bh =
    orderedP.length > 0
      ? benjaminiHochberg(orderedP, fdr)
      : { qValues: [] as number[], significant: [] as boolean[] }
  const bhByName = new Map<string, { q: number; sig: boolean }>()
  for (let i = 0; i < orderedNames.length; i++) {
    bhByName.set(orderedNames[i]!, {
      q: bh.qValues[i] ?? 1,
      sig: bh.significant[i] ?? false,
    })
  }

  const perFlow: PerFlowVerdict[] = []
  for (const name of filteredNames) {
    const b = baselineFlows.get(name)
    const h = headFlows.get(name)
    if (!b && h) {
      perFlow.push({
        flow: name,
        baseline: 0,
        head: h.value,
        delta: h.value,
        bootstrap: null,
        welch: null,
        cohensD: null,
        metricVerdict: null,
        bhSignificant: false,
        bhQValue: null,
        verdict: 'inconclusive',
        direction: h.direction ?? 'higher-better',
      })
      continue
    }
    if (b && !h) {
      perFlow.push({
        flow: name,
        baseline: b.value,
        head: 0,
        delta: -b.value,
        bootstrap: null,
        welch: null,
        cohensD: null,
        metricVerdict: null,
        bhSignificant: false,
        bhQValue: null,
        verdict: 'inconclusive',
        direction: b.direction ?? 'higher-better',
      })
      continue
    }
    if (!b || !h) continue

    const samples = opts.withSamples?.get(name)
    const baselineSamples = samples?.baseline ?? [b.value]
    const candidateSamples = samples?.candidate ?? [h.value]

    let bootstrap: BootstrapResult | null = null
    let welch: { t: number; df: number; p: number } | null = null
    let cd: number | null = null
    if (baselineSamples.length + candidateSamples.length >= 6) {
      bootstrap = bootstrapCi(baselineSamples, candidateSamples, { alpha })
      welch = welchsTTest(baselineSamples, candidateSamples)
      cd = cohensD(baselineSamples, candidateSamples)
    }

    const metricVerdict = verdictByMetric.get(name) ?? null
    const bhEntry = bhByName.get(name) ?? null
    const direction = b.direction ?? 'higher-better'

    let verdict: PerFlowVerdict['verdict'] = 'stable'
    if (metricVerdict) {
      verdict = metricVerdict.verdict
    } else {
      // Fallback when compareToBaseline didn't yield a verdict (single sample).
      const delta = h.value - b.value
      if (Math.abs(delta) < STABILITY_EPSILON) verdict = 'stable'
      else {
        const better = direction === 'higher-better' ? delta > 0 : delta < 0
        verdict = better ? 'improved' : 'regressed'
      }
    }

    perFlow.push({
      flow: name,
      baseline: b.value,
      head: h.value,
      delta: h.value - b.value,
      bootstrap,
      welch,
      cohensD: cd,
      metricVerdict,
      bhSignificant: bhEntry?.sig ?? false,
      bhQValue: bhEntry?.q ?? null,
      verdict,
      direction,
    })
  }

  // Final verdict: REVERT if any regressed flow is BH-significant
  // (or, in single-sample mode, regressed at all). HOLD on unstable
  // without regressions. PROMOTE otherwise.
  let finalVerdict: GateVerdict = 'PROMOTE'
  let reason = 'No flow regressed; aggregate stable or improved.'
  const regressed = perFlow.filter((p) => p.verdict === 'regressed')
  const significantRegressions = regressed.filter(
    (p) => p.bhSignificant || (p.metricVerdict === null && Math.abs(p.delta) >= STABILITY_EPSILON),
  )
  const unstable = perFlow.filter((p) => p.verdict === 'unstable')
  if (significantRegressions.length > 0) {
    finalVerdict = 'REVERT'
    reason = `Statistically significant regressions on: ${significantRegressions.map((p) => p.flow).join(', ')}`
  } else if (regressed.length > 0) {
    finalVerdict = 'HOLD'
    reason = `Possible regressions (not BH-significant): ${regressed.map((p) => p.flow).join(', ')}`
  } else if (unstable.length > 0) {
    finalVerdict = 'HOLD'
    reason = `Flows too noisy to gate on: ${unstable.map((p) => p.flow).join(', ')}`
  }

  return {
    verdict: finalVerdict,
    reason,
    perFlow,
    generatedAt: new Date().toISOString(),
    baselineProduct: baseline.product,
    headProduct: head.product,
    alpha,
    fdr,
  }
}
