// runFullFlow: runs the entire AxFlow pipeline end-to-end. Used by the
// variant_b-flow.mjs script and by the integration test. This is the
// one-shot "do everything" entrypoint.

import { buildVariantBFlow } from './flow.js'
import { createLLM } from '../../lib/llm.js'
import type { FlowOutput } from './flow.js'

export interface RunFullFlowInput {
  corpusPath?: string
  registryRoot?: string
  tracesDir?: string
  optimizedPath?: string
  ideasPath?: string
  judgePath?: string
  iterations?: number
}

export async function runFullFlow(input: RunFullFlowInput = {}): Promise<FlowOutput> {
  const llm = createLLM()
  const flowInstance = buildVariantBFlow()
  const result = await flowInstance.forward(llm, {
    corpusPath: input.corpusPath ?? 'corpus/ideasai-prompts.json',
    registryRoot: input.registryRoot ?? 'registry',
    tracesDir: input.tracesDir ?? '.evolve/traces',
    optimizedPath: input.optimizedPath ?? '.evolve/optimized/brief-variant_b.json',
    ideasPath: input.ideasPath ?? '.evolve/ideas/variant_b.json',
    judgePath: input.judgePath ?? '.evolve/judge/variant_b.jsonl',
    iterations: input.iterations ?? 1,
    llm,
  })
  return result as FlowOutput
}
