// Supervisor agent — decides which specialist runs next based on the state
// graph's current fields. Swap the decision logic for an LLM call if you
// want model-driven routing; this rule-based version is fast + deterministic
// and gives you a working baseline.

import { END, START, StateGraph } from '@langchain/langgraph'
import { SwarmState, type SwarmStateType } from './state'
import { runResearcher } from './agents/researcher'
import { runWriter } from './agents/writer'

function supervise(state: SwarmStateType): Partial<SwarmStateType> {
  if (!state.notes) return { nextAgent: 'researcher' }
  if (!state.draft) return { nextAgent: 'writer' }
  return { nextAgent: 'END' }
}

export function buildSwarm() {
  const graph = new StateGraph(SwarmState)
    .addNode('supervisor', async (s) => supervise(s))
    .addNode('researcher', async (s) => runResearcher(s))
    .addNode('writer', async (s) => runWriter(s))
    .addEdge(START, 'supervisor')
    .addConditionalEdges('supervisor', (s) => s.nextAgent, {
      researcher: 'researcher',
      writer: 'writer',
      END,
    })
    .addEdge('researcher', 'supervisor')
    .addEdge('writer', 'supervisor')
  return graph.compile()
}
