// Example LLM-as-judge — copy this to make new ones.
//
// `createCustomJudge` from agent-eval wraps a system prompt and returns a
// JudgeFn. The runner invokes the judge for each ScenarioResult; the judge
// calls TCloud and returns one JudgeScore per dimension.
//
// Calibrate before relying on the score in CI gates — see AGENTS.md.

import { createCustomJudge, type JudgeFn } from '@tangle-network/agent-eval'

const judge: JudgeFn = createCustomJudge(
  'example-coherence',
  `You are a strict evaluator. Score the agent's response on a single
dimension: "coherence" (does the response stay on topic, follow the
user's question, and form coherent sentences?). Output a number from 0
to 1. Provide one sentence of reasoning. Be terse.`,
  {
    model: 'claude-sonnet-4-5',
    temperature: 0,
  },
)

export default judge
