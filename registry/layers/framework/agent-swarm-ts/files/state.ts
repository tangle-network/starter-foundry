import { Annotation } from '@langchain/langgraph'

// Shared state graph for the swarm. Each agent reads the messages history,
// contributes its output, and optionally sets `nextAgent` to hand off.
// Keep this interface small — too much shared state = tight coupling.

export const SwarmState = Annotation.Root({
  messages: Annotation<Array<{ role: 'user' | 'assistant' | 'system'; content: string; agent?: string }>>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  task: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  /** Research notes collected by the researcher for the writer to consume. */
  notes: Annotation<string>({
    reducer: (prev, next) => (next ? `${prev}\n${next}` : prev),
    default: () => '',
  }),
  /** Final output produced by the writer. */
  draft: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  /** Supervisor-set routing — which agent runs next. 'END' terminates the graph. */
  nextAgent: Annotation<'researcher' | 'writer' | 'END'>({
    reducer: (_prev, next) => next,
    default: () => 'researcher',
  }),
})

export type SwarmStateType = typeof SwarmState.State
