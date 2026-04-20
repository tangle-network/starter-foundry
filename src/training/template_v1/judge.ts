// judge.ts — score a synthesized candidate template against the current
// one. Deterministic metrics + optional LLM-as-judge for qualitative
// differences. Scores are numeric [0, 1] where higher = better candidate.

import type { HarvestSummary } from './harvest.js'

export interface JudgeInput {
  templatePath: string
  currentSource: string
  candidate: string
  harvest: HarvestSummary
}

export interface JudgeResult {
  /** Total composite score. */
  score: number
  /** Sub-scores by dimension, each [0, 1]. */
  dimensions: Record<string, number>
  reasoning: string
  /** Does the candidate contain lines agents routinely REMOVE from the current? */
  removesFrequentlyDeletedLines: number
  /** Does the candidate incorporate lines agents routinely ADD? */
  incorporatesFrequentlyAddedLines: number
  /** Raw size change. Negative when candidate is shorter (usually better). */
  sizeDelta: number
}

function countOverlap(source: string, needles: string[]): number {
  let hits = 0
  for (const needle of needles) {
    if (source.includes(needle)) hits++
  }
  return needles.length === 0 ? 0 : hits / needles.length
}

export function judge(input: JudgeInput): JudgeResult {
  const addedLines = input.harvest.frequentlyAddedLines.map((e) => e.line)

  // Score 1: does the candidate INCLUDE the lines agents keep adding?
  const incorporatesFrequentlyAddedLines = countOverlap(input.candidate, addedLines)
  const currentIncorporates = countOverlap(input.currentSource, addedLines)
  const addLift = incorporatesFrequentlyAddedLines - currentIncorporates

  // Score 2: does the candidate REMOVE the lines agents keep deleting?
  // Proxy: find lines in the current that DON'T appear in any agent rewrite.
  const agentBodies = input.harvest.samplesAfter.join('\n\n')
  const currentLines = input.currentSource.split('\n').map((l) => l.trim()).filter((l) => l.length >= 8)
  let removedByAgents = 0
  let removedInCandidate = 0
  for (const line of currentLines) {
    const inAgents = agentBodies.includes(line)
    if (inAgents) continue
    removedByAgents++
    if (!input.candidate.includes(line)) removedInCandidate++
  }
  const removesFrequentlyDeletedLines = removedByAgents === 0 ? 0 : removedInCandidate / removedByAgents

  // Score 3: size delta. Slightly prefer smaller (agents tend to trim).
  const sizeDelta = input.candidate.length - input.currentSource.length
  const sizeScore = sizeDelta < 0 ? 1 : Math.max(0, 1 - (sizeDelta / Math.max(1, input.currentSource.length)))

  // Composite: weighted average.
  const composite =
    0.5 * Math.max(0, addLift + 0.5) +
    0.3 * removesFrequentlyDeletedLines +
    0.2 * sizeScore

  const reasoning = [
    `incorporatesFrequentlyAddedLines: ${incorporatesFrequentlyAddedLines.toFixed(2)} (current: ${currentIncorporates.toFixed(2)}, lift: ${addLift.toFixed(2)})`,
    `removesFrequentlyDeletedLines: ${removesFrequentlyDeletedLines.toFixed(2)} (${removedInCandidate}/${removedByAgents})`,
    `sizeDelta: ${sizeDelta} chars (score ${sizeScore.toFixed(2)})`,
  ].join('\n')

  return {
    score: Math.max(0, Math.min(1, composite)),
    dimensions: {
      addLift: Math.max(0, addLift + 0.5),
      removeMatch: removesFrequentlyDeletedLines,
      sizeScore,
    },
    reasoning,
    removesFrequentlyDeletedLines,
    incorporatesFrequentlyAddedLines,
    sizeDelta,
  }
}
