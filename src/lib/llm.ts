import { ai } from '@ax-llm/ax'
import type { AxAIService } from '@ax-llm/ax'

type LLMProvider = 'tangle-router' | 'anthropic' | 'groq' | 'openai' | 'together' | 'google-gemini'

interface LLMOptions {
  provider?: LLMProvider
  model?: string
  apiKey?: string
}

const ROUTER_URL = 'https://router.tangle.tools/v1'
const ROUTER_DEFAULT_MODEL = 'anthropic/claude-haiku-4-5'

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  'tangle-router': ROUTER_DEFAULT_MODEL,
  groq: 'llama-3.3-70b-versatile',
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  'google-gemini': 'gemini-2.0-flash',
}

function envKey(provider: LLMProvider): string | undefined {
  if (provider === 'tangle-router') return process.env['TANGLE_ROUTER_USER_KEY']
  if (provider === 'groq') return process.env['GROQ_API_KEY']
  if (provider === 'anthropic') return process.env['ANTHROPIC_API_KEY']
  if (provider === 'together') return process.env['TOGETHER_API_KEY']
  if (provider === 'google-gemini') return process.env['GEMINI_API_KEY'] ?? process.env['GOOGLE_AI_KEY']
  return process.env['OPENAI_API_KEY']
}

function detectProvider(): LLMProvider | null {
  const explicit = process.env['STARTER_FOUNDRY_LLM_PROVIDER'] as LLMProvider | undefined
  if (explicit && envKey(explicit)) return explicit
  // Tangle router is the preferred path for Tangle projects — routes through
  // the billing/governance/observability plane instead of direct provider APIs.
  if (process.env['TANGLE_ROUTER_USER_KEY']) return 'tangle-router'
  if (process.env['ANTHROPIC_API_KEY']) return 'anthropic'
  if (process.env['GROQ_API_KEY']) return 'groq'
  if (process.env['TOGETHER_API_KEY']) return 'together'
  if (process.env['OPENAI_API_KEY']) return 'openai'
  if (process.env['GEMINI_API_KEY'] ?? process.env['GOOGLE_AI_KEY']) return 'google-gemini'
  return null
}

export function isLLMAvailable(): boolean {
  return detectProvider() !== null
}

export function createLLM(opts: LLMOptions = {}): AxAIService {
  const provider = opts.provider ?? detectProvider()
  if (!provider) {
    throw new Error(
      'No LLM provider configured. Set TANGLE_ROUTER_USER_KEY (preferred for Tangle) or a direct provider key.',
    )
  }
  const apiKey = opts.apiKey ?? envKey(provider)
  if (!apiKey) {
    throw new Error(`Missing API key for provider ${provider}.`)
  }
  const model = opts.model ?? DEFAULT_MODELS[provider]

  if (provider === 'tangle-router') {
    // OpenAI-compatible proxy at router.tangle.tools. Every Tangle LLM call
    // should flow through here so spend + traces + guardrails are centralized.
    return ai({
      name: 'openai',
      apiKey,
      apiURL: ROUTER_URL,
      config: { model },
    } as Parameters<typeof ai>[0]) as AxAIService
  }

  return ai({ name: provider, apiKey, config: { model } } as Parameters<typeof ai>[0]) as AxAIService
}
