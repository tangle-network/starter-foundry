// rank node: Pareto-rank scored candidates across (utility, specificity,
// novelty, rubric). Dominated candidates are dropped. Non-dominated frontier
// is ordered by composite score. This is a swap point — could be replaced
// with Borda count, ELO, or a learned ranker without touching the nodes
// upstream or downstream.

import type { ScoredCandidate } from './judge.js'

export interface RankedCandidate extends ScoredCandidate {
  rank: number
  paretoFrontier: boolean
}

export interface RankInput {
  scored: ScoredCandidate[]
}

export interface RankOutput {
  ranked: RankedCandidate[]
}

function dominates(a: ScoredCandidate, b: ScoredCandidate): boolean {
  const dims: [number, number][] = [
    [a.score.utility, b.score.utility],
    [a.score.specificity, b.score.specificity],
    [a.score.novelty, b.score.novelty],
    [a.score.rubric, b.score.rubric],
  ]
  let strictlyBetter = false
  for (const [x, y] of dims) {
    if (x < y) return false
    if (x > y) strictlyBetter = true
  }
  return strictlyBetter
}

export async function rankNode(input: RankInput): Promise<RankOutput> {
  const ranked: RankedCandidate[] = []
  for (const c of input.scored) {
    let isDominated = false
    for (const other of input.scored) {
      if (other === c) continue
      if (dominates(other, c)) {
        isDominated = true
        break
      }
    }
    ranked.push({ ...c, rank: 0, paretoFrontier: !isDominated })
  }
  ranked.sort((a, b) => {
    if (a.paretoFrontier !== b.paretoFrontier) return a.paretoFrontier ? -1 : 1
    return b.score.composite - a.score.composite
  })
  ranked.forEach((c, i) => {
    c.rank = i + 1
  })
  return { ranked }
}
