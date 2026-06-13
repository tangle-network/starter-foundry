import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { composeStarter } from '../dist/lib/compose.js'
import { loadRegistry, resolveComponents } from '../dist/lib/registry.js'
import { selectStarter } from '../dist/lib/selection.js'
import type { ComposeSpec } from '../dist/types.js'

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix))
}

test('FHE capability metadata is runtime/provider explicit', async () => {
  const registry = await loadRegistry()

  const fhenixHardhat = registry.layers.get('capability:fhe-sealed-auction')
  const fhenixFoundry = registry.layers.get('capability:fhe-foundry-sealed-auction')
  const fhevm = registry.layers.get('capability:fhevm-sealed-auction')

  assert.deepEqual(fhenixHardhat?.appliesTo, ['fhenix-contracts'])
  assert.equal(fhenixHardhat?.domainPack?.domain.provider, 'fhenix')
  assert.equal(fhenixHardhat?.domainPack?.domain.runtime, 'hardhat')

  assert.deepEqual(fhenixFoundry?.appliesTo, ['fhenix-foundry'])
  assert.equal(fhenixFoundry?.domainPack?.domain.provider, 'fhenix')
  assert.equal(fhenixFoundry?.domainPack?.domain.runtime, 'foundry')

  assert.deepEqual(fhevm?.appliesTo, ['fhevm-contracts'])
  assert.equal(fhevm?.domainPack?.domain.provider, 'zama')
  assert.equal(fhevm?.domainPack?.domain.protocol, 'fhevm')
  assert.equal(fhevm?.domainPack?.domain.runtime, 'hardhat')
})

test('incompatible FHE capability layers fail at compose resolution', async () => {
  await assert.rejects(
    () =>
      resolveComponents({
        projectName: 'bad-fhenix-foundry-layer',
        family: 'fhenix-foundry',
        layers: ['capability:fhe-sealed-auction'],
      }),
    /not compatible with family fhenix-foundry/,
  )

  await assert.rejects(
    () =>
      resolveComponents({
        projectName: 'bad-fhevm-layer',
        family: 'fhevm-contracts',
        layers: ['capability:fhe-sealed-auction'],
      }),
    /not compatible with family fhevm-contracts/,
  )
})

test('domain-pack selector attaches Fhenix Foundry FHE capability variants', async () => {
  const selected = await selectStarter({
    prompt: 'Build a Fhenix Foundry sealed-bid auction contract with CoFHE encrypted bids',
    partner: null,
  })

  assert.equal(selected.routingRisk, 'safe')
  assert.equal(selected.spec.family, 'fhenix-foundry')
  assert.ok(selected.spec.layers?.includes('framework:fhenix-foundry'))
  assert.ok(selected.spec.layers?.includes('capability:fhe-foundry-sealed-auction'))
})

test('domain-pack selector attaches Zama fhEVM capability variants', async () => {
  const selected = await selectStarter({
    prompt: 'Build a Zama fhEVM private voting contract with encrypted secret ballots',
    partner: null,
  })

  assert.equal(selected.routingRisk, 'safe')
  assert.equal(selected.spec.family, 'fhevm-contracts')
  assert.ok(selected.spec.layers?.includes('framework:fhevm-contracts'))
  assert.ok(selected.spec.layers?.includes('capability:fhevm-private-voting'))
})

test('Fhenix Foundry FHE capability composes into src and builds when forge is available', async (t) => {
  const outDir = tempDir('sf-fhe-foundry-cap-')
  try {
    const spec: ComposeSpec = {
      projectName: 'fhe-foundry-capability',
      family: 'fhenix-foundry',
      layers: ['capability:fhe-foundry-sealed-auction'],
      variables: { contractName: 'FHEVault' },
      userPrompt: 'Build a Fhenix Foundry sealed-bid auction contract with CoFHE encrypted bids',
    }
    await composeStarter({ spec, outDir })

    const source = readFileSync(join(outDir, 'src/SealedAuction.sol'), 'utf8')
    assert.match(source, /@fhenixprotocol\/cofhe-contracts\/FHE\.sol/)
    assert.match(source, /FHE\.select/)
    assert.equal(existsSync(join(outDir, 'contracts/SealedAuction.sol')), false)

    const probe = spawnSync('forge', ['--version'], { encoding: 'utf8' })
    if (probe.status !== 0) {
      t.skip('forge is not installed in this environment')
      return
    }

    const build = spawnSync('forge', ['build'], {
      cwd: outDir,
      encoding: 'utf8',
      timeout: 120_000,
    })
    assert.equal(build.status, 0, build.stderr || build.stdout)
  } finally {
    rmSync(outDir, { recursive: true, force: true })
  }
})

test('Zama fhEVM FHE capability composes into contracts with fhEVM imports', async () => {
  const outDir = tempDir('sf-fhevm-cap-')
  try {
    const spec: ComposeSpec = {
      projectName: 'fhevm-capability',
      family: 'fhevm-contracts',
      layers: ['capability:fhevm-private-voting'],
      userPrompt: 'Build a Zama fhEVM private voting contract with encrypted secret ballots',
    }
    await composeStarter({ spec, outDir })

    const source = readFileSync(join(outDir, 'contracts/PrivateVoting.sol'), 'utf8')
    assert.match(source, /@fhevm\/solidity\/lib\/FHE\.sol/)
    assert.match(source, /ZamaEthereumConfig/)
    assert.match(source, /FHE\.fromExternal/)
    assert.equal(existsSync(join(outDir, 'src/PrivateVoting.sol')), false)
  } finally {
    rmSync(outDir, { recursive: true, force: true })
  }
})
