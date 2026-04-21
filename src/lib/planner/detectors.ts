// Slot + pattern detectors used by the planner. Pure string → string|null|boolean.
// No I/O, no mutation — every function takes a lowercased prompt and returns a
// verdict. Split out of prompt-planner.ts so the main routing file stays focused
// on the pipeline instead of keyword matchers.

import { hasAny } from '../keywords.js'

export function detectDatabaseSlot(text: string): string | null {
  if (text.includes('convex')) return 'database:convex'
  if (text.includes('postgres')) return 'database:postgres'
  if (text.includes('mongodb') || text.includes('mongo')) return 'database:mongodb'
  if (text.includes('sqlite')) return 'database:sqlite'
  return null
}

export function detectSdkSlot(text: string, partner: string | null): string | null {
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

export function detectAuthSlot(text: string): string | null {
  if (text.includes('clerk')) return 'auth:clerk'
  if (text.includes('better auth') || text.includes('better-auth')) return 'auth:better-auth'
  if (text.includes('supabase auth') || text.includes('supabase-auth')) return 'auth:supabase-auth'
  return null
}

export function detectPaymentsSlot(text: string): string | null {
  if (text.includes('coinbase commerce')) return 'payments:coinbase-commerce'
  if (text.includes('stripe') || text.includes('subscription') || text.includes('billing') || text.includes('checkout')) {
    return 'payments:stripe'
  }
  return null
}


export function detectQueueSlot(text: string): string | null {
  if (text.includes('trigger.dev') || text.includes('trigger dev')) return 'queue:trigger-dev'
  if (text.includes('bullmq') || text.includes('queue') || text.includes('background job')) return 'queue:bullmq'
  return null
}

export function detectTangleOraclePattern(text: string): boolean {
  return (
    hasAny(text, ['tangle', 'tangle network', 'tangle native']) &&
    hasAny(text, ['oracle', 'price feed', 'attestation', 'feeder', 'operator rewards', 'slashing', 'data source'])
  )
}

export function detectTangleCustodyPattern(text: string): boolean {
  return (
    hasAny(text, ['tangle', 'tangle network', 'tangle native', 'frost']) &&
    hasAny(text, ['custody', 'mpc', 'threshold signing', 'key resharing', 'policy engine', 'signing ceremony'])
  )
}

export function detectEvmDeployPattern(text: string): boolean {
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

export function detectHardhatExplicit(text: string): boolean {
  return text.includes('hardhat') && !hasAny(text, ['foundry', 'forge'])
}

export function detectEvmSupportApiPattern(text: string): boolean {
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

export function inferPartner(text: string): string | null {
  if (hasAny(text, ['coinbase', 'base network', 'coinbase commerce', 'coinbase wallet', 'coinbase cdp'])) {
    return 'coinbase'
  }
  if (hasAny(text, ['tangle', 'blueprint sdk', 'cargo tangle'])) return 'tangle'
  if (hasAny(text, ['eigenlayer', 'avs'])) return 'eigenlayer'
  if (hasAny(text, ['x layer', 'xlayer', 'okb', 'oklink', 'okx'])) return 'xlayer'
  if (hasAny(text, ['arbitrum', 'stylus'])) return 'arbitrum'
  if (hasAny(text, ['solana', 'anchor', 'pda', 'wallet adapter'])) return 'solana'
  if (hasAny(text, ['chainlink', 'price feed', 'vrf', 'ccip', 'data feeds'])) return 'chainlink'
  if (hasAny(text, ['sui', 'mysten', 'zklogin', 'sponsored transaction'])) return 'sui'
  if (hasAny(text, ['tempo', 'tempo l1', 'tempo chain', 'tempo payments'])) return 'tempo'
  if (hasAny(text, ['monad', 'monad chain', 'parallel evm'])) return 'monad'
  if (hasAny(text, ['sei', 'sei v2', 'sei evm', 'sei network'])) return 'sei-evm'
  if (hasAny(text, ['avalanche', 'avax', 'c-chain', 'c chain', 'subnet', 'teleporter'])) return 'avalanche'
  if (hasAny(text, ['linea', 'consensys zkevm', 'linea mainnet'])) return 'linea'
  if (hasAny(text, ['polygon', 'matic', 'polygon zkevm', 'agglayer', 'polygon pos'])) return 'polygon'
  if (hasAny(text, ['hyperliquid', 'hyperevm', 'hype', 'perp dex'])) return 'hyperliquid'
  if (hasAny(text, ['usdc', 'circle usdc', 'cctp', 'circle api'])) return 'usdc-circle'
  if (hasAny(text, ['usdt', 'tether', 'trc-20', 'trc20'])) return 'tether'
  if (hasAny(text, ['lens protocol', 'lens chain', 'lens profile', 'lens feed'])) return 'lens'
  if (hasAny(text, ['farcaster', 'warpcast', 'frames v2', 'frame sdk', 'neynar', 'mini app'])) return 'farcaster'
  return null
}

export function needsSupportApiLane(text: string): boolean {
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

export function detectSolanaProductApiPattern(text: string): boolean {
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

export function detectSolanaWorkerPattern(text: string): boolean {
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
