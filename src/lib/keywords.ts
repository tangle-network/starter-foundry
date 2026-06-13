function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Levenshtein distance between two strings. */
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }
  return matrix[b.length][a.length]
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

// --- Hot-path optimizations -------------------------------------------------
//
// The original `matchesKeyword` compiled a fresh RegExp on every call. With ~40
// families × tiered keywords + ~60 capability layers × keywords + LANE_ROUTES,
// `planPrompt` triggers >1000 keyword probes per prompt — each previously
// allocating a regex. Two caches eliminate that work:
//
//   KEYWORD_CACHE: per keyword-string, a precompiled matcher. Keyword strings
//     are finite (hundreds) and reused across every prompt, so this converges
//     to O(1) amortized lookup after the first prompt.
//
//   TEXT_LOWER_CACHE: per input text, its lowercased form. `planPrompt`
//     lowercases the prompt once then passes it through hundreds of
//     `hasAny`/`keywordScore` calls. `selection.ts` passes the original
//     (non-lowercased) prompt. Memoizing the lowercase avoids repeating the
//     work per-keyword. Capped to avoid unbounded growth in long-running
//     processes.

interface KeywordInfo {
  readonly lower: string
  readonly isPhrase: boolean
  /** Word-boundary regex, only populated for non-phrase keywords. */
  readonly wordRegex: RegExp | null
}

const KEYWORD_CACHE = new Map<string, KeywordInfo>()
const TEXT_LOWER_CACHE = new Map<string, string>()
const TEXT_LOWER_CACHE_MAX = 512

function getKeywordInfo(keyword: string): KeywordInfo {
  const cached = KEYWORD_CACHE.get(keyword)
  if (cached !== undefined) return cached
  const lower = keyword.toLowerCase()
  const isPhrase =
    lower.includes(' ') || lower.includes('.') || lower.includes('/') || lower.includes('-')
  const wordRegex = isPhrase ? null : new RegExp(`\\b${escapeRegex(lower)}\\b`)
  const info: KeywordInfo = { lower, isPhrase, wordRegex }
  KEYWORD_CACHE.set(keyword, info)
  return info
}

function lowerText(text: string): string {
  const cached = TEXT_LOWER_CACHE.get(text)
  if (cached !== undefined) return cached
  const lower = text.toLowerCase()
  if (TEXT_LOWER_CACHE.size >= TEXT_LOWER_CACHE_MAX) {
    // drop oldest insertion to bound memory; Map preserves insertion order.
    const firstKey = TEXT_LOWER_CACHE.keys().next().value
    if (firstKey !== undefined) TEXT_LOWER_CACHE.delete(firstKey)
  }
  TEXT_LOWER_CACHE.set(text, lower)
  return lower
}

export function matchesKeyword(text: string, keyword: string): boolean {
  const info = getKeywordInfo(keyword)
  const normalizedText = lowerText(text)
  if (info.isPhrase) {
    return normalizedText.includes(info.lower)
  }
  return info.wordRegex!.test(normalizedText)
}

/**
 * Fuzzy keyword scoring — ONLY used as a fallback when exact matching produces zero hits.
 * Scores each keyword with Levenshtein distance ≤ 1 against words in the text.
 * Requires keywords of 5+ characters to avoid short-word collisions.
 */
export function fuzzyKeywordScore(text: string, keywords: string[]): number {
  const lower = lowerText(text)
  let total = 0
  for (let i = 0; i < keywords.length; i++) {
    const k = keywords[i].toLowerCase()
    if (k.length < 5) continue
    if (k.includes(' ') || k.includes('.') || k.includes('/') || k.includes('-')) continue
    if (fuzzyMatchesWord(lower, k, 1)) total += 1
  }
  return total
}

export function hasAny(text: string, keywords: string[]): boolean {
  const normalizedText = lowerText(text)
  for (let i = 0; i < keywords.length; i++) {
    const info = getKeywordInfo(keywords[i])
    if (info.isPhrase) {
      if (normalizedText.includes(info.lower)) return true
    } else {
      if (info.wordRegex!.test(normalizedText)) return true
    }
  }
  return false
}

export function countMatches(text: string, keywords: string[]): number {
  const normalizedText = lowerText(text)
  let total = 0
  for (let i = 0; i < keywords.length; i++) {
    const info = getKeywordInfo(keywords[i])
    if (info.isPhrase) {
      if (normalizedText.includes(info.lower)) total += 1
    } else {
      if (info.wordRegex!.test(normalizedText)) total += 1
    }
  }
  return total
}

export function keywordScore(prompt: string, keywords: string[]): number {
  return countMatches(prompt, keywords)
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
    // Lane matches any prompt whose primary project is a ZK-prover-shaped
    // service. Dispatched downstream (chooseApiFamily / collectServiceProjects)
    // to the specific zkVM family when an explicit framework name is present,
    // or to the generic zk-prover-service otherwise.
    //
    // Does NOT include Noir or gnark — those are capabilities that layer
    // onto a parent family (react-vite-ts / go-api), not standalone projects.
    keywords: [
      'risc zero',
      'risczero',
      'risc0',
      'bonsai',
      'sp1',
      'succinct',
      'arkworks',
      'hand-rolled r1cs',
      'custom snark circuit',
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
    keywords: [
      'dspy',
      'rag system',
      'summarization system',
      'text classification system',
      'prompt engineering',
    ],
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
      'defi',
      'smart contract',
      // Solidity-authoring vocabulary — high-precision tokens that name a
      // contract deliverable even when a prompt is framed as "a UI for X" and
      // never says solidity/forge/uniswap. Without these, a Uniswap-V4 hook task
      // ("a hook development UI ... extending BaseHook ... in beforeSwap ...")
      // matched no evm keyword and fell through to frontend-static — no Solidity
      // toolchain, forcing the agent to shim. Multi-word / namespaced only: no
      // bare 'hook' (React hooks, webhooks) or 'pool' (swimming pools).
      'uniswap v4',
      'uni v4',
      'v4 hook',
      'hook contract',
      'basehook',
      'beforeswap',
      'afterswap',
      'beforeinitialize',
      'afterinitialize',
      'beforeaddliquidity',
      'afteraddliquidity',
      'poolmanager',
      'hookflags',
      'sqrtpricex96',
      'tickspacing',
      'tick accumulator',
      'erc-6909',
      'erc6909',
      'openzeppelin',
      'reentrancy',
      'pragma solidity',
      'foundry test',
      'forge test',
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

/**
 * Detect the best-matching industry layer from a prompt. Returns at most one
 * since a project has a single industry identity. Score = keyword match count;
 * highest wins, ties broken by registry order.
 */
export function detectIndustry(text: string, family: string, registry: Registry): string | null {
  let best: { id: string; score: number } | null = null
  for (const [key, layer] of registry.layers) {
    if (layer.group !== 'industry') continue
    if (!layer.keywords?.length) continue
    if (layer.appliesTo && !layer.appliesTo.includes(family)) continue
    const score = countMatches(text, layer.keywords)
    if (score > 0 && (!best || score > best.score)) {
      best = { id: key, score }
    }
  }
  return best?.id ?? null
}
