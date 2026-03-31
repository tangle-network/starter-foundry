function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
      'fhenix',
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

// Capability routes — specialize a family with domain-specific scaffolding.
// Adding a new agent use-case or SaaS pattern = one entry here.
export interface CapabilityRoute {
  id: string
  keywords: string[]
  appliesTo: string[]
}

export const CAPABILITY_ROUTES: CapabilityRoute[] = [
  // Agent specializations (all three languages: ts, py, rust)
  {
    id: 'agent-rag',
    keywords: ['rag', 'retrieval augmented', 'vector database', 'knowledge base', 'document qa', 'embeddings', 'semantic search', 'pinecone', 'chromadb', 'weaviate', 'qdrant'],
    appliesTo: ['agent-service-ts', 'agent-service-py', 'agent-service-rust'],
  },
  {
    id: 'agent-slack',
    keywords: ['slack bot', 'slack integration', 'slack agent', 'slack app'],
    appliesTo: ['agent-service-ts', 'agent-service-py', 'agent-service-rust'],
  },
  {
    id: 'agent-github',
    keywords: ['github bot', 'github integration', 'pr review agent', 'issue triage', 'github agent', 'github webhook agent'],
    appliesTo: ['agent-service-ts', 'agent-service-py', 'agent-service-rust'],
  },
  {
    id: 'agent-multi-agent',
    keywords: ['multi-agent', 'multi agent', 'supervisor agent', 'agent orchestration', 'agent team', 'crew', 'swarm', 'agent hierarchy'],
    appliesTo: ['agent-service-ts', 'agent-service-py', 'agent-service-rust'],
  },
  {
    id: 'agent-trading',
    keywords: ['trading agent', 'trading bot agent', 'market analysis agent', 'trading strategy agent', 'exchange api agent', 'order execution agent', 'backtesting agent'],
    appliesTo: ['agent-service-ts', 'agent-service-py', 'agent-service-rust'],
  },
  {
    id: 'agent-customer-support',
    keywords: ['customer support agent', 'support agent', 'help desk agent', 'ticket agent', 'support bot', 'customer service agent', 'helpdesk'],
    appliesTo: ['agent-service-ts', 'agent-service-py', 'agent-service-rust'],
  },
  {
    id: 'agent-code-review',
    keywords: ['code review agent', 'code analysis agent', 'pr reviewer agent', 'code quality agent', 'linting agent', 'code audit agent'],
    appliesTo: ['agent-service-ts', 'agent-service-py', 'agent-service-rust'],
  },
  {
    id: 'agent-data-pipeline',
    keywords: ['data analysis agent', 'data pipeline agent', 'sql agent', 'analytics agent', 'data analyst agent', 'report generation agent', 'bi agent'],
    appliesTo: ['agent-service-ts', 'agent-service-py', 'agent-service-rust'],
  },
  // Exchange API integrations
  {
    id: 'exchange-binance',
    keywords: ['binance', 'binance api', 'binance futures', 'binance spot'],
    appliesTo: ['agent-service-ts', 'agent-service-py', 'agent-service-rust', 'worker-job', 'python-worker', 'go-worker'],
  },
  {
    id: 'exchange-coinbase',
    keywords: ['coinbase advanced trade', 'coinbase exchange', 'coinbase pro', 'coinbase api trading'],
    appliesTo: ['agent-service-ts', 'agent-service-py', 'agent-service-rust', 'worker-job', 'python-worker', 'go-worker'],
  },
  {
    id: 'exchange-okx',
    keywords: ['okx api', 'okx trading', 'okx futures', 'okx exchange'],
    appliesTo: ['agent-service-ts', 'agent-service-py', 'agent-service-rust', 'worker-job', 'python-worker', 'go-worker'],
  },
  // DeFi protocol patterns
  {
    id: 'defi-lending',
    keywords: ['lending protocol', 'borrowing protocol', 'lending pool', 'collateral', 'liquidation', 'flash loan', 'aave', 'compound', 'morpho'],
    appliesTo: ['forge-contracts', 'hardhat-contracts', 'api-service', 'evm-infra-ts'],
  },
  {
    id: 'defi-dex',
    keywords: ['dex', 'amm', 'swap router', 'liquidity pool', 'constant product', 'concentrated liquidity', 'uniswap', 'curve', 'balancer'],
    appliesTo: ['forge-contracts', 'hardhat-contracts', 'api-service', 'evm-infra-ts'],
  },
  {
    id: 'defi-yield',
    keywords: ['yield aggregator', 'vault strategy', 'auto-compound', 'yield farming', 'erc-4626', 'erc4626', 'yearn', 'beefy'],
    appliesTo: ['forge-contracts', 'hardhat-contracts', 'api-service', 'evm-infra-ts', 'worker-job'],
  },
  {
    id: 'defi-bridge',
    keywords: ['bridge protocol', 'cross-chain bridge', 'lock and mint', 'burn and release', 'cross-chain messaging', 'wormhole', 'axelar', 'connext'],
    appliesTo: ['forge-contracts', 'hardhat-contracts', 'api-service', 'evm-infra-ts'],
  },
  // Web/SaaS capabilities
  {
    id: 'ai-chat-ui',
    keywords: ['chat interface', 'chat ui', 'streaming chat', 'chatbot ui', 'ai chat', 'conversation ui', 'chat app', 'chatgpt clone'],
    appliesTo: ['react-vite-ts', 'nextjs-ts', 'fullstack-ts'],
  },
  {
    id: 'saas-billing',
    keywords: ['saas billing', 'subscription billing', 'pricing plans', 'usage metering', 'plan tiers', 'freemium', 'saas pricing'],
    appliesTo: ['nextjs-ts', 'fullstack-ts', 'api-service'],
  },
  {
    id: 'saas-teams',
    keywords: ['team management', 'multi-tenant', 'organization management', 'team roles', 'invitation system', 'rbac', 'workspace management'],
    appliesTo: ['nextjs-ts', 'fullstack-ts', 'api-service'],
  },
  {
    id: 'admin-crud',
    keywords: ['admin dashboard', 'admin panel', 'crud app', 'back office', 'internal tool', 'data management', 'admin console'],
    appliesTo: ['nextjs-ts', 'fullstack-ts'],
  },
  // Infrastructure capabilities
  {
    id: 'webhook-processor',
    keywords: ['webhook handler', 'webhook processor', 'inbound webhook', 'webhook ingestion', 'webhook endpoint'],
    appliesTo: ['api-service', 'agent-service-ts', 'agent-service-py', 'agent-service-rust'],
  },
  {
    id: 'realtime-ws',
    keywords: ['websocket', 'websocket server', 'real-time updates', 'realtime api', 'live updates', 'pub/sub server', 'presence tracking', 'websocket api'],
    appliesTo: ['api-service', 'fullstack-ts'],
  },
  {
    id: 'deploy-docker',
    keywords: ['docker', 'dockerfile', 'docker-compose', 'containerize', 'container deployment'],
    appliesTo: ['api-service', 'python-api', 'rust-service', 'go-api', 'agent-service-ts', 'agent-service-py', 'agent-service-rust', 'worker-job', 'python-worker', 'go-worker', 'fullstack-ts', 'nextjs-ts', 'evm-infra-ts'],
  },
  {
    id: 'deploy-github-actions',
    keywords: ['github actions', 'ci/cd', 'ci cd', 'continuous integration', 'continuous deployment', 'github workflow'],
    appliesTo: ['api-service', 'python-api', 'rust-service', 'go-api', 'agent-service-ts', 'agent-service-py', 'agent-service-rust', 'worker-job', 'python-worker', 'go-worker', 'fullstack-ts', 'nextjs-ts', 'react-vite-ts', 'forge-contracts', 'hardhat-contracts'],
  },
  // AI/ML tooling
  {
    id: 'agent-mastra',
    keywords: ['mastra', 'mastra agent', 'mastra tools', 'mastra workflows'],
    appliesTo: ['agent-service-ts'],
  },
  {
    id: 'agent-hermes',
    keywords: ['hermes', 'hermes model', 'hermes agent', 'nousresearch', 'hermes function calling'],
    appliesTo: ['agent-service-ts', 'agent-service-py', 'agent-service-rust'],
  },
  {
    id: 'agent-openclaw',
    keywords: ['openclaw', 'openclaw agent', 'openclaw orchestration'],
    appliesTo: ['agent-service-ts', 'agent-service-py', 'agent-service-rust'],
  },
  {
    id: 'ai-fine-tuning',
    keywords: ['fine-tuning', 'fine tuning', 'finetune', 'unsloth', 'qlora', 'lora', 'peft', 'training run', 'train a model'],
    appliesTo: ['agent-service-py', 'python-api', 'python-worker'],
  },
  {
    id: 'gpu-modal',
    keywords: ['modal', 'modal gpu', 'modal serverless', 'modal.com'],
    appliesTo: ['agent-service-py', 'python-api', 'python-worker', 'agent-service-ts'],
  },
  {
    id: 'gpu-replicate',
    keywords: ['replicate', 'replicate api', 'replicate model', 'cog model'],
    appliesTo: ['agent-service-ts', 'agent-service-py', 'agent-service-rust', 'api-service', 'python-api', 'worker-job', 'python-worker'],
  },
  {
    id: 'gpu-together',
    keywords: ['together ai', 'together api', 'together inference'],
    appliesTo: ['agent-service-ts', 'agent-service-py', 'agent-service-rust', 'api-service', 'python-api', 'worker-job', 'python-worker'],
  },
  {
    id: 'ai-agent-dashboard',
    keywords: ['agent dashboard', 'agent monitoring', 'agent observability', 'run traces', 'agent traces', 'agent analytics'],
    appliesTo: ['react-vite-ts', 'nextjs-ts', 'fullstack-ts', 'sveltekit-ts', 'remix-ts', 'vue-ts'],
  },
  // Infrastructure
  {
    id: 'infra-terraform',
    keywords: ['terraform', 'terraform module', 'hcl', 'infrastructure as code'],
    appliesTo: ['api-service', 'python-api', 'rust-service', 'go-api', 'agent-service-ts', 'agent-service-py', 'agent-service-rust', 'fullstack-ts', 'nextjs-ts', 'worker-job', 'python-worker', 'go-worker'],
  },
  {
    id: 'infra-pulumi',
    keywords: ['pulumi', 'pulumi stack', 'pulumi typescript'],
    appliesTo: ['api-service', 'python-api', 'rust-service', 'go-api', 'agent-service-ts', 'agent-service-py', 'agent-service-rust', 'fullstack-ts', 'nextjs-ts', 'worker-job', 'python-worker', 'go-worker'],
  },
  {
    id: 'infra-k8s',
    keywords: ['kubernetes', 'k8s', 'helm chart', 'kubectl', 'deployment manifest'],
    appliesTo: ['api-service', 'python-api', 'rust-service', 'go-api', 'agent-service-ts', 'agent-service-py', 'agent-service-rust', 'fullstack-ts', 'nextjs-ts', 'worker-job', 'python-worker', 'go-worker'],
  },
  {
    id: 'effect-ts',
    keywords: ['effect-ts', 'effect ts', 'effect runtime', 'typed errors', 'structured concurrency'],
    appliesTo: ['api-service', 'agent-service-ts', 'fullstack-ts', 'worker-job', 'cli-ts', 'cloudflare-worker-ts'],
  },
  // More DeFi
  {
    id: 'defi-perpetuals',
    keywords: ['perpetual futures', 'perps protocol', 'funding rate', 'liquidation engine', 'margin trading', 'gmx', 'hyperliquid'],
    appliesTo: ['forge-contracts', 'hardhat-contracts', 'api-service', 'evm-infra-ts'],
  },
  {
    id: 'defi-restaking',
    keywords: ['restaking', 'shared security', 'operator registration', 'delegation', 'symbiotic', 'karak'],
    appliesTo: ['forge-contracts', 'hardhat-contracts', 'api-service', 'evm-infra-ts'],
  },
  // Design system capabilities
  {
    id: 'tailwind',
    keywords: ['tailwind', 'tailwindcss', 'utility css', 'postcss'],
    appliesTo: ['react-vite-ts', 'nextjs-ts', 'fullstack-ts', 'sveltekit-ts', 'remix-ts', 'vue-ts', 'angular-ts', 'frontend-static', 'browser-extension-ts', 'electron-desktop-ts', 'tauri-desktop'],
  },
  {
    id: 'shadcn',
    keywords: ['shadcn', 'shadcn/ui', 'shadcn-ui', 'radix ui', 'radix primitives', 'cn utility', 'component library'],
    appliesTo: ['react-vite-ts', 'nextjs-ts', 'fullstack-ts', 'remix-ts', 'sveltekit-ts', 'vue-ts', 'electron-desktop-ts', 'tauri-desktop'],
  },
  {
    id: 'dashboard-layout',
    keywords: ['sidebar layout', 'dashboard layout', 'admin layout', 'collapsible sidebar', 'navigation sidebar'],
    appliesTo: ['react-vite-ts', 'nextjs-ts', 'fullstack-ts', 'sveltekit-ts', 'remix-ts', 'vue-ts', 'angular-ts'],
  },
  {
    id: 'typography',
    keywords: ['typography', 'prose', 'font system', 'heading scale', 'typographic scale'],
    appliesTo: ['react-vite-ts', 'nextjs-ts', 'fullstack-ts', 'sveltekit-ts', 'remix-ts', 'vue-ts', 'angular-ts', 'frontend-static'],
  },
  {
    id: 'icons',
    keywords: ['lucide', 'icon system', 'icon library', 'lucide icons'],
    appliesTo: ['react-vite-ts', 'nextjs-ts', 'fullstack-ts', 'sveltekit-ts', 'remix-ts', 'vue-ts', 'electron-desktop-ts', 'tauri-desktop', 'expo-react-native-ts'],
  },
]

/** Returns capability layer IDs that apply to the given family and match the prompt text. */
export function detectCapabilities(text: string, family: string): string[] {
  return CAPABILITY_ROUTES
    .filter((cap) => cap.appliesTo.includes(family) && hasAny(text, cap.keywords))
    .map((cap) => `capability:${cap.id}`)
}
