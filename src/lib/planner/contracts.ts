// Contract + program layer/variable builders.
//
// Given a prompt, chooses:
//   - EVM: forge-foundation vs hardhat-ts, plus add-on capabilities (deploy,
//     LayerZero OFT, ERC-4337) and a concrete contract name.
//   - Solana: solana-native-rust base plus a capability (perps, amm, nft,
//     launchpad, staking, prediction) and a concrete instruction name.
//   - Agent: agent-service-{rust,py,ts} plus the agent library variable.
//
// Pure functions — no I/O, no mutation.

import { hasAny, matchesKeyword } from '../keywords.js'

import { detectEvmDeployPattern, detectHardhatExplicit } from './detectors.js'

interface AgentFamilyChoice {
  family: string
  layers: string[]
  path: string
  variables?: Record<string, string>
}

export function buildEvmContractLayers(text: string): string[] {
  const hardhatExplicit = detectHardhatExplicit(text)
  const layers = [hardhatExplicit ? 'framework:hardhat-ts' : 'framework:forge-foundation']

  if (!hardhatExplicit && detectEvmDeployPattern(text)) {
    layers.push('capability:evm-deploy-foundry')
  }

  if (
    !hardhatExplicit &&
    hasAny(text, [
      'layerzero',
      'oft',
      'bridge tokens',
      'sendtokens script',
      'omnichain fungible token',
    ])
  ) {
    layers.push('capability:evm-layerzero-oft')
  } else if (
    !hardhatExplicit &&
    hasAny(text, [
      'erc-4337',
      'erc4337',
      'bundler',
      'permissionless.js',
      'gasless mint',
      'account abstraction',
    ])
  ) {
    layers.push('capability:evm-account-abstraction')
  }

  return layers
}

export function buildEvmContractVariables(text: string): Record<string, string> {
  if (hasAny(text, ['layerzero', 'oft', 'omnichain fungible token']))
    return { contractName: 'OmnichainToken' }
  if (hasAny(text, ['erc721', 'erc-721', 'nft collection', 'gasless mint']))
    return { contractName: 'GaslessCollectible' }
  if (hasAny(text, ['erc20', 'erc-20', 'sample erc20'])) return { contractName: 'XLayerToken' }
  return { contractName: 'Counter' }
}

export function buildSolanaProgramLayers(text: string): string[] {
  const layers = ['framework:solana-native-rust']

  if (
    hasAny(text, [
      'perpetual',
      'futures',
      'funding rate',
      'liquidation',
      'insurance fund',
      'cross-collateral',
    ])
  ) {
    layers.push('capability:solana-perps')
  } else if (
    hasAny(text, ['concentrated liquidity', 'tick-based liquidity', 'swap router', 'position nft'])
  ) {
    layers.push('capability:solana-amm')
  } else if (
    hasAny(text, ['nft marketplace', 'compressed nfts', 'royalty enforcement', 'bundle sales'])
  ) {
    layers.push('capability:solana-nft')
  } else if (
    hasAny(text, ['launchpad', 'fair launches', 'dutch auction', 'bonding curve', 'claim portal'])
  ) {
    layers.push('capability:solana-launchpad')
  } else if (
    hasAny(text, [
      'staking platform',
      'veToken',
      'rewards dashboard',
      'auto-compound',
      'validator delegation',
    ])
  ) {
    layers.push('capability:solana-staking')
  } else if (
    hasAny(text, [
      'prediction market',
      'binary (yes/no)',
      'switchboard oracle',
      'scalar',
      'categorical',
    ])
  ) {
    layers.push('capability:solana-prediction')
  }

  return layers
}

export function buildSolanaProgramVariables(text: string): Record<string, string> {
  if (hasAny(text, ['perpetual', 'futures'])) return { instructionName: 'InitializePerpMarket' }
  if (hasAny(text, ['concentrated liquidity', 'amm dex', 'swap router']))
    return { instructionName: 'InitializePool' }
  if (hasAny(text, ['nft marketplace', 'compressed nfts']))
    return { instructionName: 'CreateListing' }
  if (hasAny(text, ['launchpad', 'fair launches', 'bonding curve']))
    return { instructionName: 'CreateLaunch' }
  if (hasAny(text, ['staking platform', 'veToken', 'auto-compound']))
    return { instructionName: 'InitializeStakePool' }
  if (hasAny(text, ['prediction market', 'scalar', 'categorical']))
    return { instructionName: 'CreateMarket' }
  return { instructionName: 'InitializeTreasury' }
}

export function chooseAgentFamily(text: string): AgentFamilyChoice {
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
    hasAny(text, [
      'python',
      'fastapi',
      'pydanticai',
      'crewai',
      'autogen',
      'agno',
      'llamaindex',
      'agentkit',
      'python agent',
      'unsloth',
      'qlora',
    ])
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
