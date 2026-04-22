// Bridge sessions — subscription-backed coding harnesses (Kimi Code,
// Claude Code, Codex) routed through one of three paths. Session-resumable
// by a caller-chosen slug, so multi-turn proposer runs don't re-tokenize
// prior context and can be iterated on CI fail or review feedback.
//
// Three dispatch paths:
//
//   1. Direct local (preferred for dev): SDK → cli-bridge directly,
//      no router involvement. cli-bridge is OpenAI-compatible
//      (`/v1/chat/completions`) — we just point a TCloudClient at
//      its baseURL and call chat() with model='<harness>/<model>'.
//      Triggered when CLI_BRIDGE_URL + CLI_BRIDGE_BEARER are set.
//      Auth: BRIDGE_BEARER (local). No router gate, no billing
//      passthrough — pure local execution.
//
//   2. BYOB-via-router (preferred for tunneled local + observability):
//      SDK → router.tangle.tools/api → server-side fetch to your
//      cli-bridge URL. The router still gates on BRIDGE_UNLOCK and
//      applies billing/observability; only harness execution location
//      changes. Triggered when CLI_BRIDGE_URL + TCLOUD_API_KEY +
//      BRIDGE_UNLOCK are all set. Note: the URL must be reachable
//      FROM the router box, so for a local laptop you need a tunnel
//      (ngrok / cloudflare tunnel / tailscale funnel) — pure
//      127.0.0.1 only works if both you and the router are on the
//      same machine.
//
//   3. Production (default): SDK → router → shared cli-bridge inside
//      the router's docker network. Triggered when only
//      TCLOUD_API_KEY + BRIDGE_UNLOCK are set. Needs the prod bridge
//      to be deployed with the harness names you're calling.
//
// Path-1 is what most local sessions want. The proposer's API
// (`session.ask(task)`, `session.stream(...)`, `withResume(id)`)
// is uniform across all three.

import { TCloudClient, type BridgeSession } from '@tangle-network/tcloud'

type BridgeHarness = 'kimi-code' | 'claude-code' | 'codex' | 'sandbox'

interface BridgeOptions {
  /** Which CLI harness to drive. Defaults to 'kimi-code'. */
  harness?: BridgeHarness
  /** Harness-specific model name. Defaults per harness:
   * kimi-code=kimi-for-coding, claude-code=sonnet, codex=gpt-5-codex.
   * Note: when going through the router (paths 2/3), the wire form
   * adds a `bridge/` prefix automatically (`bridge/<harness>/<model>`);
   * direct mode (path 1) sends `<harness>/<model>` straight to
   * cli-bridge which strips the bridge/ prefix internally anyway. */
  model?: string
  /** Session resume slug. REQUIRED — follow-up calls with the same
   * slug land on the same CLI conversation without re-tokenizing
   * prior turns. Use stable identifiers like `proposal-<id>` or
   * `pr-<n>`. */
  resume: string
}

const DEFAULT_MODELS: Record<BridgeHarness, string> = {
  'kimi-code': 'kimi-for-coding',
  'claude-code': 'sonnet',
  codex: 'gpt-5-codex',
  // For sandbox the "model" slot holds the AgentProfile id (cataloged
  // in cli-bridge's profiles/ dir). Callers MUST pass model explicitly
  // — there's no useful default since profile choice IS the dispatch.
  sandbox: '',
}

const ROUTER_API_BASE = 'https://router.tangle.tools/api'

/** True when at least one dispatch path has the env it needs. */
function isBridgeAvailable(): boolean {
  const direct = process.env['CLI_BRIDGE_URL'] && process.env['CLI_BRIDGE_BEARER']
  const router = (process.env['TCLOUD_API_KEY'] ?? process.env['TANGLE_API_KEY']) && process.env['BRIDGE_UNLOCK']
  return Boolean(direct || router)
}

/**
 * Minimal session shape returned by direct mode. Matches the subset of
 * tcloud.BridgeSession that the proposer actually uses (`ask`, `stream`,
 * `turn`, `withResume`, `model`). cli-bridge handles session resume
 * via the `session_id` body field; we thread the resume slug into
 * every request so multi-turn picks up the same CLI conversation.
 */
interface DirectBridgeSession {
  ask(message: string): Promise<string>
  stream(message: string): AsyncGenerator<string>
  turn(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string>
  withResume(newResume: string): DirectBridgeSession
  readonly model: string
  readonly resume: string
}

function createDirectBridge(opts: BridgeOptions): DirectBridgeSession {
  const baseURL = process.env['CLI_BRIDGE_URL']!.replace(/\/+$/, '') + '/v1'
  const bearer = process.env['CLI_BRIDGE_BEARER']!
  const harness = opts.harness ?? 'kimi-code'
  const model = opts.model ?? DEFAULT_MODELS[harness]
  const fullModel = `${harness}/${model}`

  // tcloud's chat() POSTs to ${baseURL}/chat/completions — exactly
  // cli-bridge's mounted path. We pass session_id as an extra body
  // field; cli-bridge's chat-completions route accepts it.
  const tcloud = new TCloudClient({ apiKey: bearer, baseURL })

  function build(resume: string): DirectBridgeSession {
    return {
      get model() { return fullModel },
      get resume() { return resume },
      async ask(message: string): Promise<string> {
        const result = await tcloud.chat({
          model: fullModel,
          messages: [{ role: 'user', content: message }],
          // @ts-expect-error session_id is cli-bridge-specific; tcloud's
          // ChatOptions doesn't declare it but the body is forwarded.
          session_id: resume,
        })
        return result.choices[0]?.message?.content ?? ''
      },
      async *stream(message: string): AsyncGenerator<string> {
        const it = tcloud.chatStream({
          model: fullModel,
          messages: [{ role: 'user', content: message }],
          // @ts-expect-error session_id pass-through (see ask).
          session_id: resume,
        })
        for await (const chunk of it) {
          const delta = chunk.choices?.[0]?.delta?.content
          if (delta) yield delta
        }
      },
      async turn(messages): Promise<string> {
        const result = await tcloud.chat({
          model: fullModel,
          messages,
          // @ts-expect-error session_id pass-through (see ask).
          session_id: resume,
        })
        return result.choices[0]?.message?.content ?? ''
      },
      withResume(newResume: string) { return build(newResume) },
    }
  }

  return build(opts.resume)
}

export function createBridge(opts: BridgeOptions): BridgeSession | DirectBridgeSession {
  const directUrl = process.env['CLI_BRIDGE_URL']
  const directBearer = process.env['CLI_BRIDGE_BEARER']
  const apiKey = process.env['TCLOUD_API_KEY'] ?? process.env['TANGLE_API_KEY']
  const unlock = process.env['BRIDGE_UNLOCK']

  // Path 1: direct local. Cleanest path when both are set and we don't
  // also have router creds — skip the router entirely.
  if (directUrl && directBearer && !(apiKey && unlock)) {
    return createDirectBridge(opts)
  }

  // Paths 2 + 3: router. Need TCLOUD_API_KEY + BRIDGE_UNLOCK.
  if (!apiKey) {
    throw new Error(
      'Missing TCLOUD_API_KEY (sk-tan-*) for router-mediated dispatch. For local-only use, set CLI_BRIDGE_URL + CLI_BRIDGE_BEARER instead.',
    )
  }
  if (!unlock) {
    throw new Error(
      'Missing BRIDGE_UNLOCK for router-mediated dispatch. For local-only use, set CLI_BRIDGE_URL + CLI_BRIDGE_BEARER instead.',
    )
  }

  const tcloud = new TCloudClient({ apiKey, baseURL: ROUTER_API_BASE })
  const harness = opts.harness ?? 'kimi-code'
  const model = opts.model ?? DEFAULT_MODELS[harness]

  // Path 2: BYOB-via-router. Reminder: directUrl must be reachable
  // FROM the router box (public tunnel for laptop dev).
  const byobCfg = directUrl && directBearer
    ? { bridgeUrl: directUrl, bridgeBearer: directBearer }
    : {}

  return tcloud.bridge({ harness, model, unlock, resume: opts.resume, ...byobCfg })
}
