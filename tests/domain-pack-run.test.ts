import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const TSX = join(process.cwd(), 'node_modules/.bin/tsx')
const SCRIPT = join(process.cwd(), 'scripts/domain-pack-run.ts')

function writeCandidates(path: string): void {
  writeFileSync(
    path,
    JSON.stringify(
      {
        candidates: [
          candidate({
            id: 'bridge-contracts',
            domain: { family: 'bridge', surface: 'contracts' },
            ambiguityGroup: 'bridge-contracts',
            train: ['bridge-contract-a', 'bridge-contract-b', 'bridge-contract-c'],
            holdout: ['bridge-contract-h'],
            family: 'forge-contracts',
            layers: ['framework:forge-foundation'],
            capabilities: ['capability:evm-layerzero-oft'],
            registryFiles: ['registry/layers/capability/evm-layerzero-oft/manifest.json'],
          }),
          candidate({
            id: 'bridge-contracts-layerzero-omnichain',
            domain: {
              family: 'bridge',
              provider: 'layerzero',
              protocol: 'oft',
              runtime: 'foundry',
              surface: 'contracts',
            },
            ambiguityGroup: 'bridge-contracts',
            train: ['layerzero-a', 'layerzero-b'],
            holdout: ['layerzero-h'],
            family: 'forge-contracts',
            layers: ['framework:forge-foundation'],
            capabilities: ['capability:evm-layerzero-oft'],
            registryFiles: ['registry/layers/capability/evm-layerzero-oft/manifest.json'],
            prompts: ['Build a LayerZero OFT bridge token with Foundry'],
            validationCommands: ['forge build'],
          }),
          candidate({
            id: 'bridge-ui',
            domain: { family: 'bridge', surface: 'ui' },
            ambiguityGroup: 'bridge-ui',
            train: ['bridge-ui-a', 'bridge-ui-b'],
            holdout: ['bridge-ui-h'],
            family: 'react-vite-ts',
            layers: ['framework:react-vite-ts', 'capability:crypto-bridge-ui'],
            capabilities: ['capability:crypto-bridge-ui'],
            registryFiles: ['registry/layers/capability/crypto-bridge-ui/manifest.json'],
            prompts: ['Build a cross-chain bridge transfer UI with Wormhole'],
          }),
          candidate({
            id: 'fhe-contracts-fhenix-foundry',
            domain: {
              family: 'fhe',
              provider: 'fhenix',
              protocol: 'cofhe',
              runtime: 'foundry',
              surface: 'contracts',
            },
            ambiguityGroup: 'fhe-contracts',
            train: ['fhe-a', 'fhe-b'],
            holdout: ['fhe-h', 'fhe-h2'],
            family: 'fhenix-foundry',
            layers: ['framework:fhenix-foundry'],
            capabilities: [],
            registryFiles: ['registry/families/fhenix-foundry/manifest.json'],
            prompts: [
              'Build a Fhenix Foundry sealed-bid auction contract with CoFHE encrypted bids',
            ],
            authenticitySignals: ['FHE.asEuint', 'FHE.add', 'FHE.select'],
          }),
          candidate({
            id: 'fhe-capabilities',
            domain: { family: 'fhe', surface: 'contracts' },
            ambiguityGroup: 'fhe-capabilities',
            train: ['fhe-cap-a'],
            holdout: ['fhe-cap-h'],
            family: 'fhenix-contracts',
            layers: ['framework:fhenix-contracts', 'capability:fhe-private-token'],
            capabilities: ['capability:fhe-private-token'],
            registryFiles: ['registry/layers/capability/fhe-private-token/manifest.json'],
          }),
        ],
      },
      null,
      2,
    ),
  )
}

function writeScoredResult(
  root: string,
  split: 'train' | 'holdout',
  leafId: string,
  score: number,
): void {
  const dir = join(root, `${split}-${leafId}`, 'matrix')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'competition.json'),
    JSON.stringify(
      {
        taskListId: leafId,
        nTasks: 1,
        nProfiles: 1,
        rankBasis: 'composite',
        ranked: [
          {
            rank: 1,
            profileId: 'smoke',
            label: 'Smoke profile',
            passRate: score >= 0.5 ? 1 : 0,
            hitRate: score >= 0.5 ? 1 : 0,
            meanBlended: score,
            meanComposite: score,
            costPerSolved: 0.1,
          },
        ],
      },
      null,
      2,
    ),
  )
  writeFileSync(join(dir, 'run-manifest.json'), JSON.stringify({ durationMs: 1000 }, null, 2))
}

function candidate(input: {
  id: string
  domain: Record<string, string>
  ambiguityGroup: string
  train: string[]
  holdout: string[]
  family: string
  layers: string[]
  capabilities: string[]
  registryFiles: string[]
  prompts?: string[]
  validationCommands?: string[]
  authenticitySignals?: string[]
}): Record<string, unknown> {
  return {
    id: input.id,
    status: 'candidate',
    domain: input.domain,
    ambiguityGroup: input.ambiguityGroup,
    verticalIds: [`${input.id}-suite`],
    leafIds: { train: input.train, holdout: input.holdout },
    partnerIds: [],
    failureEvidence: [
      {
        source: 'fixture',
        bucket: 'vertical-leaf-demand',
        count: input.train.length + input.holdout.length,
      },
    ],
    intendedStarter: {
      family: input.family,
      layers: input.layers,
      capabilities: input.capabilities,
    },
    routingPrompts: input.prompts ?? [],
    validationCommands: input.validationCommands ?? [],
    authenticitySignals: input.authenticitySignals ?? [],
    registryFiles: input.registryFiles,
    filesToModify: [...input.registryFiles, 'tests/domain-packs.test.ts'],
    gatesToRun: ['pnpm exec tsx scripts/validate-registry.ts', ...(input.validationCommands ?? [])],
    sourceFiles: [`fixtures/${input.id}.ts`],
  }
}

test('domain-pack run writes diversified independent work units', () => {
  const root = mkdtempSync(join(tmpdir(), 'sf-domain-pack-run-'))
  try {
    const candidatesPath = join(root, 'candidates.json')
    const runsDir = join(root, 'runs')
    const statePath = join(root, 'state.json')
    writeCandidates(candidatesPath)

    const result = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidates',
        candidatesPath,
        '--runs-dir',
        runsDir,
        '--state',
        statePath,
        '--run-id',
        'proof',
        '--limit',
        '4',
        '--write-plan',
        '--no-claim',
        '--json',
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )

    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.selected.length, 4)
    assert.ok(report.selected.includes('bridge-contracts'))
    assert.ok(report.selected.includes('bridge-ui'))
    assert.ok(report.selected.includes('fhe-contracts-fhenix-foundry'))
    assert.equal(report.distribution.byDomain.bridge, 3)
    assert.equal(report.distribution.byDomain.fhe, 2)
    assert.equal(report.distribution.bySurface.contracts, 4)
    assert.equal(report.distribution.bySurface.ui, 1)
    assert.ok(existsSync(join(runsDir, 'proof/run.json')))
    assert.ok(existsSync(join(runsDir, 'proof/summary.md')))

    for (const id of report.selected) {
      const workUnitPath = join(runsDir, 'proof', id.replace(/[^a-z0-9]+/g, '-'), 'work-unit.json')
      assert.ok(existsSync(workUnitPath), `missing work unit for ${id}`)
      const workUnit = JSON.parse(readFileSync(workUnitPath, 'utf8'))
      assert.equal(workUnit.candidateId, id)
      assert.equal(workUnit.github.parentIssue, 148)
      assert.ok(workUnit.registryFiles.length > 0)
      assert.ok(workUnit.filesToModify.length > 0)
      assert.ok(workUnit.sourceLeaves.train.length > 0)
      assert.ok(workUnit.expectedStarter.family)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('domain-pack run claim locks prevent duplicate candidate selection', () => {
  const root = mkdtempSync(join(tmpdir(), 'sf-domain-pack-run-lock-'))
  try {
    const candidatesPath = join(root, 'candidates.json')
    const runsDir = join(root, 'runs')
    const statePath = join(root, 'state.json')
    writeCandidates(candidatesPath)

    const first = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidates',
        candidatesPath,
        '--runs-dir',
        runsDir,
        '--state',
        statePath,
        '--run-id',
        'agent-a-run',
        '--candidate',
        'bridge-ui',
        '--write-plan',
        '--claim-owner',
        'agent-a',
        '--json',
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )
    assert.equal(first.status, 0, first.stderr)

    const duplicate = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidates',
        candidatesPath,
        '--runs-dir',
        runsDir,
        '--state',
        statePath,
        '--run-id',
        'agent-b-run',
        '--candidate',
        'bridge-ui',
        '--write-plan',
        '--claim-owner',
        'agent-b',
        '--json',
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )
    assert.equal(duplicate.status, 3)
    assert.match(duplicate.stderr, /already claimed/)

    const next = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidates',
        candidatesPath,
        '--runs-dir',
        runsDir,
        '--state',
        statePath,
        '--run-id',
        'agent-b-next',
        '--limit',
        '1',
        '--write-plan',
        '--claim-owner',
        'agent-b',
        '--json',
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )
    assert.equal(next.status, 0, next.stderr)
    const report = JSON.parse(next.stdout)
    assert.deepEqual(report.skippedLocked, ['bridge-ui'])
    assert.notEqual(report.selected[0], 'bridge-ui')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('domain-pack run filters by domain, surface, provider, and ambiguity group', () => {
  const root = mkdtempSync(join(tmpdir(), 'sf-domain-pack-run-filter-'))
  try {
    const candidatesPath = join(root, 'candidates.json')
    const runsDir = join(root, 'runs')
    const statePath = join(root, 'state.json')
    writeCandidates(candidatesPath)

    const bridgeUi = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidates',
        candidatesPath,
        '--runs-dir',
        runsDir,
        '--state',
        statePath,
        '--domain',
        'bridge',
        '--surface',
        'ui',
        '--limit',
        '5',
        '--json',
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )
    assert.equal(bridgeUi.status, 0, bridgeUi.stderr)
    assert.deepEqual(JSON.parse(bridgeUi.stdout).selected, ['bridge-ui'])

    const provider = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidates',
        candidatesPath,
        '--runs-dir',
        runsDir,
        '--state',
        statePath,
        '--provider',
        'layerzero',
        '--json',
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )
    assert.equal(provider.status, 0, provider.stderr)
    assert.deepEqual(JSON.parse(provider.stdout).selected, ['bridge-contracts-layerzero-omnichain'])

    const ambiguity = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidates',
        candidatesPath,
        '--runs-dir',
        runsDir,
        '--state',
        statePath,
        '--ambiguity-group',
        'fhe-capabilities',
        '--json',
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )
    assert.equal(ambiguity.status, 0, ambiguity.stderr)
    assert.deepEqual(JSON.parse(ambiguity.stdout).selected, ['fhe-capabilities'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('domain-pack run records state transitions and deterministic gate evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'sf-domain-pack-run-state-'))
  try {
    const candidatesPath = join(root, 'candidates.json')
    const runsDir = join(root, 'runs')
    const statePath = join(root, 'state.json')
    writeCandidates(candidatesPath)

    const status = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidates',
        candidatesPath,
        '--runs-dir',
        runsDir,
        '--state',
        statePath,
        '--candidate',
        'bridge-ui',
        '--set-status',
        'needs-scaffold',
        '--reason',
        'fixture status transition',
        '--json',
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )
    assert.equal(status.status, 0, status.stderr)
    let state = JSON.parse(readFileSync(statePath, 'utf8'))
    assert.equal(state.candidates['bridge-ui'].status, 'needs-scaffold')
    assert.equal(state.candidates['bridge-ui'].reason, 'fixture status transition')

    const explicit = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidates',
        candidatesPath,
        '--runs-dir',
        runsDir,
        '--state',
        statePath,
        '--run-id',
        'explicit-non-candidate',
        '--candidate',
        'bridge-ui',
        '--write-plan',
        '--no-claim',
        '--json',
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )
    assert.equal(explicit.status, 0, explicit.stderr)
    assert.deepEqual(JSON.parse(explicit.stdout).selected, ['bridge-ui'])

    const gate = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidates',
        candidatesPath,
        '--runs-dir',
        runsDir,
        '--state',
        statePath,
        '--run-id',
        'deterministic',
        '--candidate',
        'fhe-contracts-fhenix-foundry',
        '--write-plan',
        '--no-claim',
        '--gates',
        'deterministic',
        '--smoke-skip-build',
        '--blueprint-agent',
        'off',
        '--json',
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )
    assert.equal(gate.status, 0, gate.stderr || gate.stdout)
    const report = JSON.parse(gate.stdout)
    assert.equal(report.gateResults[0].status, 'passed')
    assert.ok(existsSync(join(runsDir, 'deterministic/fhe-contracts-fhenix-foundry/smoke.json')))

    state = JSON.parse(readFileSync(statePath, 'utf8'))
    assert.equal(state.candidates['fhe-contracts-fhenix-foundry'].status, 'deterministic-passed')
    assert.ok(
      state.candidates['fhe-contracts-fhenix-foundry'].evidencePaths.includes(
        report.gateResults[0].evidencePath,
      ),
    )

    const scoredResults = join(root, 'scored-results')
    writeScoredResult(scoredResults, 'train', 'fhe-a', 0.8)
    writeScoredResult(scoredResults, 'holdout', 'fhe-h', 0.75)
    const scored = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidates',
        candidatesPath,
        '--runs-dir',
        runsDir,
        '--state',
        statePath,
        '--run-id',
        'scored',
        '--candidate',
        'fhe-contracts-fhenix-foundry',
        '--write-plan',
        '--no-claim',
        '--gates',
        'scored',
        '--scored-results-dir',
        scoredResults,
        '--smoke-skip-build',
        '--train',
        '1',
        '--holdout',
        '1',
        '--json',
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )

    assert.equal(scored.status, 0, scored.stderr || scored.stdout)
    const scoredReport = JSON.parse(scored.stdout)
    assert.equal(scoredReport.gateResults[0].status, 'passed')
    assert.ok(existsSync(join(runsDir, 'scored/fhe-contracts-fhenix-foundry/scored.json')))
    state = JSON.parse(readFileSync(statePath, 'utf8'))
    assert.equal(state.candidates['fhe-contracts-fhenix-foundry'].status, 'scored-passed')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
