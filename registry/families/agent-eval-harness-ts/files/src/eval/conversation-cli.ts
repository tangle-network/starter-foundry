import { encodeConversationOutput, executeConversation } from './conversation.js'

export interface ConversationInput {
  id: string
  turns: Array<{ user: string }>
}

export function decodeConversationInput(encoded: string): ConversationInput {
  const value = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as unknown
  if (!value || typeof value !== 'object') {
    throw new Error('EVAL_SCENARIO_JSON must decode to an object')
  }
  const input = value as Record<string, unknown>
  if (typeof input.id !== 'string' || !Array.isArray(input.turns) || input.turns.length === 0) {
    throw new Error('EVAL_SCENARIO_JSON requires a scenario id and at least one turn')
  }
  const turns = input.turns.map((turn, index) => {
    if (
      !turn ||
      typeof turn !== 'object' ||
      typeof (turn as Record<string, unknown>).user !== 'string'
    ) {
      throw new Error(`EVAL_SCENARIO_JSON turn ${index + 1} requires a user message`)
    }
    return { user: (turn as Record<string, string>).user }
  })
  return { id: input.id, turns }
}

const encoded = process.env.EVAL_SCENARIO_JSON
const targetUrl = process.env.EVAL_TARGET_BASE_URL
if (!encoded || !targetUrl) {
  throw new Error('EVAL_SCENARIO_JSON and EVAL_TARGET_BASE_URL are required')
}
const input = decodeConversationInput(encoded)
const results = await executeConversation({
  scenarioId: input.id,
  turns: input.turns,
  targetUrl,
})
console.log(encodeConversationOutput(results))
