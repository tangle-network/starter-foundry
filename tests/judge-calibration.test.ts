// Judge-of-judges calibration. The template_v1 judge drives promote/skip
// decisions on template rewrites — if its ordering of rewrites doesn't
// correlate with a reasonable human ordering, the loop promotes the wrong
// things. This test compares the judge's scores on a hand-labeled gold
// set against the human scores via Spearman rank correlation.
//
// Gold set lives at .evolve/gold/judge-gold.jsonl — each line is a JSON
// entry with { id, currentSource, candidate, harvest, humanScore, rationale }.
// Extend the gold set as real rewrite cases accumulate; the threshold
// below keeps the judge honest as the registry evolves.

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { judge } from '../dist/training/template_v1/judge.js'
import type { HarvestSummary } from '../dist/training/template_v1/harvest.js'

interface GoldEntry {
  id: string
  currentSource: string
  candidate: string
  harvest: HarvestSummary
  humanScore: number
  rationale: string
}

const GOLD_PATH = '.evolve/gold/judge-gold.jsonl'
const MIN_SPEARMAN = 0.5

function loadGold(): GoldEntry[] {
  if (!existsSync(GOLD_PATH)) return []
  return readFileSync(GOLD_PATH, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as GoldEntry)
}

function rank(values: number[]): number[] {
  // Average-rank (handles ties). Returns the rank of each value in the
  // original order. Smaller value → smaller rank.
  const n = values.length
  const indexed = values.map((v, i) => ({ v, i }))
  indexed.sort((a, b) => a.v - b.v)
  const ranks = new Array<number>(n)
  let i = 0
  while (i < n) {
    let j = i
    while (j + 1 < n && indexed[j + 1]!.v === indexed[i]!.v) j++
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[indexed[k]!.i] = avg
    i = j + 1
  }
  return ranks
}

function spearman(x: number[], y: number[]): number {
  assert.equal(x.length, y.length, 'spearman: length mismatch')
  const rx = rank(x)
  const ry = rank(y)
  const n = x.length
  const meanX = rx.reduce((a, b) => a + b, 0) / n
  const meanY = ry.reduce((a, b) => a + b, 0) / n
  let num = 0
  let dxSq = 0
  let dySq = 0
  for (let i = 0; i < n; i++) {
    const dx = rx[i]! - meanX
    const dy = ry[i]! - meanY
    num += dx * dy
    dxSq += dx * dx
    dySq += dy * dy
  }
  const denom = Math.sqrt(dxSq * dySq)
  return denom === 0 ? 0 : num / denom
}

test('judge calibration — Spearman ρ vs human gold set', async () => {
  const gold = loadGold()
  if (gold.length < 5) {
    // If the gold set is too small to compute a meaningful correlation
    // (first session, repo just cloned), skip rather than fail. The test
    // starts enforcing once ≥5 gold entries exist.
    console.log(`[judge-calibration] gold set has ${gold.length} entries — skipping until ≥5.`)
    return
  }

  const judgeScores: number[] = []
  const humanScores: number[] = []
  const perEntry: Array<{ id: string; judge: number; human: number }> = []
  for (const entry of gold) {
    const result = judge({
      templatePath: entry.harvest.templatePath,
      currentSource: entry.currentSource,
      candidate: entry.candidate,
      harvest: entry.harvest,
    })
    judgeScores.push(result.score)
    humanScores.push(entry.humanScore)
    perEntry.push({ id: entry.id, judge: result.score, human: entry.humanScore })
  }

  const rho = spearman(judgeScores, humanScores)
  const detail = perEntry
    .map((e) => `  ${e.id.padEnd(32)} judge=${e.judge.toFixed(3)} human=${e.human.toFixed(3)}`)
    .join('\n')

  assert.ok(
    rho >= MIN_SPEARMAN,
    `judge-calibration: Spearman ρ = ${rho.toFixed(3)} below threshold ${MIN_SPEARMAN}. Judge is not tracking human preference.\n${detail}`,
  )
})

test('judge calibration — clear regressions score below 0.5', async () => {
  const gold = loadGold()
  const regressions = gold.filter((g) => g.humanScore < 0.3)
  if (regressions.length === 0) return

  for (const entry of regressions) {
    const result = judge({
      templatePath: entry.harvest.templatePath,
      currentSource: entry.currentSource,
      candidate: entry.candidate,
      harvest: entry.harvest,
    })
    assert.ok(
      result.score < 0.5,
      `judge-calibration: ${entry.id} scored ${result.score.toFixed(3)} by judge but human=${entry.humanScore.toFixed(3)} (clear regression). Judge is promoting known bad rewrites.`,
    )
  }
})

test('judge calibration — clear wins score above 0.55', async () => {
  const gold = loadGold()
  const wins = gold.filter((g) => g.humanScore >= 0.8)
  if (wins.length === 0) return

  for (const entry of wins) {
    const result = judge({
      templatePath: entry.harvest.templatePath,
      currentSource: entry.currentSource,
      candidate: entry.candidate,
      harvest: entry.harvest,
    })
    assert.ok(
      result.score > 0.55,
      `judge-calibration: ${entry.id} scored ${result.score.toFixed(3)} by judge but human=${entry.humanScore.toFixed(3)} (clear win). Judge is missing known good rewrites.`,
    )
  }
})
