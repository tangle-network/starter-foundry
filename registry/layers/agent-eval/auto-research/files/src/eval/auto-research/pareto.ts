/**
 * auto-research:pareto — multi-objective frontier over (quality, cost, latency).
 *
 * A research-harness rarely has a single scalar goal. A variant that
 * raises pass-rate by 2pp but doubles cost is not strictly an
 * improvement; the validator should surface BOTH points on the frontier
 * and let the operator decide.
 *
 * This module composes `paretoFrontier` and `paretoFrontierWithCrowding`
 * from agent-eval. The default objectives are the three axes every
 * research-harness should be tracking; consumers can override.
 */

import {
  paretoFrontier,
  paretoFrontierWithCrowding,
  type Objective,
  type ParetoResult,
} from '@tangle-network/agent-eval'

export interface VariantPoint {
  variantId: string
  /** 0..1 quality (pass-rate, judge mean, whatever the harness reports). */
  quality: number
  /** USD spent across the run. Lower is better. */
  costUsd: number
  /** Wall-clock seconds. Lower is better. */
  wallSeconds: number
}

export const DEFAULT_OBJECTIVES: Objective<VariantPoint>[] = [
  { name: 'quality', direction: 'maximize', value: (p) => p.quality },
  { name: 'cost', direction: 'minimize', value: (p) => p.costUsd },
  { name: 'latency', direction: 'minimize', value: (p) => p.wallSeconds },
]

/**
 * Filter a candidate list to the Pareto-non-dominated set across
 * (quality, cost, latency). Pass-through to agent-eval's `paretoFrontier`.
 */
export function frontier(
  candidates: VariantPoint[],
  objectives: Objective<VariantPoint>[] = DEFAULT_OBJECTIVES,
): ParetoResult<VariantPoint> {
  return paretoFrontier(candidates, objectives)
}

/**
 * NSGA-II frontier with crowding-distance tie-break. Returns the frontier
 * sorted by descending crowding distance — `.slice(0, k)` to pick K
 * diverse winners when a single scalar isn't desired.
 */
export function diverseFrontier(
  candidates: VariantPoint[],
  objectives: Objective<VariantPoint>[] = DEFAULT_OBJECTIVES,
): Array<{ candidate: VariantPoint; distance: number }> {
  return paretoFrontierWithCrowding(candidates, objectives)
}

export type { Objective, ParetoResult } from '@tangle-network/agent-eval'
