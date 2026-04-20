// Smoke test: runs the whole orchestrator (mine → join → analyze) against
// a synthetic fixture end-to-end. Catches breakage at the script-to-script
// contracts that unit tests can miss.

import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '..')
const ORCHESTRATOR = join(REPO, 'scripts/run-buildout-pipeline.mjs')
const GAPS = join(REPO, 'scripts/infer-capability-gaps.mjs')

function makeSlug(partner: string, scenarioId: string, round: number) {
  return `-private-var-folders-wk-T-factory-local-phase2-${partner}-mozxcvbnm-${scenarioId}-r${round}-${scenarioId}-abcd`
}

test('smoke: full pipeline end-to-end on synthetic fixture', () => {
  const dir = mkdtempSync(join(tmpdir(), 'smoke-'))
  try {
    mkdirSync(join(dir, '.evolve/traces'), { recursive: true })

    // Two fixture sessions — one should join with the VB trace, one shouldn't.
    const projects = join(dir, 'projects')
    const s1 = join(projects, makeSlug('ethereum-l1', 'nft-mint-page', 1))
    const s2 = join(projects, makeSlug('arbitrum-stylus', 'no-match-scenario', 1))
    mkdirSync(s1, { recursive: true })
    mkdirSync(s2, { recursive: true })

    writeFileSync(
      join(s1, 'sess.jsonl'),
      [
        JSON.stringify({ type: 'user', message: { content: 'Build an NFT mint page' } }),
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', name: 'Bash', input: { command: 'pnpm add lucide-react clsx' } },
              { type: 'tool_use', name: 'Edit', input: { file_path: `${s1}/src/App.tsx` } },
            ],
          },
        }),
      ].join('\n'),
    )

    writeFileSync(
      join(s2, 'sess.jsonl'),
      [
        JSON.stringify({ type: 'user', message: { content: 'Build something that does not join' } }),
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', name: 'Bash', input: { command: 'pnpm add tailwindcss' } },
            ],
          },
        }),
      ].join('\n'),
    )

    // Matching VB trace — ethereum-l1 is mapped to ethereum-foundation in the lookup.
    writeFileSync(
      join(dir, '.evolve/traces/vb-execution-smoke.jsonl'),
      JSON.stringify({
        scenarioId: 'nft-mint-page',
        partner: 'ethereum-foundation',
        timestamp: '2026-04-19T00:00:00Z',
        execution: {
          allPass: true,
          blendedScore: 0.91,
          failingLayers: [],
          shotsRun: 1,
          shotsToConvergence: 1,
          wallMs: 42000,
          toolCallsTotal: 8,
        },
      }) + '\n',
    )

    const r = spawnSync(
      process.execPath,
      [ORCHESTRATOR, '--projects-dir', projects],
      {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env },
        timeout: 60_000,
      },
    )
    assert.equal(r.status, 0, `orchestrator failed: exit=${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`)

    // buildouts.jsonl: 2 events
    const buildouts = readFileSync(join(dir, '.evolve/traces/buildouts.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l))
    assert.equal(buildouts.length, 2, `expected 2 buildouts, got ${buildouts.length}`)

    // Exactly one joined (nft-mint-page), one unjoined
    const joined = buildouts.filter((b) => b.outcome !== null)
    assert.equal(joined.length, 1, `expected 1 joined, got ${joined.length}`)
    assert.equal(joined[0].scenarioId, 'nft-mint-page')
    assert.equal(joined[0].outcome.allPass, true)
    assert.equal(joined[0].outcome.blendedScore, 0.91)

    // Analyzer produced committed evidence
    const analysis = JSON.parse(readFileSync(join(dir, '.evolve/buildout-analysis.json'), 'utf8'))
    assert.equal(analysis.summary.totalBuildouts, 2)
    assert.equal(analysis.summary.withOutcome, 1)
    assert.equal(analysis.summary.passRate, 1) // the one joined is passing
    assert.ok(
      analysis.topAddedPackages.some((p: { key: string }) => p.key === 'pnpm:lucide-react'),
      'expected lucide-react in top packages',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('smoke: infer-capability-gaps imports cleanly and runs on the fixture', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gaps-smoke-'))
  try {
    mkdirSync(join(dir, '.evolve/traces'), { recursive: true })
    // Seed a prompt whose agent-observed packages map to capability:shadcn + capability:tailwind
    // but whose prompt is gibberish that won't route to a React family (so the gap is real).
    const buildouts = [
      {
        schemaVersion: 3,
        sessionId: 'gap-smoke',
        sourcePath: '/fake',
        sourceModel: 'claude-code',
        scenarioId: 'gap-smoke',
        partnerGuess: null,
        replayRound: null,
        firstTs: null,
        lastTs: null,
        initialPrompt:
          'Build a contract-only Foundry project for managing DAO proposals with on-chain voting, quorum tracking, and treasury disbursements',
        addedPackages: [
          { pm: 'pnpm', name: 'lucide-react' },
          { pm: 'pnpm', name: 'tailwindcss' },
        ],
        addedDirs: [],
        rewrittenFiles: [],
        outcome: null,
      },
    ]
    writeFileSync(
      join(dir, '.evolve/traces/buildouts.jsonl'),
      buildouts.map((b) => JSON.stringify(b)).join('\n') + '\n',
    )

    const r = spawnSync(process.execPath, [GAPS], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env },
      timeout: 30_000,
    })
    assert.equal(r.status, 0, `gaps script failed:\n${r.stderr}\n${r.stdout}`)
    assert.ok(existsSync(join(dir, '.evolve/capability-gaps.json')), 'expected capability-gaps.json output')

    const gaps = JSON.parse(readFileSync(join(dir, '.evolve/capability-gaps.json'), 'utf8'))
    assert.equal(gaps.schemaVersion, 2)
    assert.ok(typeof gaps.processedEvents === 'number')
    assert.ok(typeof gaps.totalAgentInstalls === 'number')
    assert.ok('scaffoldGap' in gaps.breakdown)
    assert.ok('orchestration' in gaps.breakdown)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
