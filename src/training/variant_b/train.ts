// Public entrypoint: runTrainingLoop({ corpusPath, outPath })
//
// Contract (see scripts/multi-pursue-eval.mjs):
//   - Read corpusPath (defaults to corpus/ideasai-prompts.json)
//   - Synthesize traces via the collect node
//   - Run the train node, which compiles AxMiPRO on the brief signature
//   - Write serialized AxOptimizedProgram JSON to outPath
//
// This wraps exactly the first two nodes of the flow. The full flow lives in
// run-flow.ts. Training is separated so the eval harness can run it without
// paying for generate/judge/rank/promote.

import { createLLM } from '../../lib/llm.js'
import { collectNode } from './nodes/collect.js'
import { trainNode } from './nodes/train.js'
import type { SerializedOptimizedProgram } from './nodes/train.js'

export interface RunTrainingLoopInput {
  corpusPath: string
  outPath: string
  tracesDir?: string
  auto?: 'light' | 'medium' | 'heavy'
  limit?: number
}

export interface RunTrainingLoopResult {
  optimizedProgram: SerializedOptimizedProgram
  outPath: string
  traceCount: number
  tracesFile: string
}

export async function runTrainingLoop(input: RunTrainingLoopInput): Promise<RunTrainingLoopResult> {
  const tracesDir = input.tracesDir ?? '.evolve/traces'
  const collect = await collectNode({
    corpusPath: input.corpusPath,
    tracesDir,
    limit: input.limit,
    includeHeldOut: true,
  })
  const llm = createLLM()
  const train = await trainNode({
    traces: collect.traces,
    outPath: input.outPath,
    llm,
    auto: input.auto ?? 'light',
  })
  return {
    optimizedProgram: train.optimizedProgram,
    outPath: train.outPath,
    traceCount: collect.traces.length,
    tracesFile: collect.tracesFile,
  }
}
