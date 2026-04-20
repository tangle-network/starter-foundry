#!/usr/bin/env node
// CLI wrapper for the collect node. Produces a trace JSONL under
// .evolve/traces/ for downstream nodes to consume.

import { collectNode } from '../dist/training/variant_b/nodes/collect.js'

const corpusPath = process.argv.includes('--corpus')
  ? process.argv[process.argv.indexOf('--corpus') + 1]
  : 'corpus/ideasai-prompts.json'
const tracesDir = process.argv.includes('--traces-dir')
  ? process.argv[process.argv.indexOf('--traces-dir') + 1]
  : '.evolve/traces'
const limitArg = process.argv.includes('--limit')
  ? Number.parseInt(process.argv[process.argv.indexOf('--limit') + 1], 10)
  : undefined

const result = await collectNode({
  corpusPath,
  tracesDir,
  limit: Number.isFinite(limitArg) ? limitArg : undefined,
  includeHeldOut: true,
})

console.log(`collected ${result.traces.length} traces`)
console.log(`wrote: ${result.tracesFile}`)
console.log(`top-3 coverage gaps:`)
for (const g of result.coverageGaps.slice(0, 3)) {
  console.log(`  ${g.capability}: ${g.missCount} misses`)
}
