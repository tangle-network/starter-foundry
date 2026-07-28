// Example LLM-as-judge — copy this to make new ones.
//
// `llmJudge` from agent-eval builds a campaign `JudgeConfig` whose `score()`
// makes one LLM call and returns the canonical `{ dimensions, composite, notes }`
// verdict on the [0,1] scale. The runner loads each `.judge.ts` as a `JudgeFn`,
// so this file adapts the JudgeConfig back into the per-dimension `JudgeScore[]`
// rows the runner aggregates. Transport is the `ChatClient` the runner threads
// in — `llmJudge` stays decoupled from router-vs-sandbox-vs-cli-bridge.
//
// Calibrate before relying on the score in CI gates — see AGENTS.md.

import {
  llmJudge,
  type JudgeFn,
  type JudgeScore,
} from '@tangle-network/agent-eval'

export const dimensions = ['basic-coherence'] as const
export const usesModel = true

const DIMENSIONS = [
  {
    key: 'coherence',
    description:
      'Does the response stay on topic, follow the user question, and form coherent sentences? ' +
      '0.0 = off-topic or incoherent; 1.0 = fully on-topic and coherent.',
  },
]

const judge: JudgeFn = async (tc, input): Promise<JudgeScore[]> => {
  const config = llmJudge<string>('example-coherence', 'You are a strict evaluator. Be terse.', {
    chat: tc,
    dimensions: DIMENSIONS,
    scale: 'unit',
    model: 'claude-sonnet-4-5',
    temperature: 0,
    renderUser: ({ artifact }) => artifact,
  })
  const transcript = input.turns
    .map((t, i) => `Turn ${i + 1}:\nUser: ${t.userMessage}\nAgent: ${t.agentResponse.slice(0, 2000)}`)
    .join('\n\n---\n\n')
  const verdict = await config.score({
    artifact: transcript,
    scenario: input.scenario as unknown as Parameters<typeof config.score>[0]['scenario'],
    signal: new AbortController().signal,
  })
  return DIMENSIONS.map<JudgeScore>((d) => ({
    judgeName: 'example-coherence',
    dimension: d.key,
    score: verdict.dimensions[d.key],
    reasoning: verdict.notes,
  }))
}

export default judge
