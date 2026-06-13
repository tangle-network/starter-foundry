import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const REPO = realpathSync(process.cwd())
const CLI = join(REPO, 'dist/cli.js')

function compose(spec: Record<string, unknown>): {
  outDir: string
  agents: string
  claude: string
  llms: string
  report: Record<string, any>
  cleanup: () => void
} {
  const outDir = realpathSync(mkdtempSync(join(tmpdir(), 'domain-pack-context-')))
  const specPath = join(outDir, '_spec.json')
  writeFileSync(specPath, JSON.stringify(spec, null, 2))

  const result = spawnSync(
    'node',
    [CLI, 'compose', '--spec', specPath, '--out', outDir, '--json'],
    {
      cwd: REPO,
      encoding: 'utf8',
    },
  )
  assert.equal(result.status, 0, result.stderr || result.stdout)

  return {
    outDir,
    agents: readFileSync(join(outDir, 'AGENTS.md'), 'utf8'),
    claude: readFileSync(join(outDir, 'CLAUDE.md'), 'utf8'),
    llms: readFileSync(join(outDir, 'llms.txt'), 'utf8'),
    report: JSON.parse(
      readFileSync(join(outDir, '.starter-foundry', 'compose-report.json'), 'utf8'),
    ),
    cleanup: () => rmSync(outDir, { recursive: true, force: true }),
  }
}

function createContextPack(spec: Record<string, unknown>): {
  outDir: string
  contextPack: Record<string, any>
  cleanup: () => void
} {
  const outDir = realpathSync(mkdtempSync(join(tmpdir(), 'domain-pack-context-pack-')))
  const specPath = join(outDir, '_spec.json')
  writeFileSync(specPath, JSON.stringify(spec, null, 2))

  const result = spawnSync(
    'node',
    [CLI, 'context', '--spec', specPath, '--out', outDir, '--json'],
    {
      cwd: REPO,
      encoding: 'utf8',
    },
  )
  assert.equal(result.status, 0, result.stderr || result.stdout)

  return {
    outDir,
    contextPack: JSON.parse(
      readFileSync(join(outDir, '.starter-foundry', 'context-pack.json'), 'utf8'),
    ),
    cleanup: () => rmSync(outDir, { recursive: true, force: true }),
  }
}

test('FHE domain packs emit manifest-derived agent context', () => {
  const { agents, claude, llms, report, cleanup } = compose({
    projectName: 'fhe-context-probe',
    family: 'fhenix-foundry',
    layers: [],
    userPrompt: 'Build a Fhenix Foundry sealed-bid auction contract with CoFHE encrypted bids',
  })

  try {
    assert.equal(agents, claude)
    assert.match(agents, /## Domain pack contract/)
    assert.match(agents, /### fhenix-foundry/)
    assert.match(
      agents,
      /family=fhe, provider=fhenix, protocol=cofhe, runtime=foundry, surface=contracts/,
    )
    assert.match(agents, /`src\/FHEVault\.sol`/)
    assert.match(agents, /`FHE\.asEuint`/)
    assert.match(agents, /`FHE\.allow`/)
    assert.match(agents, /`cofhejs`/)
    assert.match(agents, /`forge build`/)
    assert.match(llms, /## Domain Pack Contract/)
    assert.match(llms, /Required signals\/APIs: .*FHE\.asEuint/)
    assert.equal(report.domainPackGuidance.length, 1)
    assert.equal(report.domainPackGuidance[0].domain.family, 'fhe')
    assert.ok(report.domainPackGuidance[0].authenticitySignals.includes('FHE.asEuint'))
  } finally {
    cleanup()
  }
})

test('context command exposes domain-pack guidance as machine-readable context', () => {
  const { contextPack, cleanup } = createContextPack({
    projectName: 'fhe-context-pack-probe',
    family: 'fhenix-foundry',
    layers: [],
    userPrompt: 'Build a Fhenix Foundry sealed-bid auction contract with CoFHE encrypted bids',
  })

  try {
    assert.equal(contextPack.domainPackGuidance.length, 1)
    assert.equal(contextPack.domainPackGuidance[0].source, 'fhenix-foundry')
    assert.equal(contextPack.domainPackGuidance[0].domain.family, 'fhe')
    assert.ok(contextPack.domainPackGuidance[0].validationCommands.includes('forge build'))
    assert.ok(contextPack.domainPackGuidance[0].authenticitySignals.includes('FHE.asEuint'))
  } finally {
    cleanup()
  }
})

test('bridge contract domain packs distinguish protocol and contract surface', () => {
  const { agents, report, cleanup } = compose({
    projectName: 'bridge-contract-context-probe',
    family: 'forge-contracts',
    layers: ['framework:forge-foundation', 'capability:evm-layerzero-oft'],
    variables: { contractName: 'BridgeToken' },
    userPrompt: 'Build a LayerZero OFT bridge token with Foundry',
  })

  try {
    assert.match(agents, /## Domain pack contract/)
    assert.match(agents, /### capability:evm-layerzero-oft/)
    assert.match(
      agents,
      /family=bridge, provider=layerzero, protocol=oft, runtime=foundry, surface=contracts/,
    )
    assert.match(agents, /`src\/BridgeToken\.sol`/)
    assert.match(agents, /`script\/SendTokens\.s\.sol`/)
    assert.match(agents, /`LayerZero`/)
    assert.match(agents, /`sendTokens`/)
    assert.match(agents, /`forge test`/)
    assert.ok(
      report.domainPackGuidance.some(
        (item: any) => item.domain.family === 'bridge' && item.domain.surface === 'contracts',
      ),
    )
  } finally {
    cleanup()
  }
})

test('bridge UI domain packs distinguish UI surface and component extension points', () => {
  const { agents, report, cleanup } = compose({
    projectName: 'bridge-ui-context-probe',
    family: 'react-vite-ts',
    layers: ['framework:react-vite-ts', 'capability:crypto-bridge-ui'],
    userPrompt: 'Build a cross-chain bridge transfer UI with Wormhole',
  })

  try {
    assert.match(agents, /## Domain pack contract/)
    assert.match(agents, /### capability:crypto-bridge-ui/)
    assert.match(agents, /family=bridge, surface=ui/)
    assert.match(agents, /`bridge-ui`/)
    assert.match(agents, /`source chain`/)
    assert.match(agents, /`transaction history`/)
    assert.match(agents, /`src\/components\/crypto\/bridge-card\.tsx`/)
    assert.match(agents, /`src\/components\/crypto\/bridge-history\.tsx`/)
    assert.ok(
      report.domainPackGuidance.some(
        (item: any) => item.domain.family === 'bridge' && item.domain.surface === 'ui',
      ),
    )
  } finally {
    cleanup()
  }
})
