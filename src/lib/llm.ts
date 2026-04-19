import { ai } from '@ax-llm/ax'
import type { AxAIService } from '@ax-llm/ax'

export type LLMProvider = 'anthropic' | 'groq' | 'openai'

export interface LLMOptions {
  provider?: LLMProvider
  model?: string
  apiKey?: string
}

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  groq: 'llama-3.3-70b-versatile',
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
}

function envKey(provider: LLMProvider): string | undefined {
  if (provider === 'groq') return process.env['GROQ_API_KEY']
  if (provider === 'anthropic') return process.env['ANTHROPIC_API_KEY']
  return process.env['OPENAI_API_KEY']
}

export function detectProvider(): LLMProvider | null {
  const explicit = process.env['STARTER_FOUNDRY_LLM_PROVIDER'] as LLMProvider | undefined
  if (explicit && envKey(explicit)) return explicit
  if (process.env['GROQ_API_KEY']) return 'groq'
  if (process.env['ANTHROPIC_API_KEY']) return 'anthropic'
  if (process.env['OPENAI_API_KEY']) return 'openai'
  return null
}

export function isLLMAvailable(): boolean {
  return detectProvider() !== null
}

export function createLLM(opts: LLMOptions = {}): AxAIService {
  const provider = opts.provider ?? detectProvider()
  if (!provider) {
    throw new Error(
      'No LLM provider configured. Set GROQ_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY.',
    )
  }
  const apiKey = opts.apiKey ?? envKey(provider)
  if (!apiKey) {
    throw new Error(`Missing API key for provider ${provider}.`)
  }
  const model = opts.model ?? DEFAULT_MODELS[provider]
  // ax's ai() config.model is provider-specific enum-typed; we accept string at
  // the API boundary and rely on the provider SDK to accept the model id.
  return ai({ name: provider, apiKey, config: { model } } as Parameters<typeof ai>[0]) as AxAIService
}
