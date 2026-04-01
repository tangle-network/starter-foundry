function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Levenshtein distance between two strings. */
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0]![j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      )
    }
  }
  return matrix[b.length]![a.length]!
}

/**
 * Check if any word in the text fuzzy-matches the keyword (Levenshtein ≤ maxDist).
 * Only applies to single-word keywords of 4+ characters to avoid false positives
 * on short words like "go", "api", "ui".
 */
function fuzzyMatchesWord(text: string, keyword: string, maxDist = 2): boolean {
  if (keyword.length < 4) return false
  const words = text.split(/\s+/)
  for (const word of words) {
    if (word.length < 3) continue
    if (Math.abs(word.length - keyword.length) > maxDist) continue
    if (levenshtein(word, keyword) <= maxDist) return true
  }
  return false
}

export function matchesKeyword(text: string, keyword: string): boolean {
  const normalizedText = text.toLowerCase()
  const normalizedKeyword = keyword.toLowerCase()

  if (
    normalizedKeyword.includes(' ') ||
    normalizedKeyword.includes('.') ||
    normalizedKeyword.includes('/') ||
    normalizedKeyword.includes('-')
  ) {
    return normalizedText.includes(normalizedKeyword)
  }

  return new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`, 'i').test(normalizedText)
}

/**
 * Fuzzy keyword scoring — ONLY used as a fallback when exact matching produces zero hits.
 * Scores each keyword with Levenshtein distance ≤ 1 against words in the text.
 * Requires keywords of 5+ characters to avoid short-word collisions.
 */
export function fuzzyKeywordScore(text: string, keywords: string[]): number {
  const lower = text.toLowerCase()
  return keywords.reduce((total, keyword) => {
    const k = keyword.toLowerCase()
    if (k.length < 5) return total
    if (k.includes(' ') || k.includes('.') || k.includes('/') || k.includes('-')) return total
    return total + (fuzzyMatchesWord(lower, k, 1) ? 1 : 0)
  }, 0)
}

export function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => matchesKeyword(text, keyword))
}

export function countMatches(text: string, keywords: string[]): number {
  return keywords.reduce((total, keyword) => total + (matchesKeyword(text, keyword) ? 1 : 0), 0)
}

export function keywordScore(prompt: string, keywords: string[]): number {
  return keywords.reduce((total, keyword) => total + (matchesKeyword(prompt, keyword) ? 1 : 0), 0)
}

// Lane route descriptors — single source of truth for both workspace lane detection
// and selection scoring. Adding a new family/lane = one entry here.
export interface LaneRoute {
  id: string
  keywords: string[]
}

export const LANE_ROUTES: LaneRoute[] = [
  {
    id: 'tangle',
    keywords: [
      'tangle blueprint',
      'blueprint sdk',
      'cargo tangle',
      'oracle blueprint',
      'storage blueprint',
      'blueprint for tangle',
      'tangle network',
      'using tangle',
      "tangle's",
      'tangle native',
      'frost blueprint',
      'tangle oracle',
      'tangle custody',
    ],
  },
  {
    id: 'avs',
    keywords: ['eigenlayer', 'avs', 'oracle avs', 'keeper avs', 'sequencer avs', 'coprocessor avs'],
  },
  {
    id: 'stylus',
    keywords: ['stylus', 'arbitrum stylus'],
  },
  {
    id: 'zk',
    keywords: [
      'risc zero',
      'sp1',
      'circom',
      'snarkjs',
      'zk prover',
      'verifiable ml',
      'private voting',
      'dark pool',
      'mixer',
    ],
  },
  {
    id: 'mcp',
    keywords: ['model context protocol', 'mcp server', 'mcp tools', 'mcp tool server'],
  },
  {
    id: 'dspy',
    keywords: ['dspy', 'rag system', 'summarization system', 'text classification system', 'prompt engineering'],
  },
  {
    id: 'agent',
    // agent is explicitly excluded when mcp or dspy is present (they are more specific)
    keywords: [
      // generic agent terms
      'ai agent',
      'agent runtime',
      'agent service',
      'agent backend',
      'multi-agent',
      'multi agent',
      'autonomous agent',
      'assistant runtime',
      'chatbot',
      'chat bot',
      'ai assistant',
      'ai copilot',
      'rag',
      'retrieval augmented',
      'ai that can',
      'ai that answers',
      'ai to answer',
      'ai to search',
      // domain agent patterns — catch "X agent" and "X bot" for AI use cases
      'support agent',
      'support bot',
      'slack bot',
      'slack agent',
      'github bot',
      'github agent',
      'trading agent',
      'code review agent',
      'code agent',
      'data agent',
      'data analysis agent',
      'data analyst agent',
      'research agent',
      'research bot',
      'email agent',
      'scheduling agent',
      'sales agent',
      'recruitment agent',
      'onboarding agent',
      'fine-tuning',
      'fine tuning',
      'finetune',
      'unsloth',
      'train a model',
      'modal gpu',
      'hermes agent',
      'hermes function calling',
      'openclaw agent',
      'function-calling agent',
      'function calling agent',
      'langchain',
      'autogpt',
      'auto-gpt',
      'ai copilot',
      'copilot',
      'ai that writes',
      'ai receptionist',
      'custom gpt',
      'ai writer',
      'content generator',
      // frameworks
      'langgraph',
      'mastra',
      'openai agents',
      'openai agents sdk',
      'anthropic sdk',
      'claude sdk',
      'crewai',
      'autogen',
      'pydanticai',
      'agno',
      'llamaindex',
      'agentkit',
      'tool-calling agent',
      'tool calling agent',
      // voice agent patterns
      'voice agent',
      'voice bot',
      'phone agent',
      'call center ai',
      // browser agent patterns
      'browser agent',
      'browser use',
      'computer use',
      'web agent',
    ],
  },
  {
    id: 'fhenix',
    keywords: ['fhenix', 'fhe', 'fully homomorphic', 'fhevm', 'inco', 'encrypted computation', 'euint'],
  },
  {
    id: 'x402',
    keywords: ['x402', 'micropayments', 'pay-per-request', 'monetized api'],
  },
  {
    id: 'evm-infra',
    keywords: [
      'viem',
      'ethers',
      'rpc',
      'block monitor',
      'gas price',
      'transaction count',
      'multicall',
      'wallet balance',
      'wallet balances',
      'stats json endpoint',
      'layerzero',
      'oft',
      'sendtokens',
      'bundler',
      'permissionless.js',
      'monitor x layer',
      'monitor ethereum',
      'monitor arbitrum',
      'okb',
      'oklink',
      'okx',
    ],
  },
  {
    id: 'evm',
    keywords: [
      'solidity',
      'foundry',
      'forge',
      'erc20',
      'erc-20',
      'erc721',
      'erc-721',
      'erc-4337',
      'erc4337',
      'evm',
      'ethereum',
      'arbitrum',
      'base network',
      'base mainnet',
      'polygon',
      'x layer',
      'xlayer',
      'layerzero',
      'chainlink',
      'walletconnect',
      'flashbots',
      'flash loan',
      'aave',
      'uniswap',
      'sushiswap',
      'curve',
      'convex',
      'reservoir api',
      'marketplace core',
      'auction house',
      'lendingpool',
      'cover manager',
      'wallet factory',
      'bonding curve',
      'gateway',
      'erc-4626',
      'erc4626',
      'vault',
      'bridge protocol',
      'cross-chain',
      'lending protocol',
      'borrowing protocol',
      'dex protocol',
      'amm',
      'perpetual futures',
      'perps protocol',
      'restaking',
      'shared security',
      'funding rate',
      'margin trading',
      'gmx',
      'hyperliquid',
      'symbiotic',
      'karak',
      'erc-1155',
      'erc1155',
      'dao',
      'governance',
      'multisig',
      'multi-sig',
      'gnosis safe',
      'dex aggregator',
      '1inch',
      'nft contract',
      'deploy a token',
      'create a token',
      'token on base',
      'memecoin',
      'meme coin',
      'pump.fun',
      'token launcher',
    ],
  },
]

/**
 * Returns true if `text` matches the keyword list for the given lane id.
 * The `agent` lane is false when `mcp` or `dspy` also matches (they take priority).
 */
export function detectLane(text: string, id: string): boolean {
  const route = LANE_ROUTES.find((r) => r.id === id)
  if (!route) return false
  if (!hasAny(text, route.keywords)) return false
  if (id === 'agent') return !detectLane(text, 'mcp') && !detectLane(text, 'dspy')
  return true
}

/** Returns the keyword list for a lane, or empty array if unknown. */
export function getLaneKeywords(id: string): string[] {
  return LANE_ROUTES.find((r) => r.id === id)?.keywords ?? []
}

import type { Registry } from '../types.js'

/**
 * Detect capability layers from registry manifests. Each capability manifest
 * declares its own `keywords` and `appliesTo` — no parallel source arrays needed.
 * Adding a new capability = one manifest.json file.
 */
export function detectCapabilities(text: string, family: string, registry: Registry): string[] {
  const results: string[] = []
  for (const [key, layer] of registry.layers) {
    if (layer.group !== 'capability') continue
    if (!layer.keywords?.length) continue
    if (!layer.appliesTo?.includes(family)) continue
    if (hasAny(text, layer.keywords)) {
      results.push(key)
    }
  }
  return results
}
