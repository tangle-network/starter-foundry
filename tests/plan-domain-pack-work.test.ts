import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const TSX = join(process.cwd(), 'node_modules/.bin/tsx')
const SCRIPT = join(process.cwd(), 'scripts/plan-domain-pack-work.ts')

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
    `,
  )
}

test('plan-domain-pack-work emits parallelizable FHE and bridge candidates from scenario evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'sf-domain-pack-scenarios-'))
  try {
    writeFixture(root)
    const result = spawnSync(TSX, [SCRIPT, '--scenarios', root, '--json', '--top', '10'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    const candidates = new Map<string, any>(
      report.candidates.map((candidate: any) => [candidate.id, candidate]),
    )
    const fhe = candidates.get('fhe-contracts')
    const bridgeContracts = candidates.get('bridge-contracts')
    const bridgeUi = candidates.get('bridge-ui')

    assert.ok(fhe, 'expected FHE ambiguity-group candidate')
    assert.ok(bridgeContracts, 'expected bridge contract candidate')
    assert.ok(bridgeUi, 'expected bridge UI candidate')

    assert.deepEqual(fhe.verticalIds, ['fhe-suite'])
    assert.deepEqual(fhe.domain, { family: 'fhe', surface: 'contracts' })
    assert.equal(fhe.intendedStarter.family, 'fhenix-foundry')
    assert.ok(fhe.leafIds.train.length > 0)
    assert.ok(fhe.leafIds.holdout.length > 0)
    assert.ok(fhe.registryFiles.includes('registry/families/fhenix-foundry/manifest.json'))
    assert.ok(fhe.registryFiles.includes('registry/families/fhevm-contracts/manifest.json'))
    assert.ok(fhe.validationCommands.includes('forge build'))
    assert.ok(fhe.authenticitySignals.includes('FHE.select'))

    assert.deepEqual(bridgeContracts.verticalIds, ['bridge-suite'])
    assert.deepEqual(bridgeContracts.domain, { family: 'bridge', surface: 'contracts' })
    assert.ok(bridgeContracts.leafIds.train.includes('generic-lock-mint-bridge'))
    assert.ok(
      bridgeContracts.registryFiles.includes(
        'registry/layers/capability/evm-layerzero-oft/manifest.json',
      ),
    )
    assert.ok(bridgeContracts.filesToModify.includes('tests/domain-packs.test.ts'))

    assert.deepEqual(bridgeUi.intendedStarter.family, 'react-vite-ts')
    assert.ok(bridgeUi.leafIds.train.includes('bridge-transfer-ui'))
    assert.ok(
      bridgeUi.gatesToRun.includes(
        'node --test --test-concurrency=1 dist-tests/domain-packs.test.js dist-tests/coverage.test.js',
      ),
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
