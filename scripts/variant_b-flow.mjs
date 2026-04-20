#!/usr/bin/env node
// CLI wrapper: run the full AxFlow pipeline end-to-end.
// Produces optimized program, ideas, judge scores, and promoted archetypes.

import { runFullFlow } from '../dist/training/variant_b/run-flow.js'

const iterations = process.argv.includes('--iterations')
  ? Number.parseInt(process.argv[process.argv.indexOf('--iterations') + 1], 10)
  : 1

const result = await runFullFlow({ iterations })

console.log('\n=== variant_b flow complete ===')
console.log(`traces collected: ${result.collect.traces.length}`)
console.log(`optimizer: ${result.train.optimizedProgram.optimizerType}`)
console.log(`best score: ${result.train.optimizedProgram.bestScore.toFixed(3)}`)
console.log(`candidates: ${result.generate.candidates.length}`)
console.log(`promotable: ${result.judge.scored.filter((s) => s.score.promotable).length}`)
console.log(`pareto frontier: ${result.rank.ranked.filter((r) => r.paretoFrontier).length}`)
console.log(`promoted: ${result.promote.promoted.length}`)
console.log(`skipped: ${result.promote.skipped.length}`)
