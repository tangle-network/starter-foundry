import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const TSX = join(process.cwd(), 'node_modules/.bin/tsx')
const SCRIPT = join(process.cwd(), 'scripts/plan-domain-pack-work.ts')
const BLUEPRINT_AGENT_SCENARIOS = join(
  process.cwd(),
  '../blueprint-agent/scripts/experiments/scenarios',
)

function writeFixture(root: string): void {
  mkdirSync(join(root, 'crypto'), { recursive: true })
  writeFileSync(
    join(root, 'crypto/fhe.ts'),
    `
      export const FHE_SEED = {
        id: 'fhe-suite',
        category: 'crypto',
        partner: 'fhenix',
        scaffoldFamily: 'fhenix-foundry',
        description: 'FHE apps using Fhenix, CoFHE, euint values, private voting, and sealed bids.',
        leaves: [
          {
            id: 'generic-fhe-scheme',
            loadBearingArtifact: 'research',
            description: 'Explain generic fully homomorphic encryption with RLWE ciphertext addition and multiplication.',
            tags: ['fhe', 'homomorphic', 'rlwe'],
          },
          {
            id: 'sealed-bid-auction',
            loadBearingArtifact: 'contract',
            description: 'Build a Fhenix Foundry sealed-bid auction with euint bid storage and FHE.select winner logic.',
            tags: ['fhenix', 'fhe', 'cofhe', 'sealed-bid'],
          },
          {
            id: 'private-voting',
            loadBearingArtifact: 'contract',
            description: 'Build private voting with encrypted ballots, FHE.add aggregation, and FHE.allow permissions.',
            tags: ['fhe', 'private-voting'],
          },
          {
            id: 'confidential-token',
            loadBearingArtifact: 'contract',
            description: 'Build confidential token balances using Zama fhEVM style euint types for held-out coverage.',
            tags: ['zama', 'fhevm', 'confidential-erc20'],
          },
        ],
      }
    `,
  )
  writeFileSync(
    join(root, 'crypto/bridges.ts'),
    `
      export const BRIDGE_SEED = {
        id: 'bridge-suite',
        category: 'crypto',
        partner: 'layerzero',
        description: 'Cross-chain bridge products spanning contracts, omnichain tokens, and UI status flows.',
        leaves: [
          {
            id: 'layerzero-oft-token',
            loadBearingArtifact: 'contract',
            description: 'Build a LayerZero OFT bridge token with sendTokens and omnichain transfer config.',
            tags: ['layerzero', 'oft', 'bridge'],
          },
          {
            id: 'generic-lock-mint-bridge',
            loadBearingArtifact: 'contract',
            description: 'Build a cross-chain bridge with lock and mint, burn and release, and proof verification.',
            tags: ['bridge', 'cross-chain'],
          },
          {
            id: 'bridge-transfer-ui',
            loadBearingArtifact: 'frontend',
            description: 'Build a bridge UI with source chain, destination chain, fee estimation, and transaction history.',
            tags: ['bridge-ui', 'cross-chain'],
          },
        ],
      }

      export const BRIDGE_RELAYER_SEED = {
        id: 'bridge-relayer-suite',
        category: 'crypto',
        partner: 'wormhole',
        description: 'Bridge monitoring and relay surfaces for cross-chain messages.',
        leaves: [
          {
            id: 'bridge-message-indexer',
            loadBearingArtifact: 'backend',
            description: 'Build a bridge transaction monitor that tracks source confirmed, relayed, destination confirmed, and failed states.',
            tags: ['bridge', 'indexer', 'cross-chain'],
          },
          {
            id: 'bridge-relayer-worker',
            loadBearingArtifact: 'worker',
            description: 'Build a bridge relayer worker with proof verification, retry queue, fee estimation, and transaction history.',
            tags: ['bridge', 'relayer', 'proof-verification'],
          },
        ],
      }
    `,
  )
}

test('plan-domain-pack-work emits parallelizable FHE and bridge candidates from scenario evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'sf-domain-pack-scenarios-'))
  try {
    writeFixture(root)
    const result = spawnSync(TSX, [SCRIPT, '--scenarios', root, '--json', '--top', '25'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.ok(report.candidates.length >= 10, 'fixture should emit parallel candidate rows')
    const candidates = new Map<string, any>(
      report.candidates.map((candidate: any) => [candidate.id, candidate]),
    )
    const fhe = candidates.get('fhe-contracts')
    const bridgeContracts = candidates.get('bridge-contracts')
    const bridgeUi = candidates.get('bridge-ui')
    const bridgeIndexer = candidates.get('bridge-indexer')
    const bridgeIndexerEntry = candidates.get('bridge-indexer-capability-bridge-protocol-api')
    const layerZeroEntry = candidates.get('bridge-contracts-capability-evm-layerzero-oft')
    const fhenixFoundryEntry = candidates.get('fhe-contracts-fhenix-foundry')
    const sealedAuctionEntry = candidates.get(
      'fhe-capabilities-capability-fhe-foundry-sealed-auction',
    )

    assert.ok(fhe, 'expected FHE ambiguity-group candidate')
    assert.ok(bridgeContracts, 'expected bridge contract candidate')
    assert.ok(bridgeUi, 'expected bridge UI candidate')
    assert.ok(bridgeIndexer, 'expected bridge indexer/API candidate')
    assert.ok(bridgeIndexerEntry, 'expected bridge indexer/API entry candidate')
    assert.ok(layerZeroEntry, 'expected LayerZero entry candidate from metadata')
    assert.ok(fhenixFoundryEntry, 'expected Fhenix Foundry entry candidate from metadata')
    assert.ok(sealedAuctionEntry, 'expected Fhenix sealed-auction capability candidate')

    assert.deepEqual(fhe.verticalIds, ['fhe-suite'])
    assert.deepEqual(fhe.domain, { family: 'fhe', surface: 'contracts' })
    assert.equal(fhe.intendedStarter.family, 'fhenix-foundry')
    assert.ok(fhe.leafIds.train.length > 0)
    assert.ok(fhe.leafIds.holdout.length > 0)
    assert.ok(fhe.registryFiles.includes('registry/families/fhenix-foundry/manifest.json'))
    assert.ok(fhe.registryFiles.includes('registry/families/fhevm-contracts/manifest.json'))
    assert.ok(fhe.validationCommands.includes('forge build'))
    assert.ok(fhe.authenticitySignals.includes('FHE.select'))

    assert.deepEqual(bridgeContracts.verticalIds, ['bridge-relayer-suite', 'bridge-suite'])
    assert.deepEqual(bridgeContracts.domain, { family: 'bridge', surface: 'contracts' })
    assert.ok(bridgeContracts.leafIds.train.includes('generic-lock-mint-bridge'))
    assert.ok(
      bridgeContracts.registryFiles.includes(
        'registry/layers/capability/evm-layerzero-oft/manifest.json',
      ),
    )
    assert.ok(bridgeContracts.filesToModify.includes('tests/domain-packs.test.ts'))
    assert.deepEqual(layerZeroEntry.domain, {
      family: 'bridge',
      provider: 'layerzero',
      protocol: 'oft',
      runtime: 'foundry',
      surface: 'contracts',
    })
    assert.ok(sealedAuctionEntry.leafIds.train.includes('sealed-bid-auction'))
    assert.ok(
      ![...sealedAuctionEntry.leafIds.train, ...sealedAuctionEntry.leafIds.holdout].includes(
        'generic-fhe-scheme',
      ),
      'capability-specific FHE candidate should not absorb generic same-domain leaves',
    )

    assert.deepEqual(bridgeUi.intendedStarter.family, 'react-vite-ts')
    assert.ok(
      [...bridgeUi.leafIds.train, ...bridgeUi.leafIds.holdout].includes('bridge-transfer-ui'),
    )
    assert.ok(
      bridgeUi.gatesToRun.includes(
        'node --test --test-concurrency=1 dist-tests/domain-packs.test.js dist-tests/coverage.test.js',
      ),
    )
    assert.deepEqual(bridgeIndexer.domain, { family: 'bridge', surface: 'indexer' })
    assert.deepEqual(bridgeIndexer.intendedStarter.family, 'evm-infra-ts')
    assert.ok(bridgeIndexer.leafIds.train.includes('bridge-message-indexer'))
    assert.ok(!bridgeIndexer.leafIds.train.includes('bridge-transfer-ui'))
    assert.deepEqual(bridgeIndexerEntry.registryFiles, [
      'registry/layers/capability/bridge-protocol-api/manifest.json',
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test(
  'plan-domain-pack-work emits at least 10 candidates from the current blueprint-agent corpus',
  { skip: !existsSync(BLUEPRINT_AGENT_SCENARIOS) },
  () => {
    const result = spawnSync(TSX, [SCRIPT, '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    const ids = report.candidates.map((candidate: any) => candidate.id)
    assert.ok(
      report.scenariosScanned >= 300,
      `expected current corpus, got ${report.scenariosScanned}`,
    )
    assert.ok(report.candidates.length >= 10, `expected >=10 candidates, got ${ids.length}`)
    assert.equal(new Set(ids).size, ids.length, 'candidate ids must be unique')
    assert.ok(ids.includes('fhe-contracts-fhenix-foundry'))
    assert.ok(ids.includes('fhe-contracts-fhevm-contracts'))
    assert.ok(ids.includes('bridge-contracts-capability-evm-layerzero-oft'))
    assert.ok(ids.includes('bridge-ui-capability-crypto-bridge-ui'))
    assert.ok(ids.includes('bridge-indexer-capability-bridge-protocol-api'))
    const fhenixFoundry = report.candidates.find(
      (candidate: any) => candidate.id === 'fhe-contracts-fhenix-foundry',
    )
    assert.ok(fhenixFoundry)
    assert.ok(fhenixFoundry.leafIds.train.includes('fhenix-sealed-bid-auction'))
    assert.ok(
      ![...fhenixFoundry.leafIds.train, ...fhenixFoundry.leafIds.holdout].includes(
        'crypto-fhe-bfv',
      ),
      'provider-specific FHE candidates should not absorb generic FHE research leaves',
    )
  },
)
