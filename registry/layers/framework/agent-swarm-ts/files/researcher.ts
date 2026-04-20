// Researcher agent — given a task, produces bullet-point notes. Swap the
// tool surface (web search, vector store lookup, SQL query) for your domain.

import { ChatOpenAI } from '@langchain/openai'
import type { SwarmStateType } from '../state'

const model = new ChatOpenAI({
  model: process.env['LLM_MODEL'] ?? 'anthropic/claude-haiku-4-5',
  configuration: {
    baseURL: process.env['OPENAI_BASE_URL'] ?? 'https://router.tangle.tools',
    apiKey: process.env['OPENAI_API_KEY'],
  },
})

const SYSTEM = `You are the Researcher. Given a task, produce compact bullet-point notes covering:
- Key facts
- Relevant entities
- Open questions
Keep it under 200 words. You hand off to a Writer agent who'll turn your notes into prose.`

export async function runResearcher(state: SwarmStateType): Promise<Partial<SwarmStateType>> {
  const result = await model.invoke([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: state.task },
  ])
  return {
    notes: String(result.content),
    messages: [{ role: 'assistant', content: String(result.content), agent: 'researcher' }],
  }
}
