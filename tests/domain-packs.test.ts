import assert from 'node:assert/strict'
import test from 'node:test'

import {
  detectDomainPackAmbiguity,
  listDomainPackEntries,
  scoreDomainPackFamilies,
} from '../dist/lib/domain-packs.js'
import { selectStarter } from '../dist/lib/selection.js'
import { loadRegistry } from '../dist/lib/registry.js'

test('domain-pack registry exposes FHE and bridge proof packs as metadata', async () => {
  const registry = await loadRegistry()
  const entries = listDomainPackEntries(registry)
  const owners = new Set(entries.map((entry) => entry.ownerId))

  assert.ok(owners.has('fhenix-foundry'))
  assert.ok(owners.has('fhenix-contracts'))
  assert.ok(owners.has('fhevm-contracts'))
  assert.ok(owners.has('capability:evm-layerzero-oft'))
  assert.ok(owners.has('capability:defi-bridge'))
  assert.ok(owners.has('capability:crypto-bridge-ui'))
  assert.ok(owners.has('capability:bridge-protocol-api'))
})

test('domain-pack scorer disambiguates Fhenix Foundry from Fhenix Hardhat', async () => {
  const registry = await loadRegistry()
  const foundryMatches = scoreDomainPackFamilies({
    prompt: 'Build a Fhenix Foundry sealed-bid auction contract with CoFHE encrypted bids',
    partner: null,
    registry,
  })
  assert.equal(foundryMatches[0]?.family, 'fhenix-foundry')
  assert.match(foundryMatches[0]?.reasons.join(' '), /runtime:foundry/)

  const hardhatMatches = scoreDomainPackFamilies({
    prompt: 'Build a Fhenix Hardhat encrypted counter using cofhejs',
    partner: null,
    registry,
  })
  assert.equal(hardhatMatches[0]?.family, 'fhenix-contracts')
  assert.match(hardhatMatches[0]?.reasons.join(' '), /runtime:hardhat/)
})

test('selectStarter uses domain-pack metadata for Fhenix runtime disambiguation', async () => {
  const foundry = await selectStarter({
    prompt: 'Build a Fhenix Foundry sealed-bid auction contract with CoFHE encrypted bids',
    partner: null,
  })
  assert.equal(foundry.routingRisk, 'safe')
  assert.equal(foundry.spec.family, 'fhenix-foundry')

  const hardhat = await selectStarter({
    prompt: 'Build a Fhenix Hardhat encrypted counter using cofhejs',
    partner: null,
  })
  assert.equal(hardhat.routingRisk, 'safe')
  assert.equal(hardhat.spec.family, 'fhenix-contracts')
})

test('domain-pack scorer routes Zama fhEVM to the Zama family', async () => {
  const result = await selectStarter({
    prompt: 'Build a Zama fhEVM confidential ERC20 contract',
    partner: null,
  })

  assert.equal(result.routingRisk, 'safe')
  assert.equal(result.spec.family, 'fhevm-contracts')
})

test('layer domain-pack metadata routes bridge UI prompts to a frontend starter', async () => {
  const result = await selectStarter({
    prompt: 'Build a cross-chain bridge transfer UI with Wormhole',
    partner: null,
  })

  assert.equal(result.routingRisk, 'safe')
  assert.equal(result.spec.family, 'react-vite-ts')
  assert.ok(result.spec.layers?.includes('framework:react-vite-ts'))
  assert.ok(result.spec.layers?.includes('capability:crypto-bridge-ui'))
})

test('layer domain-pack metadata keeps LayerZero OFT prompts on the contract starter', async () => {
  const result = await selectStarter({
    prompt: 'Build a LayerZero OFT bridge token with Foundry',
    partner: null,
  })

  assert.equal(result.routingRisk, 'safe')
  assert.equal(result.spec.family, 'forge-contracts')
  assert.ok(result.spec.layers?.includes('framework:forge-foundation'))
  assert.ok(result.spec.layers?.includes('capability:evm-layerzero-oft'))
})

test('layer domain-pack metadata routes bridge indexer prompts to an EVM infra starter', async () => {
  const result = await selectStarter({
    prompt:
      'Build a bridge transaction monitor API that indexes source confirmed, relayed, destination confirmed, and failed states',
    partner: null,
  })

  assert.equal(result.routingRisk, 'safe')
  assert.equal(result.spec.family, 'evm-infra-ts')
  assert.ok(result.spec.layers?.includes('framework:evm-infra-ts'))
  assert.ok(result.spec.layers?.includes('capability:bridge-protocol-api'))
})

test('generic FHE prompts are surfaced as ambiguous instead of arbitrary provider choice', async () => {
  const registry = await loadRegistry()
  const matches = scoreDomainPackFamilies({
    prompt: 'Build an encrypted voting contract with private ballots using FHE types',
    partner: null,
    registry,
  })
  const ambiguity = detectDomainPackAmbiguity(matches)

  assert.equal(ambiguity?.group, 'fhe-contracts')
  assert.ok(ambiguity?.families.includes('fhenix-foundry'))
  assert.ok(ambiguity?.families.includes('fhenix-contracts'))

  const selected = await selectStarter({
    prompt: 'Build an encrypted voting contract with private ballots using FHE types',
    partner: null,
  })
  assert.equal(selected.routingRisk, 'ambiguous')
  assert.match(selected.reasons.join(' '), /fhe-contracts/)
})
