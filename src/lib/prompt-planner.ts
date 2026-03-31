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
  const specialSingleLane = hasAny(text, [
    'expo',
    'react native',
    'mobile app',
    'ios app',
    'android app',
    'browser extension',
    'chrome extension',
    'manifest v3',
    'electron',
    'desktop app',
    'desktop assistant',
    'command line',
    'terminal tool',
    'streamlit',
    'gradio',
    'data app',
    'tauri',
  ])

  if (specialSingleLane) return null

  const hasFrontend = hasAny(text, ['frontend', 'ui', 'website', 'landing', 'dashboard', 'web app', 'app', 'preview', 'next', 'react'])
  const hasApiRaw = hasAny(text, [
    'api', 'backend', 'server', 'endpoint', 'service', 'webhook', 'health check', 'cloudflare',
    'durable object', 'edge api', 'edge function', 'payment webhook', 'server wallet', 'rest api', 'graphql api',
  ])
  // "Composition API", "Options API" etc. are framework terms, not backend API signals
  const apiIsFalsePositive =
    hasApiRaw &&
    !hasAny(text, ['backend', 'server', 'endpoint', 'webhook', 'rest api', 'graphql api', 'api service', 'api endpoint', 'health check']) &&
    hasAny(text, ['composition api', 'options api', 'signals api', 'context api', 'hooks api'])
  const hasApi = hasApiRaw && !apiIsFalsePositive
  const hasWorkerRaw = hasAny(text, [
    'trading bot', 'background job', 'background worker', 'worker for', 'playwright worker',
    'automation worker', 'go worker', 'golang worker', 'queue', 'cron', 'market stream', 'bot',
  ])
  // When agent lane also fires, "bot" alone shouldn't force a worker project.
  // Only explicit worker-specific terms (background job, cron, worker for) create a worker lane alongside an agent.
  const hasWorker = hasWorkerRaw && (!detectLane(text, 'agent') || hasAny(text, [
    'trading bot', 'background job', 'background worker', 'worker for', 'playwright worker',
    'automation worker', 'go worker', 'golang worker', 'queue', 'cron', 'market stream',
  ]))
  const hasEvm = detectLane(text, 'evm')
  const hasSolana = hasAny(text, ['solana', 'anchor', 'pda'])
  const hasMove = hasAny(text, ['move', 'aptos', 'sui'])
  const hasTangle = detectLane(text, 'tangle')
  const hasAvs = detectLane(text, 'avs')
  const hasStylus = detectLane(text, 'stylus')
  const hasZk = detectLane(text, 'zk')
  const hasMcp = detectLane(text, 'mcp')
  const hasDspy = detectLane(text, 'dspy')
  const hasAgent = detectLane(text, 'agent')
  const hasX402 = detectLane(text, 'x402')
  const hasEvmInfra = detectLane(text, 'evm-infra')
  const plainAgentService =
    hasAgent &&
    !hasFrontend &&
    !hasWorker &&
    !hasEvm &&
    !hasSolana &&
    !hasMove &&
    !hasTangle &&
    !hasAvs &&
    !hasStylus &&
    !hasZk &&
    !hasMcp &&
    !hasDspy &&
    !hasX402 &&
    !hasEvmInfra
  const runtimeCount = [hasEvm, hasSolana, hasMove].filter(Boolean).length
  const apiChoice = hasApi ? chooseApiFamily(text) : null
  // Only trigger implicit API for commerce when strong API keywords are present,
  // not just because a dashboard mentions "portfolio" or "analytics"
  const commerceSupportApi =
    !hasApi &&
    hasFrontend &&
    needsSupportApiLane(text) &&
    (partner === 'coinbase' || detectPaymentsSlot(text) !== null || detectSdkSlot(text, partner) !== null) &&
    hasAny(text, ['api', 'backend', 'server', 'endpoint', 'webhook', 'order management', 'order history', 'payment webhook', 'indexer', 'transaction history'])
  const implicitApi =
    !hasApi &&
    (((hasEvm || hasSolana || hasTangle || hasAvs || hasStylus || hasEvmInfra) &&
      (needsSupportApiLane(text) ||
        detectEvmSupportApiPattern(text) ||
        (hasSolana && detectSolanaProductApiPattern(text)))) ||
      commerceSupportApi)
  const implicitWorker =
    !hasWorker &&
    ((hasSolana && detectSolanaWorkerPattern(text)) ||
      (hasEvm && hasAny(text, ['keeper', 'bundler'])) ||
      (hasX402 && hasAgent))
  const workspaceSignals = hasAny(text, [
    'workspace', 'monorepo', 'separate backend', 'separate api',
    'background worker', 'contract lane', 'contract lanes',
  ])
  const fitsFullstackStarter =
    !workspaceSignals &&
    !hasWorker &&
    !hasEvm &&
    !hasSolana &&
    !hasMove &&
    !hasTangle &&
    !hasAvs &&
    !hasStylus &&
    !hasZk &&
    !hasMcp &&
    !hasDspy &&
    !hasAgent &&
    !hasX402 &&
    !hasEvmInfra &&
    hasFrontend &&
    hasApi &&
    hasAny(text, ['fullstack', 'full stack', 'dashboard with api', 'app with api', 'admin app', 'admin panel', 'database-backed', 'dashboard and api', 'admin flows', 'saas', 'saas app', 'saas platform', 'internal tool', 'back office', 'crud app'])
  const laneCount = [
    hasFrontend, hasApi, hasWorker, hasEvm, hasSolana, hasMove, hasTangle, hasAvs,
    hasStylus, hasZk, hasMcp, hasDspy, hasAgent, hasX402, hasEvmInfra, implicitApi,
  ].filter(Boolean).length
  const needsWorkspace =
    runtimeCount > 1 ||
    (hasFrontend && runtimeCount > 0) ||
    (hasFrontend && hasApi) ||
    (hasWorker && laneCount > 1) ||
    (hasFrontend && (hasTangle || hasAvs || hasStylus || hasZk || hasMcp || hasDspy || hasX402)) ||
    (hasFrontend && hasAgent) ||
    (hasFrontend && hasApi && apiChoice && apiChoice.family !== 'api-service') ||
    (hasFrontend && implicitApi) ||
    (implicitApi && (hasEvm || hasSolana || hasMove || hasTangle || hasAvs || hasStylus)) ||
    implicitWorker ||
    (workspaceSignals && laneCount > 1)
  // Protocol-specific families (AVS, tangle, stylus, zk, mcp, dspy, x402) stay as
  // single-project starters unless explicitly combined with a frontend or worker.
  const plainProtocolProject =
    !hasFrontend &&
    !hasApi &&
    !hasWorkerRaw &&
    !hasAgent &&
    (hasAvs || hasTangle || hasStylus || hasZk || hasMcp || hasDspy || hasX402)

  if (!needsWorkspace || fitsFullstackStarter || plainAgentService || plainProtocolProject) return null

  const projects: ProjectEntry[] = []
  if (hasFrontend) projects.push(buildWebProject(prompt, partner, text, registry))
  if (hasApi || implicitApi) projects.push(buildApiProject(prompt, partner, text, registry))
  if (hasWorker || implicitWorker) projects.push(buildWorkerProject(prompt, partner, text))

  if (hasMcp && !hasApi) {
    projects.push({
      id: 'mcp',
      path: 'apps/mcp',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-mcp`,
        family: 'mcp-server-ts',
        layers: ['framework:mcp-server-ts'],
        partner: null,
        slots: {},
        variables: {},
      },
    })
  }

  if (hasDspy && !hasApi) {
    projects.push({
      id: 'ai',
      path: 'apps/ai',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-ai`,
        family: 'dspy-pipeline-py',
        layers: ['framework:dspy-pipeline-py'],
        partner: null,
        slots: {},
        variables: {},
      },
    })
  }

  if (hasAgent && !projects.some((project) => project.id === 'agent')) {
    projects.push(buildApiProject(prompt, partner, text, registry))
  }

  if (hasX402 && !hasApi) {
    projects.push({
      id: 'api',
      path: 'apps/api',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-api`,
        family: 'x402-service',
        layers: ['framework:x402-service'],
        partner: resolvePartnerForFamily(partner, 'x402-service'),
        slots: {},
        variables: {},
        primaryArtifactTargetMs: 2500,
      },
    })
  }

  if (hasTangle) {
    const tangleLayers = ['framework:tangle-blueprint']
    if (detectTangleCustodyPattern(text)) tangleLayers.push('capability:tangle-custody')
    else if (detectTangleOraclePattern(text)) tangleLayers.push('capability:tangle-oracle')

    const blueprintProfile = text.includes('custody')
      ? { blueprintName: 'custody-blueprint', jobName: 'ApproveTransaction' }
      : text.includes('oracle')
        ? { blueprintName: 'oracle-blueprint', jobName: 'UpdatePriceFeed' }
        : text.includes('zk')
          ? { blueprintName: 'zk-prover-blueprint', jobName: 'GenerateProof' }
          : { blueprintName: 'storage-blueprint', jobName: 'StoreObject' }

    projects.push({
      id: 'tangle',
      path: 'protocols/tangle',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-tangle`,
        family: 'tangle-blueprint',
        layers: tangleLayers,
        partner: resolvePartnerForFamily(partner, 'tangle-blueprint'),
        slots: {},
        variables: blueprintProfile,
      },
    })
  }

  if (hasAvs) {
    const avsName = text.includes('oracle')
      ? 'oracle-avs'
      : text.includes('keeper')
        ? 'keeper-avs'
        : text.includes('sequencer')
          ? 'sequencer-avs'
          : text.includes('bridge')
            ? 'bridge-avs'
            : 'data-availability-avs'

    projects.push({
      id: 'avs',
      path: 'protocols/avs',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-avs`,
        family: 'eigenlayer-avs',
        layers: ['framework:eigenlayer-avs'],
        partner: resolvePartnerForFamily(partner, 'eigenlayer-avs'),
        slots: {},
        variables: { avsName },
      },
    })
  }

  if (hasStylus) {
    projects.push({
      id: 'stylus',
      path: 'contracts/stylus',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-stylus`,
        family: 'stylus-contracts',
        layers: ['framework:stylus-contracts'],
        partner: resolvePartnerForFamily(partner, 'stylus-contracts'),
        slots: {},
        variables: { contractName: 'StylusPool' },
      },
    })
  }

  if (hasZk && !hasApi) {
    projects.push({
      id: 'zk',
      path: 'apps/prover',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-zk`,
        family: 'zk-prover-service',
        layers: ['framework:zk-prover-service'],
        partner: null,
        slots: {},
        variables: {
          proofSystem: text.includes('circom')
            ? 'circom'
            : text.includes('fhenix')
              ? 'fhenix'
              : text.includes('risc zero')
                ? 'risc-zero'
                : 'sp1',
        },
      },
    })
  }

  if (hasEvm) {
    projects.push({
      id: 'evm',
      path: 'contracts/evm',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-evm`,
        family: detectHardhatExplicit(text) ? 'hardhat-contracts' : 'forge-contracts',
        layers: buildEvmContractLayers(text),
        partner: resolvePartnerForFamily(
          partner,
          detectHardhatExplicit(text) ? 'hardhat-contracts' : 'forge-contracts',
        ),
        slots: {},
        variables: buildEvmContractVariables(text),
      },
    })
  }

  if (hasSolana) {
    projects.push({
      id: 'solana',
      path: 'contracts/solana',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-solana`,
        family: 'solana-program',
        layers: buildSolanaProgramLayers(text),
        partner: resolvePartnerForFamily(partner, 'solana-program'),
        slots: {},
        variables: buildSolanaProgramVariables(text),
      },
    })
  }

  if (hasMove) {
    projects.push({
      id: 'move',
      path: 'contracts/move',
      spec: {
        projectName: 'move_treasury',
        family: 'move-contracts',
        layers: ['framework:move-package'],
        partner: null,
        slots: {},
        variables: { moduleName: 'TreasuryVault' },
      },
    })
  }

  const primaryProjectId = projects.find((project) => project.id === 'web')?.id ?? projects[0]?.id ?? 'web'

  const spec: WorkspaceSpec = {
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
  }

  return {
    kind: 'workspace',
    confidence: runtimeCount > 1 ? 'high' : 'medium',
    reasons: ['multi-lane workspace prompt detected'],
    spec,
  }
}

export async function planPrompt({
  prompt,
  partner = null,
}: {
  prompt: string
  partner?: string | null
}): Promise<PromptPlan> {
  const text = prompt.toLowerCase()
  const effectivePartner = partner ?? inferPartner(text)
  const registry = await loadRegistry()
  const workspacePlan = buildWorkspacePromptPlan({ prompt, partner: effectivePartner, text, registry })

  if (workspacePlan) {
    return workspacePlan
  }

  const starterSelection = await selectStarter({ prompt, partner: effectivePartner })
  const family = registry.families.get(starterSelection.spec.family)
  const spec: ComposeSpec = {
    ...starterSelection.spec,
    projectName: buildSlug(prompt, starterSelection.spec.projectName),
    primaryArtifactTargetMs: 2500,
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

  if (detectLane(text, 'tangle')) {
    spec.family = 'tangle-blueprint'
    spec.layers = ['framework:tangle-blueprint']
    if (detectTangleCustodyPattern(text)) spec.layers.push('capability:tangle-custody')
    else if (detectTangleOraclePattern(text)) spec.layers.push('capability:tangle-oracle')
  }

  if (detectLane(text, 'avs')) {
    spec.family = 'eigenlayer-avs'
    spec.layers = ['framework:eigenlayer-avs']
  }

  if (detectLane(text, 'stylus')) {
    spec.family = 'stylus-contracts'
    spec.layers = ['framework:stylus-contracts']
  }

  if (detectLane(text, 'zk')) {
    spec.family = 'zk-prover-service'
    spec.layers = ['framework:zk-prover-service']
    spec.variables = {
      ...(spec.variables ?? {}),
      proofSystem: text.includes('circom')
        ? 'circom'
        : text.includes('fhenix')
          ? 'fhenix'
          : text.includes('risc zero')
            ? 'risc-zero'
            : 'sp1',
    }
  }

  if (detectLane(text, 'mcp')) {
    spec.family = 'mcp-server-ts'
    spec.layers = ['framework:mcp-server-ts']
  }

  if (detectLane(text, 'dspy')) {
    spec.family = 'dspy-pipeline-py'
    spec.layers = ['framework:dspy-pipeline-py']
  }

  if (detectLane(text, 'x402')) {
    spec.family = 'x402-service'
    spec.layers = ['framework:x402-service']
  }

  if (
    detectEvmDeployPattern(text) &&
    hasAny(text, ['foundry', 'forge', 'hardhat', 'solidity', 'erc20', 'erc721', 'layerzero'])
  ) {
    spec.family = detectHardhatExplicit(text) ? 'hardhat-contracts' : 'forge-contracts'
    spec.layers = buildEvmContractLayers(text)
    spec.variables = { ...(spec.variables ?? {}), ...buildEvmContractVariables(text) }
  }

  if (spec.family === 'forge-contracts' || spec.family === 'hardhat-contracts') {
    spec.layers = buildEvmContractLayers(text)
    spec.variables = { ...(spec.variables ?? {}), ...buildEvmContractVariables(text) }
  }

  if (detectLane(text, 'agent')) {
    const choice = chooseAgentFamily(text)
    spec.family = choice.family
    spec.layers = choice.layers
    spec.variables = { ...(spec.variables ?? {}), ...(choice.variables ?? {}) }
  }

  if (spec.family === 'solana-program') {
    spec.layers = buildSolanaProgramLayers(text)
    spec.variables = { ...(spec.variables ?? {}), ...buildSolanaProgramVariables(text) }
  }

  if (spec.family === 'evm-infra-ts') {
    if (hasAny(text, ['block monitor', 'new blocks', 'gas price', 'tps', '/stats'])) {
      spec.layers = [...new Set([...(spec.layers ?? []), 'capability:evm-chain-monitor'])]
    } else if (hasAny(text, ['wallet balance', 'wallet address', 'multicall', 'summary table'])) {
      spec.layers = [...new Set([...(spec.layers ?? []), 'capability:evm-wallet-dashboard'])]
    }
  }

  if (hasAny(text, ['rust', 'cargo']) && spec.family === 'api-service') {
    spec.family = 'rust-service'
    spec.layers = ['framework:rust-http']
  }

  // Detect and attach capability layers based on prompt keywords
  const capabilities = detectCapabilities(text, spec.family, registry)
  if (capabilities.length > 0) {
    spec.layers = [...new Set([...(spec.layers ?? []), ...capabilities])]
  }

  // Auto-attach design system capabilities for frontend families when
  // the prompt signals professional quality or mentions design patterns
  const frontendFamilies = new Set([
    'react-vite-ts', 'nextjs-ts', 'fullstack-ts', 'sveltekit-ts',
    'remix-ts', 'vue-ts', 'angular-ts', 'frontend-static',
    'electron-desktop-ts', 'tauri-desktop',
  ])
  if (frontendFamilies.has(spec.family)) {
    const hasTailwindSignal = hasAny(text, [
      'tailwind', 'shadcn', 'design system', 'professional', 'production-ready',
      'polished', 'styled', 'dark mode', 'responsive design',
    ])
    const hasDashboardSignal = hasAny(text, [
      'dashboard', 'admin', 'sidebar', 'navigation',
    ])
    const currentLayers = new Set(spec.layers ?? [])
    if (hasTailwindSignal && !currentLayers.has('capability:tailwind')) {
      spec.layers = [...(spec.layers ?? []), 'capability:tailwind']
    }
    if (hasTailwindSignal && !currentLayers.has('capability:shadcn') && hasAny(text, ['shadcn', 'component library', 'radix', 'design system'])) {
      spec.layers = [...(spec.layers ?? []), 'capability:shadcn']
    }
    if (hasDashboardSignal && !currentLayers.has('capability:dashboard-layout')) {
      spec.layers = [...(spec.layers ?? []), 'capability:dashboard-layout']
    }
    spec.layers = [...new Set(spec.layers)]
  }

  return {
    kind: 'starter',
    confidence: starterSelection.confidence,
    reasons: starterSelection.reasons,
    spec,
  }
}
