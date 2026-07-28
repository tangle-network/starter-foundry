import {
  callLlm,
  createChatClient,
  TraceEmitter,
  type ChatClient,
  type ChatResponse,
  type TraceStore,
} from '@tangle-network/agent-eval'
import type { RawProviderSink } from '@tangle-network/agent-eval/traces'

export interface JudgeClientOptions {
  apiKey?: string
  baseUrl?: string
  provider?: string
  maximumAttempts?: number
  fetch?: typeof fetch
  rawSink?: RawProviderSink
  traceStore: TraceStore
  runId: string
}

function normalizeBaseUrl(value: string | undefined): string {
  const baseUrl = (value ?? 'https://router.tangle.tools/v1').replace(/\/+$/, '')
  return baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`
}

export function createJudgeClient(options: JudgeClientOptions): ChatClient {
  if (!options.apiKey) {
    return createChatClient({
      transport: 'custom',
      maximumAttempts: 1,
      chat: async () => {
        throw new Error('EVAL_LLM_API_KEY or TANGLE_API_KEY is required for model-based judges')
      },
    })
  }

  const emitter = new TraceEmitter(options.traceStore, { runId: options.runId })
  const maximumAttempts = options.maximumAttempts ?? 3
  return createChatClient({
    transport: 'custom',
    maximumAttempts,
    chat: async (request, callOptions): Promise<ChatResponse> => {
      if (!request.model) throw new Error('judge chat request requires an explicit model')
      const messages = request.messages.map((message) => ({
        role: message.role,
        content:
          typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
      }))
      const span = await emitter.llm({ name: 'judge.chat', model: request.model, messages })
      try {
        const result = await callLlm(
          { ...request, model: request.model },
          {
            baseUrl: normalizeBaseUrl(options.baseUrl),
            apiKey: options.apiKey,
            provider: options.provider,
            maximumAttempts,
            fetch: options.fetch,
            signal: callOptions?.signal,
            idempotencyKey: callOptions?.idempotencyKey,
            rawSink: options.rawSink,
            traceContext: { runId: options.runId, spanId: span.span.spanId },
          },
        )
        await span.end({
          output: result.content,
          inputTokens: result.usage.promptTokens,
          outputTokens: result.usage.completionTokens,
          reasoningTokens: result.usage.reasoningTokens,
          cachedTokens: result.usage.cachedPromptTokens,
          ...(result.costUsd === null ? {} : { costUsd: result.costUsd }),
          ...(result.finishReason ? { finishReason: result.finishReason } : {}),
        })
        return result
      } catch (error) {
        await span.fail(error instanceof Error ? error : String(error))
        throw error
      }
    },
  })
}
