// Bridge contract tests — confirm the starter-foundry glue over agent-eval
// stays correctly shaped as both sides evolve. These are fast pure-function
// tests; the driver integration tests live alongside coverage.test.ts.

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  makeHarnessConfig,
  manifestComplianceAssertions,
  snapshotScaffold,
  buildScaffoldMetaPrompt,
  invokeMetaJudge,
} from '../dist/eval/scaffold-bridge.js'

function fakeComponents(overrides: { family?: any; layers?: any[] } = {}) {
  return {
    family: {
      id: 'fake-family',
      taxonomy: { language: 'typescript', surface: 'frontend' },
      files: [{ source: 'files/package.json', target: 'package.json' }],
      ...(overrides.family ?? {}),
    },
    layers: overrides.layers ?? [],
  } as any
}

describe('scaffold-bridge: makeHarnessConfig language dispatch', () => {
  test('typescript → pnpm install + validate/build', () => {
    const h = makeHarnessConfig(
      fakeComponents({ family: { taxonomy: { language: 'typescript', surface: 'frontend' } } }),
    )
    assert.match(h.setupCommand!, /pnpm install/)
    assert.match(h.testCommand!, /pnpm/)
  })
  test('rust → cargo fetch + cargo check', () => {
    const h = makeHarnessConfig(
      fakeComponents({ family: { taxonomy: { language: 'rust', surface: 'zkvm' } } }),
    )
    assert.match(h.setupCommand!, /cargo fetch/)
    assert.match(h.testCommand!, /cargo check/)
  })
  test('go → go mod tidy + go build + vet', () => {
    const h = makeHarnessConfig(
      fakeComponents({ family: { taxonomy: { language: 'go', surface: 'api' } } }),
    )
    assert.match(h.setupCommand!, /go mod tidy/)
    assert.match(h.testCommand!, /go build/)
  })
  test('move → aptos move compile --dev', () => {
    const h = makeHarnessConfig(
      fakeComponents({ family: { taxonomy: { language: 'move', surface: 'contracts' } } }),
    )
    assert.match(h.testCommand!, /aptos move compile --dev/)
  })
  test('solidity → forge build', () => {
    const h = makeHarnessConfig(
      fakeComponents({ family: { taxonomy: { language: 'solidity', surface: 'contracts' } } }),
    )
    assert.match(h.testCommand!, /forge build/)
  })
  test('unknown language → throws (never silent-pass)', () => {
    // Gen 9: the previous `testCommand: 'true'` fallback silently passed
    // every family whose language wasn't in the dispatch. Throwing forces
    // the caller to explicitly add the language to HARNESS_CONFIGS with
    // a strict command before proposing a scaffold against it.
    assert.throws(
      () =>
        makeHarnessConfig(
          fakeComponents({ family: { taxonomy: { language: 'zig', surface: 'firmware' } } }),
        ),
      /unsupported taxonomy\.language/,
    )
  })
})

describe('scaffold-bridge: manifestComplianceAssertions', () => {
  test('emits one assertion per unique file target across family + layers', () => {
    const c = fakeComponents({
      family: {
        id: 'f',
        taxonomy: { language: 'typescript', surface: 'frontend' },
        files: [
          { source: 'a', target: 'src/main.ts' },
          { source: 'b', target: 'package.json' },
        ],
      },
      layers: [
        { group: 'capability', id: 'x', files: [{ source: 'c', target: 'src/x.ts' }] },
        { group: 'capability', id: 'y', files: [{ source: 'd', target: 'package.json' }] }, // dup — should dedupe
      ],
    })
    const assertions = manifestComplianceAssertions(c)
    // Dedupe: 3 unique targets (main.ts, package.json, x.ts)
    assert.equal(assertions.length, 3)
    // Each is agent-eval's fileExists-shaped assertion (has a check method)
    for (const a of assertions) {
      assert.equal(typeof a.check, 'function')
      assert.equal(typeof a.name, 'string')
    }
  })
  test('empty components → empty assertions array', () => {
    const assertions = manifestComplianceAssertions(
      fakeComponents({
        family: {
          id: 'empty',
          taxonomy: { language: 'typescript', surface: 'frontend' },
          files: [],
        },
      }),
    )
    assert.equal(assertions.length, 0)
  })
})

describe('scaffold-bridge: snapshotScaffold', () => {
  test('stores full text content (no arbitrary truncation) for large text files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'snap-test-'))
    try {
      // Write a 500KB text file — bigger than any arbitrary cap a wary
      // reader might assume. Must round-trip losslessly.
      const big = 'a'.repeat(500_000)
      writeFileSync(join(dir, 'big.txt'), big)
      const snap = snapshotScaffold(dir)
      assert.equal(snap.files['big.txt'], big)
      assert.equal(snap.files['big.txt'].length, 500_000)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  test('binary files → blobs channel with size + mimeType, NOT files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'snap-test-'))
    try {
      // Write a binary blob — contains NUL bytes so isProbablyText fails
      const binary = Buffer.alloc(1024)
      for (let i = 0; i < binary.length; i += 1) binary[i] = i % 256
      writeFileSync(join(dir, 'data.wasm'), binary)
      const snap = snapshotScaffold(dir)
      // Binary must NOT be in files (would have corrupted its content via utf8 decode)
      assert.ok(!('data.wasm' in snap.files), 'binary should not land in files')
      // Must be in blobs with mimeType derived from extension
      assert.ok(snap.blobs, 'blobs channel should exist when binaries present')
      assert.equal(snap.blobs!['data.wasm']?.size, 1024)
      assert.equal(snap.blobs!['data.wasm']?.mimeType, 'application/wasm')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  test('excludes node_modules + target + .git + dist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'snap-test-'))
    try {
      mkdirSync(join(dir, 'node_modules'), { recursive: true })
      mkdirSync(join(dir, 'target', 'debug'), { recursive: true })
      mkdirSync(join(dir, '.git'), { recursive: true })
      mkdirSync(join(dir, 'dist'), { recursive: true })
      mkdirSync(join(dir, 'src'), { recursive: true })
      writeFileSync(join(dir, 'node_modules', 'a.js'), 'noise')
      writeFileSync(join(dir, 'target', 'debug', 'b.txt'), 'noise')
      writeFileSync(join(dir, '.git', 'HEAD'), 'noise')
      writeFileSync(join(dir, 'dist', 'c.js'), 'noise')
      writeFileSync(join(dir, 'src', 'keep.ts'), 'keep')
      const snap = snapshotScaffold(dir)
      assert.equal(snap.files['src/keep.ts'], 'keep')
      for (const p of Object.keys(snap.files)) {
        assert.ok(!p.startsWith('node_modules/'), `should skip node_modules: ${p}`)
        assert.ok(!p.startsWith('target/'), `should skip target: ${p}`)
        assert.ok(!p.startsWith('.git/'), `should skip .git: ${p}`)
        assert.ok(!p.startsWith('dist/'), `should skip dist: ${p}`)
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('scaffold-bridge: buildScaffoldMetaPrompt', () => {
  test('renders user prompt + file list + key-file bodies + rubric', () => {
    const prompt = buildScaffoldMetaPrompt({
      userPrompt: 'Build a React dashboard',
      composedSpec: {
        projectName: 'test',
        family: 'react-vite-ts',
        layers: ['framework:react-vite-ts', 'capability:tailwind'],
        partner: null,
        slots: {},
        variables: {},
      } as any,
      snapshot: {
        files: {
          'package.json': '{"name":"test","scripts":{"build":"vite build"}}',
          'src/App.tsx': 'export default function App() { return <div>hi</div> }',
          'README.md': '# test',
        },
        rows: {},
        kv: {},
      },
    })
    // User prompt present
    assert.match(prompt, /Build a React dashboard/)
    // Resolved composition surfaces family + layers
    assert.match(prompt, /family: react-vite-ts/)
    assert.match(prompt, /capability:tailwind/)
    // Key files rendered (package.json is a priority match)
    assert.match(prompt, /### package\.json/)
    // Rubric dimensions all present
    assert.match(prompt, /correctness/)
    assert.match(prompt, /completeness/)
    assert.match(prompt, /idiomatic/)
    assert.match(prompt, /productionReady|production-ready/)
    assert.match(prompt, /overScaffold|over-scaffold/)
    // Explicit JSON schema ask
    assert.match(prompt, /"verdict"/)
  })
  test('truncates large file content with visible marker', () => {
    const bigContent = 'x'.repeat(10_000)
    const prompt = buildScaffoldMetaPrompt({
      userPrompt: 'test',
      composedSpec: {
        projectName: 't',
        family: 'react-vite-ts',
        layers: [],
        partner: null,
        slots: {},
        variables: {},
      } as any,
      snapshot: { files: { 'package.json': bigContent }, rows: {}, kv: {} },
    })
    // Truncation marker must appear — judge needs to know content is partial
    assert.match(prompt, /truncated for prompt budget/)
    // And the title must flag it
    assert.match(prompt, /truncated for prompt/)
  })
  test('empty file list renders without crashing', () => {
    const prompt = buildScaffoldMetaPrompt({
      userPrompt: 'empty scaffold',
      composedSpec: {
        projectName: 't',
        family: 'f',
        layers: [],
        partner: null,
        slots: {},
        variables: {},
      } as any,
      snapshot: { files: {}, rows: {}, kv: {} },
    })
    assert.match(prompt, /empty scaffold/)
    assert.ok(prompt.length > 100)
  })
})

// ─────────────────────────────────────────────────────────────────────
// Gen 8 — compile-gate short-circuit in invokeMetaJudge
// ─────────────────────────────────────────────────────────────────────

describe('scaffold-bridge: invokeMetaJudge compile-gate', () => {
  test('buildOutcome.passed=false short-circuits to verdict=fail without LLM call', async () => {
    const result = await invokeMetaJudge({
      userPrompt: 'kyc onboarding starter',
      composedSpec: {
        family: 'kyc-onboarding',
        layers: ['framework:kyc-onboarding'],
        projectName: 't',
      } as any,
      snapshot: { files: { 'src/main.ts': 'import x from y' }, rows: {}, kv: {} },
      buildOutcome: {
        passed: false,
        phase: 'typecheck',
        stderr: "src/main.ts(1,10): error TS1005: '>' expected.",
      },
    })
    assert.equal(result.verdict, 'fail')
    assert.equal(result.overall, 0)
    assert.equal(result.issues.length, 1)
    assert.equal(result.issues[0]!.dimension, 'correctness')
    assert.equal(result.issues[0]!.severity, 'high')
    assert.match(result.issues[0]!.description, /typecheck failed/)
    assert.match(result.issues[0]!.description, /TS1005/)
    assert.match(result.rationale ?? '', /compile-gate/)
  })

  test('buildOutcome.passed=false includes stderr tail in issue description', async () => {
    // Use a realistic-sized stderr (~300 chars) — under the 500-char tail
    // limit so the actual error survives. Real tsc stderr is usually <1KB.
    const stderr =
      "src/main.tsx(7,25): error TS2339: Property 'createRoot' does not exist on type 'typeof import(\"...\")'"
    const result = await invokeMetaJudge({
      userPrompt: 'fraud-ops React 17 regression',
      composedSpec: { family: 'fraud-ops-console', layers: [], projectName: 't' } as any,
      snapshot: { files: {}, rows: {}, kv: {} },
      buildOutcome: { passed: false, phase: 'typecheck', stderr },
    })
    assert.equal(result.verdict, 'fail')
    assert.match(result.issues[0]!.description, /TS2339|createRoot/)
  })

  test('buildOutcome.passed=true falls through to LLM scoring (no short-circuit)', async () => {
    // We can't run the LLM in this test environment without keys/budget, so
    // verify the short-circuit path is NOT taken by ensuring the function
    // does not return immediately. We expect it to throw or hang on the LLM
    // call — the test passes if the synchronous short-circuit branch was
    // skipped. Using a Promise.race with a tiny timeout to avoid hanging.
    const judgePromise = invokeMetaJudge({
      userPrompt: 'frontend scaffold',
      composedSpec: { family: 'react-vite-ts', layers: [], projectName: 't' } as any,
      snapshot: { files: { 'package.json': '{}' }, rows: {}, kv: {} },
      buildOutcome: { passed: true, phase: 'build' },
    }).catch((e) => ({ error: String(e?.message ?? e) }))

    const winner = await Promise.race([
      judgePromise,
      new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), 200)),
    ])
    // Either timed out (LLM call started, no key) or errored (also LLM-path).
    // What it MUST NOT be: a verdict='fail' with rationale mentioning compile-gate.
    if (
      (winner as any).verdict === 'fail' &&
      /compile-gate/.test(String((winner as any).rationale ?? ''))
    ) {
      assert.fail('short-circuit fired when buildOutcome.passed=true')
    }
  })

  test('omitted buildOutcome falls through to LLM scoring (backward-compat)', async () => {
    // Existing callers don't pass buildOutcome. Ensure the new parameter is
    // truly optional and the function doesn't short-circuit when absent.
    const judgePromise = invokeMetaJudge({
      userPrompt: 'backward-compat caller',
      composedSpec: { family: 'react-vite-ts', layers: [], projectName: 't' } as any,
      snapshot: { files: { 'package.json': '{}' }, rows: {}, kv: {} },
    }).catch((e) => ({ error: String(e?.message ?? e) }))

    const winner = await Promise.race([
      judgePromise,
      new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), 200)),
    ])
    if (
      (winner as any).verdict === 'fail' &&
      /compile-gate/.test(String((winner as any).rationale ?? ''))
    ) {
      assert.fail('short-circuit fired when buildOutcome was omitted')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────
// Gen 8 — strict TS testCommand in promote-family-proposal harness
// (regression guard: PR#51's 3 bugs MUST fail the new gate)
// ─────────────────────────────────────────────────────────────────────

describe('promote-family-proposal harness: strict TS gate', () => {
  test('typescript family testCommand is strict tsc --noEmit (via HARNESS_CONFIGS)', async () => {
    // Gen 9 dedup: the promoters no longer carry their own per-language
    // switch. Source of truth is HARNESS_CONFIGS in scaffold-bridge.ts;
    // verify it directly.
    const mod = await import('../dist/eval/scaffold-bridge.js')
    const testCmd = mod.HARNESS_CONFIGS.typescript!.testCommand as string
    assert.doesNotMatch(
      testCmd,
      /\|\| true/,
      `testCommand must not swallow with || true — got: ${testCmd}`,
    )
    assert.match(testCmd, /tsc\s+--noEmit/, `testCommand must run tsc --noEmit — got: ${testCmd}`)
  })

  test('capability promoter uses HARNESS_CONFIGS (no parallel switch)', async () => {
    const { readFileSync } = await import('node:fs')
    const cap = readFileSync('scripts/promote-capability-proposal.ts', 'utf8')
    assert.match(
      cap,
      /HARNESS_CONFIGS/,
      'promote-capability-proposal.ts must import HARNESS_CONFIGS — source of truth is scaffold-bridge.ts',
    )
    assert.doesNotMatch(
      cap,
      /case\s+['"]typescript['"]\s*:[\s\S]+?testCommand/,
      'capability promoter must not redeclare its own language→command switch (Gen 9 dedup)',
    )
  })

  test('promoter passes cwd via harness config, not driver constructor (Gen 8b fix)', async () => {
    // SubprocessSandboxDriver.exec reads cwd from per-call HarnessConfig, NOT
    // from the constructor. Pre-Gen-8b the promoter set cwd on the driver
    // (silently dropped) so testCommand ran in the wrong dir — strict gate
    // checked starter-foundry's tsc instead of the composed scaffold's.
    // Regression guard: the harness assignment must spread cwd into the
    // harness object, not pass it to the driver.
    const { readFileSync } = await import('node:fs')
    const promoter = readFileSync('scripts/promote-family-proposal.ts', 'utf8')
    // Should NOT pass cwd to the driver constructor
    assert.doesNotMatch(
      promoter,
      /new SubprocessSandboxDriver\(\s*\{[^}]*cwd/,
      'cwd must NOT be passed to SubprocessSandboxDriver constructor (silently dropped)',
    )
    // Should spread cwd into the harness config
    assert.match(
      promoter,
      /harnessConfig\s*=\s*\{[\s\S]*\.\.\.harnessConfigForFamily[\s\S]*cwd:\s*composedOutDir/,
      'harnessConfig must include cwd: composedOutDir so the test command runs in the composed scaffold',
    )

    const cap = readFileSync('scripts/promote-capability-proposal.ts', 'utf8')
    assert.doesNotMatch(
      cap,
      /new SubprocessSandboxDriver\(\s*\{[^}]*cwd/,
      'capability promoter: cwd must NOT be passed to SubprocessSandboxDriver constructor',
    )
    assert.match(
      cap,
      /harnessConfig\s*=\s*\{[\s\S]*\.\.\.harnessConfigForFamily[\s\S]*cwd:\s*composedOutDir/,
      'capability promoter: harnessConfig must include cwd: composedOutDir',
    )
  })

  test('agent-eval driver end-to-end: HarnessConfig.cwd is actually honored at spawn time', async () => {
    // Source-grep guards above defend against regressions in the *fix shape*.
    // This test defends against the *semantics we rely on*: if SandboxHarness
    // starts ignoring config.cwd (or honoring the constructor arg instead),
    // source-grep tests still pass but the compile-gate silently runs in the
    // wrong dir. A real spawn against a tmpdir catches that immediately.
    const { TraceEmitter, InMemoryTraceStore, SandboxHarness, SubprocessSandboxDriver } =
      await import('@tangle-network/agent-eval')
    // macOS tmpdir is a symlink (/var/folders → /private/var/folders); `pwd`
    // in bash follows it, so compare against the resolved realpath or the
    // test fails on Darwin while passing on Linux.
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'harness-cwd-behavioral-')))
    try {
      const store = new InMemoryTraceStore()
      const driver = new SubprocessSandboxDriver()
      const harness = new SandboxHarness(driver)
      const emitter = new TraceEmitter(store)
      await emitter.startRun({ projectId: 'harness-cwd-behavioral' })
      const result = await harness.run(
        {
          setupCommand: 'true',
          // Exits 0 iff the subprocess runs in `dir`. If HarnessConfig.cwd
          // is dropped and spawn inherits the Node cwd (starter-foundry),
          // this exits 1 → passed=false and the assertion fails loud.
          testCommand: `test "$(pwd)" = "${dir}"`,
          cwd: dir,
          timeoutMs: 10_000,
        },
        emitter,
      )
      await emitter.endRun({ pass: result.passed, score: result.score })
      assert.equal(
        result.passed,
        true,
        `HarnessConfig.cwd was not honored — subprocess exited in wrong dir. ` +
          `exitCode=${result.test?.exitCode}, stderr=${result.test?.stderr ?? ''}`,
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
