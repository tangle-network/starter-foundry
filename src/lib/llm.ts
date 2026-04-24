import { ai } from '@ax-llm/ax'
import type { AxAIService, AxChatRequest, AxChatResponse, AxAIServiceOptions } from '@ax-llm/ax'

type LLMProvider = 'tangle-router' | 'anthropic' | 'groq' | 'openai' | 'together' | 'google-gemini'

interface LLMOptions {
  provider?: LLMProvider
  model?: string
  apiKey?: string
  /** When true, wrap in a fallback chain that retries other providers on
   *  402/429/400/401 from the primary. Preserves the primary as first-try. */
  fallback?: boolean
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

// Fallback priority — when the primary fails with a provider-side error
// (402 no-credit, 429 rate-limit, 400 signature-mismatch, 401 bad-key),
// try these in order. Excludes the primary itself (caller filters).
const FALLBACK_ORDER: LLMProvider[] = [
  'together',        // usually fast + generous rate limits for llama-3.3
  'anthropic',       // direct Claude access
  'tangle-router',   // billing-plane proxy
  'google-gemini',
  'openai',
  'groq',
]

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

export function availableProviders(): LLMProvider[] {
  const explicit = process.env['STARTER_FOUNDRY_LLM_PROVIDER'] as LLMProvider | undefined
  const all: LLMProvider[] = [
    ...(explicit ? [explicit] : []),
    'tangle-router',
    'together',
    'anthropic',
    'google-gemini',
    'openai',
    'groq',
  ]
  const seen = new Set<LLMProvider>()
  const out: LLMProvider[] = []
  for (const p of all) {
    if (seen.has(p)) continue
    seen.add(p)
    if (envKey(p)) out.push(p)
  }
  return out
}

function buildSingle(provider: LLMProvider, opts: LLMOptions): AxAIService {
  const apiKey = opts.apiKey ?? envKey(provider)
  if (!apiKey) throw new Error(`Missing API key for provider ${provider}.`)
  const model = opts.model ?? DEFAULT_MODELS[provider]
  if (provider === 'tangle-router') {
    return ai({
      name: 'openai',
      apiKey,
      apiURL: ROUTER_URL,
      config: { model },
    } as Parameters<typeof ai>[0]) as AxAIService
  }
  return ai({ name: provider, apiKey, config: { model } } as Parameters<typeof ai>[0]) as AxAIService
}

// Provider-side errors we treat as "try the next provider." Transient
// server errors (500/502/503/504) are caller-side retry, not fallback.
const FALLBACK_TRIGGER_PATTERNS = [/\b40[0124]\b/, /payment[\s_-]?required/i, /rate.?limit/i, /insufficient.*credit/i]
function shouldFallback(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return FALLBACK_TRIGGER_PATTERNS.some((rx) => rx.test(msg))
}

/**
 * Proxy AxAIService that tries the primary first; on provider-side errors
 * (402/429/400/401) it invokes the next available provider. Preserves
 * the AxAIService surface area so callers (rewriterAgent.forward, etc.)
 * don't need to change.
 *
 * Not a full AxAIService spec implementation — we proxy the specific
 * methods Ax calls during `.forward()`. Everything else delegates to
 * the primary and will error naturally if an unsupported path is hit.
 */
function buildFallbackChain(primary: LLMProvider, opts: LLMOptions): AxAIService {
  const explicit = opts.provider
  const chain: LLMProvider[] = [primary]
  for (const p of FALLBACK_ORDER) {
    if (p === primary) continue
    if (!envKey(p)) continue
    chain.push(p)
  }
  if (explicit && explicit !== primary) {
    // caller explicitly requested a specific provider — respect it, no fallback.
    return buildSingle(explicit, opts)
  }
  // Fallback means "any provider, best effort" — strip opts.model so each
  // provider gets its own DEFAULT_MODELS entry. Passing the primary's
  // router-specific model name (e.g. "anthropic/claude-sonnet-4-6") to a
  // direct OpenAI or Together endpoint 404s. The primary keeps its model
  // when it's first in the chain.
  const svcs = chain.map((p, i) => ({
    provider: p,
    svc: buildSingle(p, {
      ...opts,
      provider: p,
      apiKey: undefined,
      // Only preserve caller's model on the primary; fallback providers
      // use their own defaults via DEFAULT_MODELS.
      model: i === 0 ? opts.model : undefined,
    }),
  }))
  if (svcs.length === 0) throw new Error('no providers available for fallback chain')
  // Proxy through the primary for any method not explicitly handled, so we
  // don't have to mirror the full AxAIService interface.
  const handler: ProxyHandler<AxAIService> = {
    get(target, key: PropertyKey) {
      if (key === 'chat') {
        return async function (req: AxChatRequest, svcOptions?: Readonly<AxAIServiceOptions>): Promise<AxChatResponse> {
          let lastErr: unknown
          for (let i = 0; i < svcs.length; i++) {
            const { provider, svc } = svcs[i]!
            // Per-provider model rewrite. The primary chose a model name
            // (set by Ax from its service config). When we fall over to a
            // different provider that model name is wrong — e.g.,
            // "anthropic/claude-sonnet-4-6" is a router-specific slug that
            // Together and OpenAI don't recognize. Swap in the target
            // provider's DEFAULT_MODELS entry for every fallback hop.
            const modelForProvider = i === 0 ? req.model : DEFAULT_MODELS[provider]
            const rewrittenReq = modelForProvider === req.model
              ? req
              : { ...req, model: modelForProvider }
            try {
              return (await svc.chat(rewrittenReq, svcOptions)) as AxChatResponse
            } catch (err) {
              lastErr = err
              if (!shouldFallback(err)) throw err
              const msg = err instanceof Error ? err.message : String(err)
              // Leave a crumb so operators can see which providers failed + why.
              process.stderr.write(`[llm-fallback] ${provider} skipped: ${msg.slice(0, 120)}\n`)
            }
          }
          throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
        }
      }
      return Reflect.get(target, key)
    },
  }
  return new Proxy(svcs[0]!.svc, handler)
}

export function createLLM(opts: LLMOptions = {}): AxAIService {
  const provider = opts.provider ?? detectProvider()
  if (!provider) {
    throw new Error(
      'No LLM provider configured. Set TANGLE_ROUTER_USER_KEY (preferred for Tangle) or a direct provider key.',
    )
  }
  // Fallback-by-default: if caller didn't pin a provider AND didn't opt-out
  // AND ≥2 providers are configured, build a resilient chain. Single-key
  // setups silently get the single-provider path. Callers that need a
  // specific provider (e.g., scaffold-bridge pinning a Sonnet model) must
  // pass `provider` explicitly, which disables fallback.
  const shouldFallback = opts.fallback !== false && !opts.provider && availableProviders().length >= 2
  if (shouldFallback) return buildFallbackChain(provider, opts)
  return buildSingle(provider, opts)
}
