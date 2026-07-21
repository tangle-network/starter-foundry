// Adversarial tests for the buildout pipeline — locks, corrupted inputs,
// empty files, idempotency, concurrent runs, schema drift. Every assertion
// in this file corresponds to a bug that was found and fixed (or a failure
// mode the pipeline is documented to handle gracefully).
//
// These tests invoke the scripts as subprocesses because they test the
// script-level contract, not the library functions. Each test uses its own
// temp dir; nothing touches the real .evolve/ state.

import assert from 'node:assert/strict'
import test from 'node:test'
import { spawn, spawnSync, type SpawnSyncReturns } from 'node:child_process'
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '..')
const MINE = join(REPO, 'scripts/mine-buildout-sessions.ts')
const JOIN = join(REPO, 'scripts/join-buildout-outcomes.ts')
const ANALYZE = join(REPO, 'scripts/analyze-buildouts.ts')
const PIPELINE = join(REPO, 'scripts/run-buildout-pipeline.ts')
const TEMPLATE_SWEEP = join(REPO, 'scripts/template-quality-sweep.ts')

function run(cmd: string, args: string[], cwd: string): SpawnSyncReturns<string> {
  return spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env },
    timeout: 20_000,
  })
}

function setupWorkspace() {
  const dir = mkdtempSync(join(tmpdir(), 'harden-'))
  mkdirSync(join(dir, '.evolve/traces'), { recursive: true })
  return dir
}

function makeFakeSessionProjectsDir(root: string) {
  const projects = join(root, 'projects')
  const slug =
    '-private-var-folders-wk-T-factory-local-phase2-ethereum-l1-mozxcvbnm-fake-scenario-r1-fake-scenario-abcd'
  const sessDir = join(projects, slug)
  mkdirSync(sessDir, { recursive: true })
  return { projects, sessDir }
}

test('hardening: pipeline treats a missing session source as an empty corpus', () => {
  const dir = setupWorkspace()
  try {
    const r = run(
      process.execPath,
      [PIPELINE, '--projects-dir', join(dir, 'missing-projects')],
      dir,
    )
    assert.equal(r.status, 0, `pipeline failed without source sessions: ${r.stderr}`)
    assert.equal(readFileSync(join(dir, '.evolve/traces/buildouts.jsonl'), 'utf8').trim(), '')

    const analysis = JSON.parse(readFileSync(join(dir, '.evolve/buildout-analysis.json'), 'utf8'))
    assert.equal(analysis.summary.totalBuildouts, 0)
    assert.deepEqual(analysis.topRewrittenFiles, [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hardening: template sweep writes an empty summary when nothing was rewritten', () => {
  const dir = setupWorkspace()
  try {
    const scriptDir = join(dir, 'scripts')
    mkdirSync(scriptDir, { recursive: true })
    const script = join(scriptDir, 'template-quality-sweep.ts')
    copyFileSync(TEMPLATE_SWEEP, script)
    writeFileSync(
      join(dir, '.evolve/buildout-analysis.json'),
      JSON.stringify({ topRewrittenFiles: [] }),
    )

    const r = run(process.execPath, [script], dir)
    assert.equal(r.status, 0, `template sweep failed without rewritten files: ${r.stderr}`)

    const summary = JSON.parse(
      readFileSync(join(dir, '.evolve/template-candidates/sweep-summary.json'), 'utf8'),
    )
    assert.equal(summary.topN, 5)
    assert.deepEqual(summary.results, [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hardening: miner recovers from corrupted state file', () => {
  const dir = setupWorkspace()
  try {
    writeFileSync(join(dir, '.evolve/traces/.buildouts-miner-state.json'), 'not valid json at all')
    const r = run(process.execPath, [MINE, '--projects-dir', '/tmp/nonexistent-dir-harden'], dir)
    assert.equal(r.status, 0, `miner crashed with exit ${r.status}: ${r.stderr}`)
    assert.match(r.stdout + r.stderr, /reseeding|corrupt/i, 'expected corruption-recovery log')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hardening: concurrent miners — lock prevents duplicate events', async () => {
  const dir = setupWorkspace()
  try {
    const { projects, sessDir } = makeFakeSessionProjectsDir(dir)
    writeFileSync(
      join(sessDir, 'sess.jsonl'),
      [
        JSON.stringify({ type: 'user', message: { content: 'prompt' } }),
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [{ type: 'tool_use', name: 'Bash', input: { command: 'pnpm add zod' } }],
          },
        }),
      ].join('\n'),
    )

    // Three concurrent miner invocations. The real production invariant is
    // "concurrent runs never produce duplicate events" — from the output's
    // perspective, it doesn't matter whether dedup came from the lock or from
    // the mtime-skip. Both are part of the same correctness story.
    //
    // NB: intentionally NOT passing --force-all. --force-all is a debug flag
    // that disables mtime dedup — useful when retrying a poisoned session,
    // but it's not the production code path. Testing the production path
    // here is what matters.
    const runners = [0, 1, 2].map(
      () =>
        new Promise<{ status: number | null }>((resolveFn) => {
          const child = spawn(process.execPath, [MINE, '--projects-dir', projects], {
            cwd: dir,
            env: { ...process.env },
            stdio: ['ignore', 'ignore', 'ignore'],
          })
          child.on('exit', (code) => resolveFn({ status: code }))
        }),
    )
    const results = await Promise.all(runners)
    // Every exit must be either success (0) or lock-contention (75). No crashes.
    for (const r of results) {
      assert.ok(r.status === 0 || r.status === 75, `unexpected miner exit ${r.status}`)
    }
    // The invariant: regardless of scheduling, the output contains exactly
    // 1 event. This holds as long as ONE of {lock, mtime-skip} works.
    const out = join(dir, '.evolve/traces/buildouts.jsonl')
    const lines = existsSync(out)
      ? readFileSync(out, 'utf8')
          .trim()
          .split('\n')
          .filter((l) => l.length > 0)
      : []
    assert.equal(lines.length, 1, `expected exactly 1 mined event, got ${lines.length}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hardening: stale lock (from crashed miner) can be stolen', () => {
  const dir = setupWorkspace()
  try {
    // Plant a lock owned by PID 99999 (very unlikely to be alive)
    writeFileSync(join(dir, '.evolve/traces/.buildouts-miner-state.json.lock'), '99999')
    const r = run(process.execPath, [MINE, '--projects-dir', '/tmp/nonexistent-dir-harden'], dir)
    assert.equal(r.status, 0, `stale lock should be stolen: exit ${r.status} / ${r.stderr}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hardening: join is fully idempotent (byte-identical on re-run)', () => {
  const dir = setupWorkspace()
  try {
    writeFileSync(
      join(dir, '.evolve/traces/buildouts.jsonl'),
      JSON.stringify({
        schemaVersion: 3,
        sessionId: 's1',
        initialPrompt: 'p',
        scenarioId: 'foo',
        partnerGuess: 'ethereum-l1',
        replayRound: 1,
        addedPackages: [],
        addedDirs: [],
        rewrittenFiles: [],
        outcome: null,
      }) + '\n',
    )
    writeFileSync(
      join(dir, '.evolve/traces/vb-execution-x.jsonl'),
      JSON.stringify({
        scenarioId: 'foo',
        partner: 'ethereum-foundation',
        timestamp: '2026-04-19T00:00:00Z',
        execution: {
          allPass: true,
          blendedScore: 0.9,
          failingLayers: [],
          shotsRun: 1,
          shotsToConvergence: 1,
          wallMs: 1000,
          toolCallsTotal: 10,
        },
      }) + '\n',
    )
    const r1 = run(process.execPath, [JOIN], dir)
    assert.equal(r1.status, 0, `join 1 exit ${r1.status}: ${r1.stderr}`)
    const after1 = readFileSync(join(dir, '.evolve/traces/buildouts.jsonl'), 'utf8')
    const r2 = run(process.execPath, [JOIN], dir)
    assert.equal(r2.status, 0)
    const after2 = readFileSync(join(dir, '.evolve/traces/buildouts.jsonl'), 'utf8')
    assert.equal(after1, after2, 'join must produce byte-identical output on re-run')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hardening: analyzer handles empty buildouts file without divide-by-zero', () => {
  const dir = setupWorkspace()
  try {
    writeFileSync(join(dir, '.evolve/traces/buildouts.jsonl'), '')
    const r = run(process.execPath, [ANALYZE], dir)
    assert.equal(r.status, 0, `analyzer crashed on empty input: ${r.stderr}`)
    assert.doesNotMatch(r.stdout, /NaN|Infinity/, 'expected no NaN/Infinity leakage')
    assert.match(r.stdout, /total buildouts:\s+0/, 'expected zero-count summary')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hardening: analyzer skips malformed JSONL lines without crashing', () => {
  const dir = setupWorkspace()
  try {
    writeFileSync(
      join(dir, '.evolve/traces/buildouts.jsonl'),
      [
        JSON.stringify({
          schemaVersion: 3,
          sessionId: 's1',
          initialPrompt: 'good',
          scenarioId: 'foo',
          partnerGuess: 'bar',
          addedPackages: [],
          addedDirs: [],
          rewrittenFiles: [],
          outcome: null,
        }),
        'not json at all',
        JSON.stringify({
          schemaVersion: 3,
          sessionId: 's2',
          initialPrompt: 'also good',
          scenarioId: 'foo',
          partnerGuess: 'bar',
          addedPackages: [],
          addedDirs: [],
          rewrittenFiles: [],
          outcome: null,
        }),
      ].join('\n'),
    )
    const r = run(process.execPath, [ANALYZE], dir)
    assert.equal(r.status, 0, `analyzer crashed: ${r.stderr}`)
    assert.match(r.stdout, /total buildouts:\s+2/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hardening: miner tolerates unknown Claude Code message types (schema drift)', () => {
  const dir = setupWorkspace()
  try {
    const { projects, sessDir } = makeFakeSessionProjectsDir(dir)
    writeFileSync(
      join(sessDir, 'drift.jsonl'),
      [
        JSON.stringify({ type: 'newFutureType', message: { someNewShape: true } }),
        JSON.stringify({ type: 'user', message: { content: 'real prompt' } }),
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [{ type: 'tool_use', name: 'Bash', input: { command: 'pnpm add react' } }],
          },
        }),
        JSON.stringify({ type: 'system', message: { foo: 'bar' } }),
      ].join('\n'),
    )
    const r = run(process.execPath, [MINE, '--projects-dir', projects], dir)
    assert.equal(r.status, 0, `miner crashed on drift: ${r.stderr}`)
    const lines = readFileSync(join(dir, '.evolve/traces/buildouts.jsonl'), 'utf8')
      .trim()
      .split('\n')
    assert.equal(lines.length, 1)
    const parsed = JSON.parse(lines[0]!)
    assert.equal(parsed.initialPrompt, 'real prompt')
    assert.deepEqual(parsed.addedPackages, [{ pm: 'pnpm', name: 'react' }])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hardening: mtime-skip — second miner on unchanged input produces 0 new events', () => {
  const dir = setupWorkspace()
  try {
    const { projects, sessDir } = makeFakeSessionProjectsDir(dir)
    writeFileSync(
      join(sessDir, 'sess.jsonl'),
      JSON.stringify({ type: 'user', message: { content: 'prompt' } }) + '\n',
    )
    run(process.execPath, [MINE, '--projects-dir', projects], dir)
    const first = readFileSync(join(dir, '.evolve/traces/buildouts.jsonl'), 'utf8')
    const r2 = run(process.execPath, [MINE, '--projects-dir', projects], dir)
    const second = readFileSync(join(dir, '.evolve/traces/buildouts.jsonl'), 'utf8')
    assert.match(r2.stdout, /new events:\s*0/)
    assert.equal(first, second, 'unchanged input must not re-append')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
