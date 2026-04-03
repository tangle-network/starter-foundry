import { sanitizePackageName } from './fs.js'
import { loadRegistry } from './registry.js'
import { selectStarter } from './selection.js'
import { detectCapabilities, detectLane, hasAny, matchesKeyword } from './keywords.js'
import type { Registry } from '../types.js'
import type { ComposeSpec, WorkspaceSpec, PromptPlan, ProjectEntry } from '../types.js'

function buildSlug(prompt: string, fallback: string): string {
  const slug = sanitizePackageName(prompt).slice(0, 40)
  return slug || fallback
}

function resolvePartnerForFamily(partner: string | null, family: string): string | null {
  if (!partner) {
    return null
  }

  const familySets: Record<string, Set<string>> = {
    coinbase: new Set([
      'frontend-static',
      'react-vite-ts',
      'nextjs-ts',
      'fullstack-ts',
      'expo-react-native-ts',
      'browser-extension-ts',
      'electron-desktop-ts',
      'tauri-desktop',
      'api-service',
      'cloudflare-worker-ts',
      'python-api',
      'rust-service',
      'go-api',
      'worker-job',
      'go-worker',
      'playwright-worker',
      'evm-infra-ts',
      'agent-service-ts',
      'agent-service-py',
      'forge-contracts',
      'hardhat-contracts',
    ]),
    tangle: new Set([
      'frontend-static',
      'react-vite-ts',
      'nextjs-ts',
      'fullstack-ts',
      'api-service',
      'python-api',
      'rust-service',
      'go-api',
      'worker-job',
      'go-worker',
      'playwright-worker',
      'evm-infra-ts',
      'agent-service-ts',
      'agent-service-py',
      'agent-service-rust',
      'tangle-blueprint',
    ]),
    eigenlayer: new Set([
      'frontend-static',
      'react-vite-ts',
      'nextjs-ts',
      'fullstack-ts',
      'api-service',
      'python-api',
      'rust-service',
      'go-api',
      'worker-job',
      'go-worker',
      'playwright-worker',
      'evm-infra-ts',
      'agent-service-ts',
      'agent-service-py',
      'agent-service-rust',
      'eigenlayer-avs',
    ]),
    arbitrum: new Set([
      'frontend-static',
      'react-vite-ts',
      'nextjs-ts',
      'fullstack-ts',
      'api-service',
      'python-api',
      'rust-service',
      'go-api',
      'worker-job',
      'go-worker',
      'playwright-worker',
      'evm-infra-ts',
      'agent-service-ts',
      'agent-service-py',
      'agent-service-rust',
      'forge-contracts',
      'hardhat-contracts',
      'stylus-contracts',
    ]),
    xlayer: new Set([
      'frontend-static',
      'react-vite-ts',
      'nextjs-ts',
      'fullstack-ts',
      'api-service',
      'python-api',
      'rust-service',
      'go-api',
      'worker-job',
      'go-worker',
      'playwright-worker',
      'evm-infra-ts',
      'agent-service-ts',
      'agent-service-py',
      'agent-service-rust',
      'forge-contracts',
      'hardhat-contracts',
    ]),
    solana: new Set([
      'frontend-static',
      'react-vite-ts',
      'nextjs-ts',
      'fullstack-ts',
      'api-service',
      'python-api',
      'rust-service',
      'go-api',
      'worker-job',
      'go-worker',
      'playwright-worker',
      'agent-service-ts',
      'agent-service-py',
      'agent-service-rust',
      'solana-program',
    ]),
  }

  return familySets[partner]?.has(family) ? partner : null
}

function detectDatabaseSlot(text: string): string | null {
  if (text.includes('convex')) return 'database:convex'
  if (text.includes('postgres')) return 'database:postgres'
  if (text.includes('mongodb') || text.includes('mongo')) return 'database:mongodb'
  if (text.includes('sqlite')) return 'database:sqlite'
  return null
}

function detectSdkSlot(text: string, partner: string | null): string | null {
  if (text.includes('solana web3') || text.includes('@solana/web3') || text.includes('wallet adapter')) {
    return 'sdk:solana-web3'
  }
  if (partner === 'coinbase') return 'sdk:coinbase-cdp'
  if (text.includes('coinbase cdp') || text.includes('coinbase sdk')) return 'sdk:coinbase-cdp'
  if (
    partner === 'xlayer' ||
    partner === 'arbitrum' ||
    hasAny(text, ['walletconnect', 'wallet connect', 'okx wallet', 'metamask', 'viem', 'ethers'])
  ) {
    return 'sdk:evm-wallet'
  }
  return null
}

function detectAuthSlot(text: string): string | null {
  if (text.includes('clerk')) return 'auth:clerk'
  if (text.includes('better auth') || text.includes('better-auth')) return 'auth:better-auth'
  if (text.includes('supabase auth') || text.includes('supabase-auth')) return 'auth:supabase-auth'
  return null
}

function detectPaymentsSlot(text: string): string | null {
  if (text.includes('coinbase commerce')) return 'payments:coinbase-commerce'
  if (text.includes('stripe') || text.includes('subscription') || text.includes('billing') || text.includes('checkout')) {
    return 'payments:stripe'
  }
  return null
}

function detectQueueSlot(text: string): string | null {
  if (text.includes('trigger.dev') || text.includes('trigger dev')) return 'queue:trigger-dev'
  if (text.includes('bullmq') || text.includes('queue') || text.includes('background job')) return 'queue:bullmq'
  return null
}

function detectTangleOraclePattern(text: string): boolean {
  return (
    hasAny(text, ['tangle', 'tangle network', 'tangle native']) &&
    hasAny(text, ['oracle', 'price feed', 'attestation', 'feeder', 'operator rewards', 'slashing', 'data source'])
  )
}

function detectTangleCustodyPattern(text: string): boolean {
  return (
    hasAny(text, ['tangle', 'tangle network', 'tangle native', 'frost']) &&
    hasAny(text, ['custody', 'mpc', 'threshold signing', 'key resharing', 'policy engine', 'signing ceremony'])
  )
}

function detectEvmDeployPattern(text: string): boolean {
  return hasAny(text, [
    'foundry.toml',
    'deploy script',
    'deploy task',
    'contract verification',
    'verify',
    'oklink explorer',
    '.env template',
    'private_key',
    'sample erc20',
  ])
}

function detectHardhatExplicit(text: string): boolean {
  return text.includes('hardhat') && !hasAny(text, ['foundry', 'forge'])
}

function detectEvmSupportApiPattern(text: string): boolean {
  return hasAny(text, [
    'indexer',
    'subgraph',
    'events',
    'relayer',
    'paymaster',
    'bundler',
    'keeper',
    'oracle',
    'bridge',
    'bridges',
    'layerzero',
    'oft',
    'sendtokens',
    'hook',
    'analytics',
    'portfolio',
    'metrics',
    'multicall',
    'wallet balance',
    'transaction count',
    'gas price',
    'websocket',
    '/stats',
  ])
}

function inferPartner(text: string): string | null {
  if (hasAny(text, ['coinbase', 'base network', 'coinbase commerce', 'coinbase wallet', 'coinbase cdp'])) {
    return 'coinbase'
  }
  if (hasAny(text, ['tangle', 'blueprint sdk', 'cargo tangle'])) return 'tangle'
  if (hasAny(text, ['eigenlayer', 'avs'])) return 'eigenlayer'
  if (hasAny(text, ['x layer', 'xlayer', 'okb', 'oklink', 'okx'])) return 'xlayer'
  if (hasAny(text, ['arbitrum', 'stylus'])) return 'arbitrum'
  if (hasAny(text, ['solana', 'anchor', 'pda', 'wallet adapter'])) return 'solana'
  return null
}

function needsSupportApiLane(text: string): boolean {
  return hasAny(text, [
    'order management',
    'order history',
    'payment webhook',
    'quote generation',
    'claims',
    'transaction history',
    'history/audit',
    'portfolio',
    'analytics',
    'monitoring',
    'indexer',
    'websocket',
    'database',
    'metrics',
    'p&l',
    'api endpoints',
    'consumer integration',
    'historical data',
    'data source',
    'programmatic access',
    'control plane',
    'agent state',
    'tool logs',
    'memory',
    'thread history',
    'execution traces',
  ])
}

function detectSolanaProductApiPattern(text: string): boolean {
  return hasAny(text, [
    'pyth',
    'switchboard',
    'jupiter',
    'openbook',
    'analytics',
    'leaderboard',
    'activity feed',
    'creator dashboard',
    'launch calendar',
    'pool discovery',
    'market browser',
    'market data',
    'oracle integration',
    'price feeds',
    'dashboard',
    'staking dashboard',
    'royalty analytics',
    'position explorer',
    'pool explorer',
  ])
}

function detectSolanaWorkerPattern(text: string): boolean {
  return hasAny(text, [
    'keeper',
    'liquidation',
    'funding rate',
    'pyth price feeds',
    'switchboard',
    'oracle integration',
    'disputes',
    'auto-deleveraging',
    'rebalance',
    'rebalancing',
    'rewards distribution',
    'reward distribution',
    'vesting',
    'sale monitor',
    'auto-compound',
  ])
}

function buildEvmContractLayers(text: string): string[] {
  const hardhatExplicit = detectHardhatExplicit(text)
  const layers = [hardhatExplicit ? 'framework:hardhat-ts' : 'framework:forge-foundation']

  if (!hardhatExplicit && detectEvmDeployPattern(text)) {
    layers.push('capability:evm-deploy-foundry')
  }

  if (
    !hardhatExplicit &&
    hasAny(text, ['layerzero', 'oft', 'bridge tokens', 'sendtokens script', 'omnichain fungible token'])
  ) {
    layers.push('capability:evm-layerzero-oft')
  } else if (
    !hardhatExplicit &&
    hasAny(text, ['erc-4337', 'erc4337', 'bundler', 'permissionless.js', 'gasless mint', 'account abstraction'])
  ) {
    layers.push('capability:evm-account-abstraction')
  }

  return layers
}

interface AgentFamilyChoice {
  family: string
  layers: string[]
  path: string
  variables?: Record<string, string>
}

function chooseAgentFamily(text: string): AgentFamilyChoice {
  if (hasAny(text, ['rust', 'cargo', 'rig', 'rust agent'])) {
    return {
      family: 'agent-service-rust',
      layers: ['framework:agent-service-rust'],
      path: 'apps/agent',
      variables: {
        agentLibrary: matchesKeyword(text, 'rig') ? 'rig' : 'rust-agent',
      },
    }
  }

  if (
    hasAny(text, ['python', 'fastapi', 'pydanticai', 'crewai', 'autogen', 'agno', 'llamaindex', 'agentkit', 'python agent', 'unsloth', 'qlora'])
  ) {
    let agentLibrary = 'pydanticai'
    if (text.includes('crewai')) agentLibrary = 'crewai'
    else if (text.includes('autogen')) agentLibrary = 'autogen'
    else if (text.includes('agno')) agentLibrary = 'agno'
    else if (text.includes('llamaindex')) agentLibrary = 'llamaindex'
    else if (text.includes('agentkit')) agentLibrary = 'agentkit'

    return {
      family: 'agent-service-py',
      layers: ['framework:agent-service-py'],
      path: 'apps/agent',
      variables: { agentLibrary },
    }
  }

  let agentLibrary = 'openai-agents'
  if (text.includes('langgraph')) agentLibrary = 'langgraph'
  else if (text.includes('mastra')) agentLibrary = 'mastra'
  else if (hasAny(text, ['anthropic sdk', 'claude sdk'])) agentLibrary = 'anthropic-sdk'

  return {
    family: 'agent-service-ts',
    layers: ['framework:agent-service-ts'],
    path: 'apps/agent',
    variables: { agentLibrary },
  }
}

function buildEvmContractVariables(text: string): Record<string, string> {
  if (hasAny(text, ['layerzero', 'oft', 'omnichain fungible token'])) return { contractName: 'OmnichainToken' }
  if (hasAny(text, ['erc721', 'erc-721', 'nft collection', 'gasless mint'])) return { contractName: 'GaslessCollectible' }
  if (hasAny(text, ['erc20', 'erc-20', 'sample erc20'])) return { contractName: 'XLayerToken' }
  return { contractName: 'Counter' }
}

function buildSolanaProgramLayers(text: string): string[] {
  const layers = ['framework:solana-native-rust']

  if (hasAny(text, ['perpetual', 'futures', 'funding rate', 'liquidation', 'insurance fund', 'cross-collateral'])) {
    layers.push('capability:solana-perps')
  } else if (hasAny(text, ['concentrated liquidity', 'tick-based liquidity', 'swap router', 'position nft'])) {
    layers.push('capability:solana-amm')
  } else if (hasAny(text, ['nft marketplace', 'compressed nfts', 'royalty enforcement', 'bundle sales'])) {
    layers.push('capability:solana-nft')
  } else if (hasAny(text, ['launchpad', 'fair launches', 'dutch auction', 'bonding curve', 'claim portal'])) {
    layers.push('capability:solana-launchpad')
  } else if (hasAny(text, ['staking platform', 'veToken', 'rewards dashboard', 'auto-compound', 'validator delegation'])) {
    layers.push('capability:solana-staking')
  } else if (hasAny(text, ['prediction market', 'binary (yes/no)', 'switchboard oracle', 'scalar', 'categorical'])) {
    layers.push('capability:solana-prediction')
  }

  return layers
}

function buildSolanaProgramVariables(text: string): Record<string, string> {
  if (hasAny(text, ['perpetual', 'futures'])) return { instructionName: 'InitializePerpMarket' }
  if (hasAny(text, ['concentrated liquidity', 'amm dex', 'swap router'])) return { instructionName: 'InitializePool' }
  if (hasAny(text, ['nft marketplace', 'compressed nfts'])) return { instructionName: 'CreateListing' }
  if (hasAny(text, ['launchpad', 'fair launches', 'bonding curve'])) return { instructionName: 'CreateLaunch' }
  if (hasAny(text, ['staking platform', 'veToken', 'auto-compound'])) return { instructionName: 'InitializeStakePool' }
  if (hasAny(text, ['prediction market', 'scalar', 'categorical'])) return { instructionName: 'CreateMarket' }
  return { instructionName: 'InitializeTreasury' }
}

function buildWebProject(prompt: string, partner: string | null, text: string, registry?: Registry): ProjectEntry {
  const isNext = hasAny(text, ['next', 'next.js', 'nextjs', 'app router', 'seo'])
  const family = isNext ? 'nextjs-ts' : 'react-vite-ts'
  const frameworkLayer = isNext ? 'framework:nextjs-app-router' : 'framework:react-vite-ts'
  const layers = [frameworkLayer]

  if (hasAny(text, ['dashboard', 'metrics', 'analytics', 'control plane', 'admin'])) {
    layers.push('capability:chart-widget')
  }

  const slots: Record<string, string> = {}
  const sdkSlot = detectSdkSlot(text, partner)
  const authSlot = detectAuthSlot(text)
  const paymentsSlot = detectPaymentsSlot(text)
  if (authSlot) slots['auth'] = authSlot
  if (paymentsSlot) slots['payments'] = paymentsSlot
  if (sdkSlot) slots['sdk'] = sdkSlot

  const webCapabilities = registry ? detectCapabilities(text, family, registry) : []
  if (webCapabilities.length > 0) layers.push(...webCapabilities)

  return {
    id: 'web',
    path: 'apps/web',
    spec: {
      projectName: `${buildSlug(prompt, 'workspace')}-web`,
      family,
      layers: [...new Set(layers)],
      partner: resolvePartnerForFamily(partner, family),
      slots,
      variables: {
        headline: 'Ship the primary product surface first',
        subheadline:
          'This workspace starts with the user-visible surface before deepening the backend and contract lanes.',
      },
      primaryArtifactTargetMs: 2500,
    },
  }
}

interface FamilyChoice {
  family: string
  layers: string[]
  path: string
  variables?: Record<string, string>
}

function chooseWorkerFamily(text: string): FamilyChoice {
  if (hasAny(text, ['playwright', 'browser automation', 'web scraping', 'scraper', 'crawler'])) {
    return { family: 'playwright-worker', layers: ['framework:playwright-worker'], path: 'apps/worker' }
  }

  if (hasAny(text, ['go worker', 'golang worker', 'go cron', 'go queue', 'go background job'])) {
    return { family: 'go-worker', layers: ['framework:go-worker'], path: 'apps/worker' }
  }

  if (hasAny(text, ['python worker', 'python cron', 'python queue', 'python background job', 'celery', 'python task'])) {
    return { family: 'python-worker', layers: ['framework:python-worker'], path: 'apps/worker' }
  }

  if (detectLane(text, 'agent') && hasAny(text, ['worker', 'background', 'cron', 'queue', 'runner', 'executor'])) {
    return { family: 'worker-job', layers: ['framework:node-worker'], path: 'apps/worker' }
  }

  const layers = ['framework:node-worker']
  if (hasAny(text, ['trading', 'market', 'feed', 'stream'])) {
    layers.push('capability:market-sim')
  }

  return { family: 'worker-job', layers, path: 'apps/worker' }
}

function chooseApiFamily(text: string): FamilyChoice {
  if (detectLane(text, 'x402')) return { family: 'x402-service', layers: ['framework:x402-service'], path: 'apps/api' }
  if (detectLane(text, 'mcp')) return { family: 'mcp-server-ts', layers: ['framework:mcp-server-ts'], path: 'apps/mcp' }
  if (detectLane(text, 'dspy')) return { family: 'dspy-pipeline-py', layers: ['framework:dspy-pipeline-py'], path: 'apps/ai' }
  if (detectLane(text, 'agent')) return chooseAgentFamily(text)
  if (detectLane(text, 'zk')) return { family: 'zk-prover-service', layers: ['framework:zk-prover-service'], path: 'apps/prover' }
  if (detectLane(text, 'evm-infra')) return { family: 'evm-infra-ts', layers: ['framework:evm-infra-ts'], path: 'apps/api' }

  if (hasAny(text, ['cloudflare', 'durable object', 'edge api', 'edge function', 'hono edge'])) {
    return { family: 'cloudflare-worker-ts', layers: ['framework:cloudflare-worker-ts'], path: 'apps/edge' }
  }
  if (hasAny(text, ['rust', 'cargo', 'axum', 'rust api', 'rust backend'])) {
    return { family: 'rust-service', layers: ['framework:rust-http'], path: 'apps/api' }
  }
  if (hasAny(text, ['python', 'fastapi', 'flask', 'django', 'python api'])) {
    return { family: 'python-api', layers: ['framework:python-http'], path: 'apps/api' }
  }
  if (hasAny(text, ['golang', 'go api', 'go backend', 'go service', 'net/http'])) {
    return { family: 'go-api', layers: ['framework:go-net-http'], path: 'apps/api' }
  }

  return { family: 'api-service', layers: ['framework:node-http', 'capability:logging'], path: 'apps/api' }
}

function buildApiProject(prompt: string, partner: string | null, text: string, registry?: Registry): ProjectEntry {
  const choice = chooseApiFamily(text)
  const layers = [...choice.layers]
  const slots: Record<string, string> = {}
  const databaseSlot = detectDatabaseSlot(text)
  const sdkSlot = detectSdkSlot(text, partner)
  const authSlot = detectAuthSlot(text)
  const paymentsSlot = detectPaymentsSlot(text)
  const queueSlot = detectQueueSlot(text)

  if (databaseSlot) slots['database'] = databaseSlot
  if (authSlot) slots['auth'] = authSlot
  if (paymentsSlot) slots['payments'] = paymentsSlot
  if (queueSlot) slots['queue'] = queueSlot
  if (sdkSlot) slots['sdk'] = sdkSlot

  if ((choice.family === 'api-service' || choice.family === 'evm-infra-ts') && detectEvmSupportApiPattern(text)) {
    layers.push('capability:evm-protocol-api')
  }

  if (choice.family === 'evm-infra-ts') {
    if (hasAny(text, ['block monitor', 'new blocks', 'gas price', 'tps', '/stats'])) {
      layers.push('capability:evm-chain-monitor')
    } else if (hasAny(text, ['wallet balance', 'wallet address', 'multicall', 'summary table'])) {
      layers.push('capability:evm-wallet-dashboard')
    }
  }

  const apiCapabilities = registry ? detectCapabilities(text, choice.family, registry) : []
  if (apiCapabilities.length > 0) layers.push(...apiCapabilities)

  return {
    id: choice.family.startsWith('agent-service-') ? 'agent' : 'api',
    path: choice.path,
    spec: {
      projectName: `${buildSlug(prompt, 'workspace')}-api`,
      family: choice.family,
      layers: [...new Set(layers)],
      partner: resolvePartnerForFamily(partner, choice.family),
      slots,
      variables: choice.variables ?? {},
      primaryArtifactTargetMs: 2500,
    },
  }
}

function buildWorkerProject(prompt: string, partner: string | null, text: string): ProjectEntry {
  const choice = chooseWorkerFamily(text)
  const layers = [...choice.layers]
  const slots: Record<string, string> = {}
  const queueSlot = detectQueueSlot(text)
  if (queueSlot) slots['queue'] = queueSlot

  if (choice.family === 'worker-job' && hasAny(text, ['solana', 'anchor', 'pyth', 'switchboard', 'keeper', 'liquidation'])) {
    layers.push('capability:solana-keeper')
  }

  return {
    id: 'worker',
    path: choice.path,
    spec: {
      projectName: `${buildSlug(prompt, 'workspace')}-worker`,
      family: choice.family,
      layers,
      partner: resolvePartnerForFamily(partner, choice.family),
      slots,
      variables: {
        workerName: partner ? `${partner} worker lane` : 'workspace worker lane',
      },
      primaryArtifactTargetMs: 2500,
    },
  }
}

// Single-surface families that never become workspaces
const SINGLE_LANE_SIGNALS = [
  'expo', 'react native', 'mobile app', 'ios app', 'android app',
  'browser extension', 'chrome extension', 'manifest v3',
  'electron', 'desktop app', 'desktop assistant',
  'command line', 'terminal tool',
  'streamlit', 'gradio', 'data app', 'tauri',
]

const FRONTEND_SIGNALS = [
  'frontend', 'ui', 'website', 'landing', 'dashboard', 'web app', 'app',
  'preview', 'next', 'react', 'platform', 'dapp', 'interface', 'portal',
]

const API_SIGNALS = [
  'api', 'backend', 'server', 'endpoint', 'service', 'webhook', 'health check',
  'cloudflare', 'durable object', 'edge api', 'edge function', 'payment webhook',
  'server wallet', 'rest api', 'graphql api',
]

const FRAMEWORK_API_TERMS = ['composition api', 'options api', 'signals api', 'context api', 'hooks api']
const STRONG_API_TERMS = ['backend', 'server', 'endpoint', 'webhook', 'rest api', 'graphql api', 'api service', 'api endpoint', 'health check']

const WORKER_SIGNALS = [
  'trading bot', 'background job', 'background worker', 'worker for', 'playwright worker',
  'automation worker', 'go worker', 'golang worker', 'queue', 'cron', 'market stream', 'bot',
]

const EXPLICIT_WORKER_SIGNALS = [
  'trading bot', 'background job', 'background worker', 'worker for', 'playwright worker',
  'automation worker', 'go worker', 'golang worker', 'queue', 'cron', 'market stream',
]

const FULLSTACK_SIGNALS = [
  'fullstack', 'full stack', 'dashboard with api', 'app with api', 'admin app', 'admin panel',
  'database-backed', 'dashboard and api', 'admin flows', 'saas', 'saas app', 'saas platform',
  'internal tool', 'back office', 'crud app',
]

const WORKSPACE_SIGNALS = [
  'workspace', 'monorepo', 'separate backend', 'separate api',
  'background worker', 'contract lane', 'contract lanes',
]

interface LaneDetection {
  frontend: boolean
  api: boolean
  worker: boolean
  evm: boolean
  solana: boolean
  move: boolean
  tangle: boolean
  avs: boolean
  stylus: boolean
  zk: boolean
  mcp: boolean
  dspy: boolean
  agent: boolean
  x402: boolean
  evmInfra: boolean
  implicitApi: boolean
  implicitWorker: boolean
}

function detectLanes(text: string, partner: string | null): LaneDetection {
  const hasApiRaw = hasAny(text, API_SIGNALS)
  const apiIsFalsePositive = hasApiRaw && !hasAny(text, STRONG_API_TERMS) && hasAny(text, FRAMEWORK_API_TERMS)
  const api = hasApiRaw && !apiIsFalsePositive

  const hasWorkerRaw = hasAny(text, WORKER_SIGNALS)
  const agentLane = detectLane(text, 'agent')
  const worker = hasWorkerRaw && (!agentLane || hasAny(text, EXPLICIT_WORKER_SIGNALS))

  const frontend = hasAny(text, FRONTEND_SIGNALS)
  const evm = detectLane(text, 'evm')
  const solana = hasAny(text, ['solana', 'anchor', 'pda'])
  const move = hasAny(text, ['move', 'aptos', 'sui'])
  const tangle = detectLane(text, 'tangle')
  const avs = detectLane(text, 'avs')
  const stylus = detectLane(text, 'stylus')
  const zk = detectLane(text, 'zk')
  const mcp = detectLane(text, 'mcp')
  const dspy = detectLane(text, 'dspy')
  const x402 = detectLane(text, 'x402')
  const evmInfra = detectLane(text, 'evm-infra')

  const hasProtocol = evm || solana || tangle || avs || stylus || evmInfra
  const commerceSupportApi =
    !api && frontend && needsSupportApiLane(text) &&
    (partner === 'coinbase' || detectPaymentsSlot(text) !== null || detectSdkSlot(text, partner) !== null) &&
    hasAny(text, ['api', 'backend', 'server', 'endpoint', 'webhook', 'order management', 'order history', 'payment webhook', 'indexer', 'transaction history'])
  const implicitApi =
    !api &&
    ((hasProtocol && (needsSupportApiLane(text) || detectEvmSupportApiPattern(text) || (solana && detectSolanaProductApiPattern(text)))) ||
      commerceSupportApi)
  const implicitWorker =
    !worker &&
    ((solana && detectSolanaWorkerPattern(text)) ||
      (evm && hasAny(text, ['keeper', 'bundler'])) ||
      (x402 && agentLane))

  return {
    frontend, api, worker, evm, solana, move, tangle, avs, stylus,
    zk, mcp, dspy, agent: agentLane, x402, evmInfra, implicitApi, implicitWorker,
  }
}

function shouldBeWorkspace(lanes: LaneDetection, text: string, partner: string | null): boolean {
  if (hasAny(text, SINGLE_LANE_SIGNALS)) return false

  const { frontend, api, worker, evm, solana, move, tangle, avs, stylus, zk, mcp, dspy, agent, x402, evmInfra, implicitApi, implicitWorker } = lanes
  const runtimeCount = [evm, solana, move].filter(Boolean).length
  const protocolLanes = [tangle, avs, stylus, zk, mcp, dspy, x402]

  // Plain agent/protocol without other surfaces → single starter
  const onlyAgent = agent && !frontend && !worker && !evm && !solana && !move && !protocolLanes.some(Boolean) && !evmInfra
  const onlyProtocol = !frontend && !api && !worker && !agent && protocolLanes.some(Boolean)
  if (onlyAgent || onlyProtocol) return false

  // Fullstack (frontend + api, no other lanes) → single fullstack-ts starter
  const noSpecialLanes = !worker && !evm && !solana && !move && !tangle && !avs && !stylus && !zk && !mcp && !dspy && !agent && !x402 && !evmInfra
  if (noSpecialLanes && frontend && api && !hasAny(text, WORKSPACE_SIGNALS) && hasAny(text, FULLSTACK_SIGNALS)) return false

  const laneCount = [frontend, api, worker, evm, solana, move, tangle, avs, stylus, zk, mcp, dspy, agent, x402, evmInfra, implicitApi].filter(Boolean).length
  const apiChoice = api ? chooseApiFamily(text) : null

  return (
    runtimeCount > 1 ||
    (frontend && runtimeCount > 0) ||
    (frontend && api) ||
    (worker && laneCount > 1) ||
    (frontend && protocolLanes.some(Boolean)) ||
    (frontend && agent) ||
    (frontend && api && apiChoice !== null && apiChoice.family !== 'api-service') ||
    (frontend && implicitApi) ||
    (implicitApi && (evm || solana || move || tangle || avs || stylus)) ||
    implicitWorker ||
    (hasAny(text, WORKSPACE_SIGNALS) && laneCount > 1)
  )
}

function buildProtocolProject(
  id: string, path: string, family: string, layers: string[],
  prompt: string, partner: string | null, variables: Record<string, string>,
): ProjectEntry {
  return {
    id, path,
    spec: {
      projectName: `${buildSlug(prompt, 'workspace')}-${id}`,
      family, layers,
      partner: resolvePartnerForFamily(partner, family),
      slots: {},
      variables,
    },
  }
}

function collectProtocolProjects(lanes: LaneDetection, prompt: string, partner: string | null, text: string): ProjectEntry[] {
  const projects: ProjectEntry[] = []

  if (lanes.tangle) {
    const tangleLayers = ['framework:tangle-blueprint']
    if (detectTangleCustodyPattern(text)) tangleLayers.push('capability:tangle-custody')
    else if (detectTangleOraclePattern(text)) tangleLayers.push('capability:tangle-oracle')
    const profile = text.includes('custody')
      ? { blueprintName: 'custody-blueprint', jobName: 'ApproveTransaction' }
      : text.includes('oracle')
        ? { blueprintName: 'oracle-blueprint', jobName: 'UpdatePriceFeed' }
        : text.includes('zk')
          ? { blueprintName: 'zk-prover-blueprint', jobName: 'GenerateProof' }
          : { blueprintName: 'storage-blueprint', jobName: 'StoreObject' }
    projects.push(buildProtocolProject('tangle', 'protocols/tangle', 'tangle-blueprint', tangleLayers, prompt, partner, profile))
  }

  if (lanes.avs) {
    const avsName = text.includes('oracle') ? 'oracle-avs'
      : text.includes('keeper') ? 'keeper-avs'
      : text.includes('sequencer') ? 'sequencer-avs'
      : text.includes('bridge') ? 'bridge-avs'
      : 'data-availability-avs'
    projects.push(buildProtocolProject('avs', 'protocols/avs', 'eigenlayer-avs', ['framework:eigenlayer-avs'], prompt, partner, { avsName }))
  }

  if (lanes.stylus) {
    projects.push(buildProtocolProject('stylus', 'contracts/stylus', 'stylus-contracts', ['framework:stylus-contracts'], prompt, partner, { contractName: 'StylusPool' }))
  }

  if (lanes.evm) {
    const family = detectHardhatExplicit(text) ? 'hardhat-contracts' : 'forge-contracts'
    projects.push(buildProtocolProject('evm', 'contracts/evm', family, buildEvmContractLayers(text), prompt, partner, buildEvmContractVariables(text)))
  }

  if (lanes.solana) {
    projects.push(buildProtocolProject('solana', 'contracts/solana', 'solana-program', buildSolanaProgramLayers(text), prompt, partner, buildSolanaProgramVariables(text)))
  }

  if (lanes.move) {
    projects.push({ id: 'move', path: 'contracts/move', spec: { projectName: 'move_treasury', family: 'move-contracts', layers: ['framework:move-package'], partner: null, slots: {}, variables: { moduleName: 'TreasuryVault' } } })
  }

  return projects
}

function collectServiceProjects(lanes: LaneDetection, prompt: string, partner: string | null, text: string, registry: Registry): ProjectEntry[] {
  const projects: ProjectEntry[] = []

  if (lanes.mcp && !lanes.api) {
    projects.push(buildProtocolProject('mcp', 'apps/mcp', 'mcp-server-ts', ['framework:mcp-server-ts'], prompt, null, {}))
  }
  if (lanes.dspy && !lanes.api) {
    projects.push(buildProtocolProject('ai', 'apps/ai', 'dspy-pipeline-py', ['framework:dspy-pipeline-py'], prompt, null, {}))
  }
  if (lanes.x402 && !lanes.api) {
    projects.push({ id: 'api', path: 'apps/api', spec: { projectName: `${buildSlug(prompt, 'workspace')}-api`, family: 'x402-service', layers: ['framework:x402-service'], partner: resolvePartnerForFamily(partner, 'x402-service'), slots: {}, variables: {}, primaryArtifactTargetMs: 2500 } })
  }
  if (lanes.zk && !lanes.api) {
    const proofSystem = text.includes('circom') ? 'circom' : text.includes('fhenix') ? 'fhenix' : text.includes('risc zero') ? 'risc-zero' : 'sp1'
    projects.push(buildProtocolProject('zk', 'apps/prover', 'zk-prover-service', ['framework:zk-prover-service'], prompt, null, { proofSystem }))
  }
  if (lanes.agent && !projects.some((p) => p.id === 'agent')) {
    projects.push(buildApiProject(prompt, partner, text, registry))
  }

  return projects
}

function buildWorkspacePromptPlan({
  prompt,
  partner,
  text,
  registry,
}: {
  prompt: string
  partner: string | null
  text: string
  registry: Registry
}): PromptPlan | null {
  const lanes = detectLanes(text, partner)
  if (!shouldBeWorkspace(lanes, text, partner)) return null

  const projects: ProjectEntry[] = []
  if (lanes.frontend) projects.push(buildWebProject(prompt, partner, text, registry))
  if (lanes.api || lanes.implicitApi) projects.push(buildApiProject(prompt, partner, text, registry))
  if (lanes.worker || lanes.implicitWorker) projects.push(buildWorkerProject(prompt, partner, text))

  projects.push(...collectServiceProjects(lanes, prompt, partner, text, registry))
  projects.push(...collectProtocolProjects(lanes, prompt, partner, text))

  const runtimeCount = [lanes.evm, lanes.solana, lanes.move].filter(Boolean).length
  const primaryProjectId = projects.find((p) => p.id === 'web')?.id ?? projects[0]?.id ?? 'web'

  return {
    kind: 'workspace',
    confidence: runtimeCount > 1 ? 'high' : 'medium',
    reasons: ['multi-lane workspace prompt detected'],
    spec: {
      workspaceName: `${buildSlug(prompt, 'workspace')}-workspace`,
      userPrompt: prompt,
      launchPlan: {
        primaryProjectId,
        primaryArtifact: {
          kind: primaryProjectId === 'web' ? 'preview' : 'service',
          path: primaryProjectId === 'web' ? '/' : '/health',
          targetMs: 2500,
        },
        initialAgentMission:
          "Build the user's prompt on top of this prepared workspace. Start with the primary product surface, then extend the surrounding lanes.",
      },
      projects,
    },
  }
}


export async function planPrompt({
  prompt,
  partner = null,
  forceKind = null,
  familyHint = null,
}: {
  prompt: string
  partner?: string | null
  /** Force the result to be 'starter' or 'workspace'. Used by scaffold-builder for curated templates. */
  forceKind?: 'starter' | 'workspace' | null
  /** Hint the family directly. Skips family scoring, only detects capabilities + slots. */
  familyHint?: string | null
}): Promise<PromptPlan> {
  const text = prompt.toLowerCase()
  const effectivePartner = partner ?? inferPartner(text)
  const registry = await loadRegistry()

  // Skip workspace detection when caller knows this is a single project
  if (forceKind !== 'starter') {
    const workspacePlan = buildWorkspacePromptPlan({ prompt, partner: effectivePartner, text, registry })
    if (workspacePlan) {
      return workspacePlan
    }
  }

  // Use family hint if provided (scaffold-builder knows the family)
  let starterSelection: Awaited<ReturnType<typeof selectStarter>>
  if (familyHint && registry.families.has(familyHint)) {
    const fwLayers: string[] = []
    for (const [key, layer] of registry.layers) {
      if (layer.group === 'framework' && layer.appliesTo?.includes(familyHint)) {
        fwLayers.push(key)
      }
    }
    starterSelection = {
      confidence: 'high',
      spec: {
        projectName: partner ? `${partner}-starter` : 'generated-starter',
        family: familyHint,
        layers: fwLayers,
        partner: effectivePartner,
        slots: {},
        variables: {},
      },
      fallbackUsed: false,
      reasons: [`family hint: ${familyHint}`],
    }
  } else {
    starterSelection = await selectStarter({ prompt, partner: effectivePartner })
  }
  const family = registry.families.get(starterSelection.spec.family)
  const spec: ComposeSpec = {
    ...starterSelection.spec,
    projectName: buildSlug(prompt, starterSelection.spec.projectName),
    primaryArtifactTargetMs: 2500,
    userPrompt: prompt,
  }

  const databaseSlot = detectDatabaseSlot(text)
  const sdkSlot = detectSdkSlot(text, effectivePartner)
  const authSlot = detectAuthSlot(text)
  const paymentsSlot = detectPaymentsSlot(text)
  const queueSlot = detectQueueSlot(text)
  spec.slots = { ...(spec.slots ?? {}) }

  if (databaseSlot && family?.slots?.['database']) spec.slots['database'] = databaseSlot
  if (sdkSlot && family?.slots?.['sdk']) spec.slots['sdk'] = sdkSlot
  if (authSlot && family?.slots?.['auth']) spec.slots['auth'] = authSlot
  if (paymentsSlot && family?.slots?.['payments']) spec.slots['payments'] = paymentsSlot
  if (queueSlot && family?.slots?.['queue']) spec.slots['queue'] = queueSlot

  // Lane overrides DELETED (Gen 9). The tiered keyword scorer in selection.ts
  // handles all family selection. Capability detection from manifests handles
  // layer specialization. No more bypassing the scorer.

  // Detect and attach capability layers based on prompt keywords
  const capabilities = detectCapabilities(text, spec.family, registry)
  if (capabilities.length > 0) {
    spec.layers = [...new Set([...(spec.layers ?? []), ...capabilities])]
  }

  // Design system capabilities (tailwind, shadcn, dashboard-layout) are now detected
  // via capability manifest keywords in detectCapabilities — no special-case logic needed.

  return {
    kind: 'starter',
    confidence: starterSelection.confidence,
    reasons: starterSelection.reasons,
    spec,
  }
}
