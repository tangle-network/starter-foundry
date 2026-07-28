import { randomUUID } from 'node:crypto'
import type { Turn } from '@tangle-network/agent-eval'

const OUTPUT_PREFIX = 'EVAL_TURNS_JSON '

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ConversationTurnResult {
  turnIndex: number
  userMessage: string
  agentResponse: string
  durationMs: number
}

export interface ExecuteConversationOptions {
  scenarioId: string
  turns: Pick<Turn, 'user'>[]
  targetUrl: string
  conversationId?: string
  fetch?: typeof fetch
}

function responseContent(raw: string): string {
  try {
    const value = JSON.parse(raw) as unknown
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return raw
    const record = value as Record<string, unknown>
    for (const key of ['reply', 'content', 'response', 'output', 'text']) {
      if (typeof record[key] === 'string') return record[key]
    }
    const message = record.message
    if (typeof message === 'string') return message
    if (
      message &&
      typeof message === 'object' &&
      typeof (message as Record<string, unknown>).content === 'string'
    ) {
      return (message as Record<string, string>).content
    }
  } catch {
    return raw
  }
  return raw
}

export async function executeConversation(
  options: ExecuteConversationOptions,
): Promise<ConversationTurnResult[]> {
  if (options.turns.length === 0) {
    throw new Error(`scenario "${options.scenarioId}" has no turns`)
  }
  const request = options.fetch ?? globalThis.fetch
  const endpoint = `${options.targetUrl.replace(/\/+$/, '')}/chat`
  const conversationId = options.conversationId ?? `${options.scenarioId}:${randomUUID()}`
  const messages: ConversationMessage[] = []
  const results: ConversationTurnResult[] = []

  for (const [turnIndex, turn] of options.turns.entries()) {
    messages.push({ role: 'user', content: turn.user })
    const startedAt = Date.now()
    const response = await request(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: turn.user,
        scenarioId: options.scenarioId,
        conversationId,
        sessionId: conversationId,
        turnIndex,
        messages,
      }),
    })
    const raw = await response.text()
    if (!response.ok) {
      throw new Error(
        `scenario "${options.scenarioId}" turn ${turnIndex + 1} returned HTTP ${response.status}: ${raw.slice(0, 300)}`,
      )
    }
    const agentResponse = responseContent(raw)
    if (agentResponse.trim().length === 0) {
      throw new Error(`scenario "${options.scenarioId}" turn ${turnIndex + 1} returned no content`)
    }
    results.push({
      turnIndex,
      userMessage: turn.user,
      agentResponse,
      durationMs: Date.now() - startedAt,
    })
    messages.push({ role: 'assistant', content: agentResponse })
  }

  return results
}

export function encodeConversationOutput(results: ConversationTurnResult[]): string {
  return `${OUTPUT_PREFIX}${Buffer.from(JSON.stringify(results), 'utf8').toString('base64')}`
}

export function decodeConversationOutput(stdout: string): ConversationTurnResult[] | null {
  const lines = stdout.split(/\r?\n/)
  let line: string | undefined
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index]?.startsWith(OUTPUT_PREFIX)) {
      line = lines[index]
      break
    }
  }
  if (!line) return null
  const decoded = JSON.parse(
    Buffer.from(line.slice(OUTPUT_PREFIX.length), 'base64').toString('utf8'),
  ) as unknown
  if (!Array.isArray(decoded)) throw new Error('conversation output is not an array')
  return decoded.map((value, index) => {
    if (!value || typeof value !== 'object') {
      throw new Error(`conversation output turn ${index + 1} is not an object`)
    }
    const row = value as Record<string, unknown>
    if (
      row.turnIndex !== index ||
      typeof row.userMessage !== 'string' ||
      typeof row.agentResponse !== 'string' ||
      row.agentResponse.trim().length === 0 ||
      typeof row.durationMs !== 'number' ||
      !Number.isFinite(row.durationMs) ||
      row.durationMs < 0
    ) {
      throw new Error(`conversation output turn ${index + 1} has an invalid shape`)
    }
    return {
      turnIndex: row.turnIndex,
      userMessage: row.userMessage,
      agentResponse: row.agentResponse,
      durationMs: row.durationMs,
    }
  })
}
