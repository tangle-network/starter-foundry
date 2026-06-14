import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const TSX = join(process.cwd(), 'node_modules/.bin/tsx')
const SCRIPT = join(process.cwd(), 'scripts/domain-pack-smoke.ts')

function writeCandidates(
  path: string,
  train = ['train-a', 'train-b'],
  holdout = ['holdout-a', 'holdout-b'],
  intendedStarter = {
    family: 'fhenix-foundry',
    layers: ['framework:fhenix-foundry'],
    capabilities: [] as string[],
  },
): void {
  writeFileSync(
    path,
    JSON.stringify(
      {
        candidates: [
          {
            id: 'fhe-contracts-fhenix-foundry',
            domain: {
              family: 'fhe',
              provider: 'fhenix',
              protocol: 'cofhe',
              runtime: 'foundry',
              surface: 'contracts',
            },
            ambiguityGroup: 'fhe-contracts',
            leafIds: { train, holdout },
            intendedStarter,
            routingPrompts: [
              'Build a Fhenix Foundry sealed-bid auction contract with CoFHE encrypted bids',
            ],
            validationCommands: ['forge build'],
            authenticitySignals: ['FHE.asEuint', 'FHE.add', 'FHE.select'],
            registryFiles: ['registry/families/fhenix-foundry/manifest.json'],
            sourceFiles: ['fixture.ts'],
          },
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
  passRate = score >= 0.5 ? 1 : 0,
  scaffold: Record<string, unknown> = {
    family: 'fhenix-foundry',
    layers: ['framework:fhenix-foundry'],
    domainPackGuidance: [{ source: 'fhenix-foundry' }],
  },
  completion: { write?: boolean; passRate?: number } = {},
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
            passRate,
            hitRate: score >= 0.5 ? 1 : 0,
            meanBlended: score,
            meanComposite: score,
            costPerSolved: 0.25,
          },
        ],
      },
      null,
      2,
    ),
  )
  writeFileSync(join(dir, 'run-manifest.json'), JSON.stringify({ durationMs: 1234 }, null, 2))
  const artifactDir = join(dir, 'artifacts', `smoke-${leafId}-r0`)
  mkdirSync(artifactDir, { recursive: true })
  writeFileSync(join(artifactDir, 'scaffold-compose.json'), JSON.stringify(scaffold, null, 2))
  const verifierPassRate = completion.passRate ?? passRate
  if (completion.write !== false) {
    writeFileSync(
      join(artifactDir, 'verification-shot-1.json'),
      JSON.stringify(
        {
          layers: [
            {
              layer: 'completion-verifier',
              status: verifierPassRate > 0 ? 'pass' : 'fail',
              score: verifierPassRate > 0 ? 1 : 0,
              detail: {
                fullyComplete: verifierPassRate > 0,
                completionRate: verifierPassRate > 0 ? 1 : 0,
              },
            },
          ],
        },
        null,
        2,
      ),
    )
  }
}

function writeCompletionArtifact(
  root: string,
  split: 'train' | 'holdout',
  leafId: string,
  profileId: string,
  pass: boolean,
): void {
  const artifactDir = join(
    root,
    `${split}-${leafId}`,
    'matrix',
    'artifacts',
    `${profileId}-${leafId}-r0`,
  )
  mkdirSync(artifactDir, { recursive: true })
  writeFileSync(
    join(artifactDir, 'verification-shot-1.json'),
    JSON.stringify(
      {
        layers: [
          {
            layer: 'completion-verifier',
            status: pass ? 'pass' : 'fail',
            score: pass ? 1 : 0,
            detail: {
              fullyComplete: pass,
              completionRate: pass ? 1 : 0,
            },
          },
        ],
      },
      null,
      2,
    ),
  )
}

test('domain-pack smoke gate composes train and holdout samples and records metrics', () => {
  const root = mkdtempSync(join(tmpdir(), 'sf-domain-pack-smoke-'))
  try {
    const candidatesPath = join(root, 'candidates.json')
    const outputPath = join(root, 'smoke.json')
    writeCandidates(candidatesPath)

    const result = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidate',
        'fhe-contracts-fhenix-foundry',
        '--candidates',
        candidatesPath,
        '--output',
        outputPath,
        '--write',
        '--json',
        '--skip-build',
        '--blueprint-agent',
        'off',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.ok(existsSync(outputPath))
    const report = JSON.parse(readFileSync(outputPath, 'utf8'))
    assert.equal(report.status, 'passed')
    assert.equal(report.starterCli.status, 'passed')
    assert.equal(report.starterCli.source, 'default')
    assert.deepEqual(report.samples.train, ['train-a', 'train-b'])
    assert.deepEqual(report.samples.holdout, ['holdout-a', 'holdout-b'])
    assert.equal(report.compose.passed, 4)
    assert.equal(report.compose.failed, 0)
    assert.ok(report.compose.minFileCount > 0)
    assert.equal(report.routing.status, 'passed')
    assert.ok(report.authenticity.totalHits > 0)
    assert.deepEqual(report.validationCommands, [])
    assert.deepEqual(report.blueprintAgent, [])
    assert.equal(report.scoredPromotion, null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('domain-pack smoke scored mode parses blueprint-agent score distributions', () => {
  const root = mkdtempSync(join(tmpdir(), 'sf-domain-pack-smoke-scored-'))
  try {
    const candidatesPath = join(root, 'candidates.json')
    const outputPath = join(root, 'smoke.json')
    const resultsDir = join(root, 'results')
    writeCandidates(candidatesPath)
    writeScoredResult(resultsDir, 'train', 'train-a', 0.8)
    writeScoredResult(resultsDir, 'train', 'train-b', 0.9)
    writeScoredResult(resultsDir, 'holdout', 'holdout-a', 0.7)
    writeScoredResult(resultsDir, 'holdout', 'holdout-b', 0.6)

    const result = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidate',
        'fhe-contracts-fhenix-foundry',
        '--candidates',
        candidatesPath,
        '--output',
        outputPath,
        '--write',
        '--json',
        '--skip-build',
        '--blueprint-agent',
        'scored',
        '--scored-results-dir',
        resultsDir,
        '--baseline-score',
        '0.6',
        '--max-holdout-regression',
        '0.05',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 0, result.stderr || result.stdout)
    const report = JSON.parse(readFileSync(outputPath, 'utf8'))
    assert.equal(report.status, 'passed')
    assert.equal(report.blueprintAgent.length, 0)
    assert.equal(report.scoredPromotion.status, 'passed')
    assert.equal(report.scoredPromotion.train.n, 2)
    assert.equal(report.scoredPromotion.train.min, 0.8)
    assert.ok(Math.abs(report.scoredPromotion.train.median - 0.85) < 1e-9)
    assert.equal(report.scoredPromotion.train.p90, 0.9)
    assert.equal(report.scoredPromotion.holdout.n, 2)
    assert.ok(Math.abs(report.scoredPromotion.holdout.median - 0.65) < 1e-9)
    assert.equal(report.scoredPromotion.holdout.passCount, 2)
    assert.equal(report.scoredPromotion.holdout.scorePassCount, 2)
    assert.equal(report.scoredPromotion.holdout.completionPassCount, 2)
    assert.equal(report.scoredPromotion.holdout.scaffoldPassCount, 2)
    assert.equal(report.scoredPromotion.leaves[0].profileId, 'smoke')
    assert.equal(report.scoredPromotion.leaves[0].costUsd, 0.25)
    assert.equal(report.scoredPromotion.leaves[0].durationMs, 1234)
    assert.equal(report.scoredPromotion.leaves[0].scorePassed, true)
    assert.equal(report.scoredPromotion.leaves[0].completionPassRate, 1)
    assert.equal(report.scoredPromotion.leaves[0].completionPassed, true)
    assert.equal(report.scoredPromotion.leaves[0].scaffoldPassed, true)
    assert.equal(report.scoredPromotion.leaves[0].scaffold.observedFamily, 'fhenix-foundry')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('domain-pack smoke scored mode trusts verification artifacts for completion passes', () => {
  const root = mkdtempSync(join(tmpdir(), 'sf-domain-pack-smoke-verification-completion-'))
  try {
    const candidatesPath = join(root, 'candidates.json')
    const outputPath = join(root, 'smoke.json')
    const resultsDir = join(root, 'results')
    writeCandidates(candidatesPath, ['train-a'], ['holdout-a'])
    writeScoredResult(resultsDir, 'train', 'train-a', 0.8, 0, undefined, { passRate: 1 })
    writeScoredResult(resultsDir, 'holdout', 'holdout-a', 0.85, 0, undefined, { passRate: 1 })
    writeCompletionArtifact(resultsDir, 'train', 'train-a', 'other-profile', false)

    const result = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidate',
        'fhe-contracts-fhenix-foundry',
        '--candidates',
        candidatesPath,
        '--output',
        outputPath,
        '--write',
        '--json',
        '--skip-build',
        '--blueprint-agent',
        'scored',
        '--scored-results-dir',
        resultsDir,
        '--train',
        '1',
        '--holdout',
        '1',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 0, result.stderr || result.stdout)
    const report = JSON.parse(readFileSync(outputPath, 'utf8'))
    assert.equal(report.scoredPromotion.status, 'passed')
    assert.equal(report.scoredPromotion.train.completionPassCount, 1)
    assert.equal(report.scoredPromotion.holdout.completionPassCount, 1)
    assert.equal(report.scoredPromotion.leaves[0].completionPassRate, 1)
    assert.equal(report.scoredPromotion.leaves[0].completionPassed, true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('domain-pack smoke scored mode treats intended capabilities as scaffold evidence requirements', () => {
  const root = mkdtempSync(join(tmpdir(), 'sf-domain-pack-smoke-capability-'))
  try {
    const candidatesPath = join(root, 'candidates.json')
    const outputPath = join(root, 'smoke.json')
    const resultsDir = join(root, 'results')
    writeCandidates(candidatesPath, ['train-a'], ['holdout-a'], {
      family: 'fhenix-foundry',
      layers: ['framework:fhenix-foundry'],
      capabilities: ['capability:fhe-foundry-sealed-auction'],
    })
    writeScoredResult(resultsDir, 'train', 'train-a', 0.8, 1, {
      family: 'fhenix-foundry',
      layers: ['framework:fhenix-foundry'],
      domainPackGuidance: [{ source: 'capability:fhe-foundry-sealed-auction' }],
    })
    writeScoredResult(resultsDir, 'holdout', 'holdout-a', 0.85, 1, {
      family: 'fhenix-foundry',
      layers: ['framework:fhenix-foundry'],
      domainPackGuidance: [{ source: 'capability:fhe-foundry-sealed-auction' }],
    })

    const result = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidate',
        'fhe-contracts-fhenix-foundry',
        '--candidates',
        candidatesPath,
        '--output',
        outputPath,
        '--write',
        '--json',
        '--skip-build',
        '--blueprint-agent',
        'scored',
        '--scored-results-dir',
        resultsDir,
        '--train',
        '1',
        '--holdout',
        '1',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 0, result.stderr || result.stdout)
    const report = JSON.parse(readFileSync(outputPath, 'utf8'))
    assert.equal(report.scoredPromotion.train.scaffoldPassCount, 1)
    assert.deepEqual(report.scoredPromotion.leaves[0].scaffold.expectedLayers, [
      'framework:fhenix-foundry',
      'capability:fhe-foundry-sealed-auction',
    ])
    assert.deepEqual(report.scoredPromotion.leaves[0].scaffold.observedDomainPackSources, [
      'capability:fhe-foundry-sealed-auction',
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('domain-pack smoke scored mode fails closed when the scored cell lacks expected scaffold evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'sf-domain-pack-smoke-scaffold-'))
  try {
    const candidatesPath = join(root, 'candidates.json')
    const outputPath = join(root, 'smoke.json')
    const resultsDir = join(root, 'results')
    writeCandidates(candidatesPath, ['train-a'], ['holdout-a'])
    writeScoredResult(resultsDir, 'train', 'train-a', 0.8, 1, {
      family: 'react-vite-ts',
      layers: ['framework:react-vite-ts'],
      domainPackGuidance: [],
    })
    writeScoredResult(resultsDir, 'holdout', 'holdout-a', 0.85)

    const result = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidate',
        'fhe-contracts-fhenix-foundry',
        '--candidates',
        candidatesPath,
        '--output',
        outputPath,
        '--write',
        '--json',
        '--skip-build',
        '--blueprint-agent',
        'scored',
        '--scored-results-dir',
        resultsDir,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 1, result.stderr || result.stdout)
    const report = JSON.parse(readFileSync(outputPath, 'utf8'))
    assert.equal(report.status, 'failed')
    assert.equal(report.scoredPromotion.status, 'failed')
    assert.equal(report.scoredPromotion.train.scorePassCount, 1)
    assert.equal(report.scoredPromotion.train.completionPassCount, 1)
    assert.equal(report.scoredPromotion.train.scaffoldFailCount, 1)
    assert.equal(report.scoredPromotion.leaves[0].passed, false)
    assert.equal(report.scoredPromotion.leaves[0].scaffoldPassed, false)
    assert.match(report.scoredPromotion.failures.join('\n'), /scaffold evidence mismatch/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('domain-pack smoke scored mode blocks live scored runs when deterministic preflight fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'sf-domain-pack-smoke-live-preflight-'))
  try {
    const candidatesPath = join(root, 'candidates.json')
    const outputPath = join(root, 'smoke.json')
    writeCandidates(candidatesPath, ['train-a'], ['holdout-a'])

    const result = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidate',
        'fhe-contracts-fhenix-foundry',
        '--candidates',
        candidatesPath,
        '--output',
        outputPath,
        '--write',
        '--json',
        '--starter-cli',
        join(root, 'missing-cli.js'),
        '--skip-build',
        '--blueprint-agent',
        'scored',
        '--blueprint-agent-dir',
        root,
        '--train',
        '1',
        '--holdout',
        '1',
        '--timeout-ms',
        '1000',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 1, result.stderr || result.stdout)
    const report = JSON.parse(readFileSync(outputPath, 'utf8'))
    assert.equal(report.status, 'failed')
    assert.equal(report.starterCli.status, 'failed')
    assert.equal(report.starterCli.source, 'arg')
    assert.equal(report.starterCli.attemptedBuild, false)
    assert.match(report.starterCli.reason, /starter CLI not found/)
    assert.equal(report.scoredPromotion.status, 'failed')
    assert.deepEqual(report.scoredPromotion.leaves, [])
    assert.match(
      report.scoredPromotion.failures.join('\n'),
      /live scored promotion blocked by deterministic preflight/,
    )
    assert.match(report.scoredPromotion.failures.join('\n'), /starter CLI not found/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('domain-pack smoke scored mode fails closed on zero completion pass rate', () => {
  const root = mkdtempSync(join(tmpdir(), 'sf-domain-pack-smoke-pass-rate-'))
  try {
    const candidatesPath = join(root, 'candidates.json')
    const outputPath = join(root, 'smoke.json')
    const resultsDir = join(root, 'results')
    writeCandidates(candidatesPath, ['train-a'], ['holdout-a'])
    writeScoredResult(resultsDir, 'train', 'train-a', 0.8, 0)
    writeScoredResult(resultsDir, 'holdout', 'holdout-a', 0.85, 0)

    const result = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidate',
        'fhe-contracts-fhenix-foundry',
        '--candidates',
        candidatesPath,
        '--output',
        outputPath,
        '--write',
        '--json',
        '--skip-build',
        '--blueprint-agent',
        'scored',
        '--scored-results-dir',
        resultsDir,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 1, result.stderr || result.stdout)
    const report = JSON.parse(readFileSync(outputPath, 'utf8'))
    assert.equal(report.status, 'failed')
    assert.equal(report.scoredPromotion.status, 'failed')
    assert.equal(report.scoredPromotion.train.scorePassCount, 1)
    assert.equal(report.scoredPromotion.train.completionFailCount, 1)
    assert.equal(report.scoredPromotion.holdout.scorePassCount, 1)
    assert.equal(report.scoredPromotion.holdout.completionFailCount, 1)
    assert.equal(report.scoredPromotion.leaves[0].scorePassed, true)
    assert.equal(report.scoredPromotion.leaves[0].completionPassRate, 0)
    assert.equal(report.scoredPromotion.leaves[0].completionPassed, false)
    assert.match(report.scoredPromotion.failures.join('\n'), /without a completion pass/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('domain-pack smoke scored mode fails closed on holdout regression', () => {
  const root = mkdtempSync(join(tmpdir(), 'sf-domain-pack-smoke-regression-'))
  try {
    const candidatesPath = join(root, 'candidates.json')
    const outputPath = join(root, 'smoke.json')
    const resultsDir = join(root, 'results')
    writeCandidates(candidatesPath, ['train-a'], ['holdout-a'])
    writeScoredResult(resultsDir, 'train', 'train-a', 0.9)
    writeScoredResult(resultsDir, 'holdout', 'holdout-a', 0.55)

    const result = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidate',
        'fhe-contracts-fhenix-foundry',
        '--candidates',
        candidatesPath,
        '--output',
        outputPath,
        '--write',
        '--json',
        '--skip-build',
        '--blueprint-agent',
        'scored',
        '--scored-results-dir',
        resultsDir,
        '--baseline-score',
        '0.8',
        '--max-holdout-regression',
        '0.1',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 1, result.stderr || result.stdout)
    const report = JSON.parse(readFileSync(outputPath, 'utf8'))
    assert.equal(report.status, 'failed')
    assert.equal(report.scoredPromotion.status, 'failed')
    assert.match(report.scoredPromotion.failures.join('\n'), /holdout median/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('domain-pack smoke scored mode uses the default threshold for invalid min score input', () => {
  const root = mkdtempSync(join(tmpdir(), 'sf-domain-pack-smoke-min-score-'))
  try {
    const candidatesPath = join(root, 'candidates.json')
    const outputPath = join(root, 'smoke.json')
    const resultsDir = join(root, 'results')
    writeCandidates(candidatesPath, ['train-a'], ['holdout-a'])
    writeScoredResult(resultsDir, 'train', 'train-a', 0.4)
    writeScoredResult(resultsDir, 'holdout', 'holdout-a', 0.4)

    const result = spawnSync(
      TSX,
      [
        SCRIPT,
        '--candidate',
        'fhe-contracts-fhenix-foundry',
        '--candidates',
        candidatesPath,
        '--output',
        outputPath,
        '--write',
        '--json',
        '--skip-build',
        '--blueprint-agent',
        'scored',
        '--scored-results-dir',
        resultsDir,
        '--min-score',
        'not-a-number',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 1, result.stderr || result.stdout)
    const report = JSON.parse(readFileSync(outputPath, 'utf8'))
    assert.equal(report.scoredPromotion.minScore, 0.5)
    assert.match(report.scoredPromotion.failures.join('\n'), /below min score 0.500/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
