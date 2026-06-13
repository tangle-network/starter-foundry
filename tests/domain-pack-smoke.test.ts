import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const TSX = join(process.cwd(), 'node_modules/.bin/tsx')
const SCRIPT = join(process.cwd(), 'scripts/domain-pack-smoke.ts')

test('domain-pack smoke gate composes train and holdout samples and records metrics', () => {
  const root = mkdtempSync(join(tmpdir(), 'sf-domain-pack-smoke-'))
  try {
    const candidatesPath = join(root, 'candidates.json')
    const outputPath = join(root, 'smoke.json')
    writeFileSync(
      candidatesPath,
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
              leafIds: {
                train: ['train-a', 'train-b'],
                holdout: ['holdout-a', 'holdout-b'],
              },
              intendedStarter: {
                family: 'fhenix-foundry',
                layers: ['framework:fhenix-foundry'],
                capabilities: [],
              },
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
    assert.deepEqual(report.samples.train, ['train-a', 'train-b'])
    assert.deepEqual(report.samples.holdout, ['holdout-a', 'holdout-b'])
    assert.equal(report.compose.passed, 4)
    assert.equal(report.compose.failed, 0)
    assert.ok(report.compose.minFileCount > 0)
    assert.equal(report.routing.status, 'passed')
    assert.ok(report.authenticity.totalHits > 0)
    assert.deepEqual(report.validationCommands, [])
    assert.deepEqual(report.blueprintAgent, [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
