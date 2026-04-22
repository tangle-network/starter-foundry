// Bridge sessions — subscription-backed coding harnesses (Kimi Code,
// Claude Code, Codex) routed through the Tangle Router. Session-resumable
// by a caller-chosen slug, so multi-turn proposer runs don't re-tokenize
// prior context and can be iterated on CI fail or review feedback.
//
// Shape: see @tangle-network/tcloud examples/12-bridge-sessions.ts.
//
// Analysis RLMs (diagnoser, clusterer, judge) go through src/lib/llm.ts on
// the OpenAI-compat `/v1` path — this module is strictly for the coding-
// agent dispatch lane.

import { TCloudClient, type BridgeSession } from '@tangle-network/tcloud'

type BridgeHarness = 'kimi-code' | 'claude-code' | 'codex'

interface BridgeOptions {
  /** Which CLI harness to drive. Defaults to 'kimi-code'. */
  harness?: BridgeHarness
  /** Harness-specific model name. Defaults per harness:
   * kimi-code=kimi-for-coding, claude-code=sonnet, codex=gpt-5-codex.
   * These are Moonshot/Anthropic/OpenAI product/subscription names, not
   * model-version strings — the wire form is `bridge/<harness>/<model>`. */
  model?: string
  /** Session resume slug. REQUIRED — all follow-up calls with the same
   * slug land on the same CLI conversation without re-tokenizing prior
   * turns. Use stable identifiers like `proposal-<id>` or `pr-<n>`. */
  resume: string
}

const DEFAULT_MODELS: Record<BridgeHarness, string> = {
  'kimi-code': 'kimi-for-coding',
  'claude-code': 'sonnet',
  codex: 'gpt-5-codex',
}

const ROUTER_API_BASE = 'https://router.tangle.tools/api'

function isBridgeAvailable(): boolean {
  const apiKey = process.env['TCLOUD_API_KEY'] ?? process.env['TANGLE_API_KEY']
  const unlock = process.env['BRIDGE_UNLOCK']
  return Boolean(apiKey && unlock)
}

export function createBridge(opts: BridgeOptions): BridgeSession {
  const apiKey = process.env['TCLOUD_API_KEY'] ?? process.env['TANGLE_API_KEY']
  if (!apiKey) {
    throw new Error(
      'Missing TCLOUD_API_KEY (sk-tan-*). Bridge sessions require a Tangle API key.',
    )
  }
  const unlock = process.env['BRIDGE_UNLOCK']
  if (!unlock) {
    throw new Error(
      'Missing BRIDGE_UNLOCK. Bridge sessions require the subscription-unlock token.',
    )
  }

  const tcloud = new TCloudClient({ apiKey, baseURL: ROUTER_API_BASE })
  const harness = opts.harness ?? 'kimi-code'
  const model = opts.model ?? DEFAULT_MODELS[harness]

  return tcloud.bridge({ harness, model, unlock, resume: opts.resume })
}
