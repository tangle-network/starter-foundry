// AxFlow pipeline for variant_b: collect → train → generate → judge → rank → promote
//
// Every stage is a node with a typed input/output contract. Each node lives in
// its own file under ./nodes/. The flow itself is just the wiring. A node may
// be swapped for a different implementation (different strategy, different
// optimizer, different judge rubric) without touching its neighbors — the
// contracts between nodes are the load-bearing part.

import { flow } from '@ax-llm/ax'
import type { AxAIService } from '@ax-llm/ax'

import { collectNode } from './nodes/collect.js'
import type { CollectInput, CollectOutput } from './nodes/collect.js'
import { trainNode } from './nodes/train.js'
import type { TrainInput, TrainOutput } from './nodes/train.js'
import { generateNode } from './nodes/generate.js'
import type { GenerateInput, GenerateOutput } from './nodes/generate.js'
import { judgeNode } from './nodes/judge.js'
import type { JudgeInput, JudgeOutput } from './nodes/judge.js'
import { rankNode } from './nodes/rank.js'
import type { RankInput, RankOutput } from './nodes/rank.js'
import { promoteNode } from './nodes/promote.js'
import type { PromoteInput, PromoteOutput } from './nodes/promote.js'

export interface FlowInput {
  corpusPath: string
  registryRoot: string
  tracesDir: string
  optimizedPath: string
  ideasPath: string
  judgePath: string
  iterations: number
}

export interface FlowOutput {
  collect: CollectOutput
  train: TrainOutput
  generate: GenerateOutput
  judge: JudgeOutput
  rank: RankOutput
  promote: PromoteOutput
}

// Contract types flowing through the pipeline:
//
//   collect  (corpusPath)           -> { traces: Trace[], tracesFile }
//   train    (traces)               -> { optimizedProgram: AxOptimizedProgram, outPath }
//   generate (registryRoot, traces) -> { candidates: ArchetypeCandidate[] }
//   judge    (candidates)           -> { scored: ScoredCandidate[] }
//   rank     (scored)               -> { ranked: RankedCandidate[] }
//   promote  (ranked, registryRoot) -> { promoted: string[] }

export interface VariantBFlowArgs extends FlowInput {
  llm: AxAIService
}

// Build the flow. We use the flow() primitive as the top-level composer and
// execute each node via .map() because nodes do real filesystem I/O and call
// into existing registry / compose / validate code. Each node is an async
// map that receives the typed state, runs its logic, and returns the
// evolved state. This keeps contracts strict while letting the nodes reach
// into the deterministic layers of the project.
export function buildVariantBFlow() {
  return flow<VariantBFlowArgs>()
    .map(async (state) => {
      const input: CollectInput = {
        corpusPath: state.corpusPath,
        tracesDir: state.tracesDir,
      }
      const collect = await collectNode(input)
      return { ...state, collect }
    })
    .map(async (state) => {
      const input: TrainInput = {
        traces: state.collect.traces,
        outPath: state.optimizedPath,
        llm: state.llm,
      }
      const train = await trainNode(input)
      return { ...state, train }
    })
    .map(async (state) => {
      const input: GenerateInput = {
        registryRoot: state.registryRoot,
        traces: state.collect.traces,
        llm: state.llm,
      }
      const generate = await generateNode(input)
      return { ...state, generate }
    })
    .map(async (state) => {
      const input: JudgeInput = {
        candidates: state.generate.candidates,
        judgePath: state.judgePath,
        llm: state.llm,
      }
      const judge = await judgeNode(input)
      return { ...state, judge }
    })
    .map(async (state) => {
      const input: RankInput = { scored: state.judge.scored }
      const rank = await rankNode(input)
      return { ...state, rank }
    })
    .map(async (state) => {
      const input: PromoteInput = {
        ranked: state.rank.ranked,
        registryRoot: state.registryRoot,
      }
      const promote = await promoteNode(input)
      return { ...state, promote }
    })
    .returns((state) => ({
      collect: state.collect,
      train: state.train,
      generate: state.generate,
      judge: state.judge,
      rank: state.rank,
      promote: state.promote,
    }))
}

export type { CollectInput, CollectOutput }
export type { TrainInput, TrainOutput }
export type { GenerateInput, GenerateOutput }
export type { JudgeInput, JudgeOutput }
export type { RankInput, RankOutput }
export type { PromoteInput, PromoteOutput }
