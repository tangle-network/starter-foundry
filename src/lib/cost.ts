/**
 * Cost-per-buildout estimator.
 *
 * Given a BuildoutEvent, estimate how much it cost to produce. The estimator
 * is intentionally simple: a rate table for per-million-tokens input/output
 * prices keyed by a normalized model name, plus a heuristic token count from
 * (toolCallsTotal × avg_tokens_per_tool_call) + ((initialPrompt + outcome
 * metadata) / 4).
 *
 * Rate table lives in corpus/model-rates.json and is pluggable so we can
 * refresh prices without shipping code. Unknown models fall back to a
 * conservative "unknown" entry.
 */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BuildoutEvent } from './buildout-traces.js'

/** Average tokens emitted per tool call (tool args + tool result + assistant thinking). */
export const DEFAULT_AVG_TOKENS_PER_TOOL_CALL = 850

export interface ModelRate {
  /** Canonical id, e.g. "claude-opus-4-7". */
  id: string
  /** Aliases/substring matches used to route sourceModel to this rate. */
  aliases: string[]
  /** USD per million input tokens. */
  inputUsdPerMtok: number
  /** USD per million output tokens. */
  outputUsdPerMtok: number
  /**
   * Assumed output/input split for unknown traces. Most agent sessions emit
   * ~30% output tokens (reasoning + tool args) and ~70% input tokens
   * (prompts + tool results fed back in).
   */
  outputShare?: number
}

export interface CostRateTable {
  schemaVersion: 1
  defaultOutputShare: number
  avgTokensPerToolCall: number
  rates: ModelRate[]
  unknown: ModelRate
}

export interface CostEstimate {
  tokenEstimate: number
  inputTokens: number
  outputTokens: number
  usdEstimate: number
  model: string
  /** Rate entry actually used. */
  rateId: string
}

let cachedTable: CostRateTable | null = null

export function clearRateTableCache(): void {
  cachedTable = null
}

export async function loadRateTable(path?: string): Promise<CostRateTable> {
  if (cachedTable && !path) return cachedTable
  const resolvedPath =
    path ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'corpus', 'model-rates.json')
  const raw = await readFile(resolvedPath, 'utf8')
  const parsed = JSON.parse(raw) as CostRateTable
  if (parsed.schemaVersion !== 1) throw new Error(`unknown rate table schema version: ${parsed.schemaVersion}`)
  if (!Array.isArray(parsed.rates)) throw new Error('rate table must have rates array')
  if (!path) cachedTable = parsed
  return parsed
}

export function setRateTable(table: CostRateTable): void {
  cachedTable = table
}

function pickRate(model: string, table: CostRateTable): ModelRate {
  const lc = model.toLowerCase()
  for (const r of table.rates) {
    if (r.id === model) return r
    for (const alias of r.aliases) {
      if (lc.includes(alias.toLowerCase())) return r
    }
  }
  return table.unknown
}

function estimateTokensFromTrace(trace: BuildoutEvent, avgTokensPerToolCall: number): number {
  const toolTokens = (trace.outcome?.toolCallsTotal ?? 0) * avgTokensPerToolCall
  const promptChars = (trace.initialPrompt ?? '').length
  // ~4 chars/token rule-of-thumb.
  const promptTokens = Math.ceil(promptChars / 4)
  // A flat prior for the final response block we can't see in the trace.
  const finalResponseTokens = 800
  return toolTokens + promptTokens + finalResponseTokens
}

/**
 * Estimate the dollar cost of a buildout using the provided or default
 * rate table. Call loadRateTable() first in environments where you want
 * a specific table; otherwise this loads the default on first call.
 */
export function estimateBuildoutCost(
  trace: BuildoutEvent,
  table: CostRateTable,
): CostEstimate {
  const rate = pickRate(trace.sourceModel, table)
  const avg = table.avgTokensPerToolCall || DEFAULT_AVG_TOKENS_PER_TOOL_CALL
  const total = estimateTokensFromTrace(trace, avg)
  const outputShare = rate.outputShare ?? table.defaultOutputShare ?? 0.3
  const outputTokens = Math.round(total * outputShare)
  const inputTokens = total - outputTokens
  const usd = (inputTokens / 1_000_000) * rate.inputUsdPerMtok + (outputTokens / 1_000_000) * rate.outputUsdPerMtok
  return {
    tokenEstimate: total,
    inputTokens,
    outputTokens,
    usdEstimate: Number(usd.toFixed(6)),
    model: trace.sourceModel,
    rateId: rate.id,
  }
}

/**
 * Async convenience wrapper that loads the default rate table when needed.
 */
export async function estimateBuildoutCostAsync(trace: BuildoutEvent): Promise<CostEstimate> {
  const table = await loadRateTable()
  return estimateBuildoutCost(trace, table)
}
