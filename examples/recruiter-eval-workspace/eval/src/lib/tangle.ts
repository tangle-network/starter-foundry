// Tangle floor — every agent-runtime bundle wires LLM calls through
// router.tangle.tools, executes tools through @tangle-network/sandbox-sdk,
// and has @tangle-network/tcloud available for image/video/speech work.
//
// Bundles import from this module rather than reaching for the underlying
// SDKs directly so the router URL + auth wiring stays consistent. The
// bundle-check validator rejects any LLM call that doesn't go through
// `chatViaRouter` or an OpenAI-compatible client whose `baseURL` is
// `process.env.LLM_ROUTER_URL`.

export const LLM_ROUTER_URL = process.env['LLM_ROUTER_URL'] ?? 'https://router.tangle.tools'

export interface RouterChatOptions {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  stream?: boolean
  temperature?: number
}

export async function chatViaRouter(opts: RouterChatOptions): Promise<Response> {
  const apiKey = process.env['TANGLE_ROUTER_KEY']
  if (!apiKey) throw new Error('TANGLE_ROUTER_KEY not set — bundles must route LLM calls through router.tangle.tools')
  return fetch(`${LLM_ROUTER_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream: opts.stream ?? false,
      temperature: opts.temperature ?? 0.2,
    }),
  })
}

export interface SandboxSpawnOptions {
  bundleDir: string
  tenantId: string
  envVars?: Record<string, string>
  ttlSec?: number
}

export interface SandboxHandle {
  id: string
  endpoint: string
  destroy: () => Promise<void>
}

export async function spawnAgentSandbox(_opts: SandboxSpawnOptions): Promise<SandboxHandle> {
  // Implementation imports @tangle-network/sandbox-sdk at runtime; this
  // module declares the contract so the bundle's compose-time validators
  // can assert the shape without needing the SDK on the classpath.
  throw new Error('spawnAgentSandbox: import @tangle-network/sandbox-sdk and wire its createSandbox() here')
}
