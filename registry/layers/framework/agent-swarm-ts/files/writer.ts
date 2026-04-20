// Writer agent — takes the researcher's notes and writes the final output.

import { ChatOpenAI } from '@langchain/openai'
import type { SwarmStateType } from '../state'

const model = new ChatOpenAI({
  model: process.env['LLM_MODEL'] ?? 'anthropic/claude-haiku-4-5',
  configuration: {
    baseURL: process.env['OPENAI_BASE_URL'] ?? 'https://router.tangle.tools',
    apiKey: process.env['OPENAI_API_KEY'],
  },
})

const SYSTEM = `You are the Writer. Turn the Researcher's notes into clear, concise prose.
Style: direct, specific, no filler. One paragraph unless the task asks for longer.
Output just the prose, no preamble.`

export async function runWriter(state: SwarmStateType): Promise<Partial<SwarmStateType>> {
  const result = await model.invoke([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Task: ${state.task}\n\nResearcher's notes:\n${state.notes}` },
  ])
  return {
    draft: String(result.content),
    messages: [{ role: 'assistant', content: String(result.content), agent: 'writer' }],
  }
}
