// Bridge contract tests — confirm the starter-foundry glue over agent-eval
// stays correctly shaped as both sides evolve. These are fast pure-function
// tests; the driver integration tests live alongside coverage.test.ts.

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  makeHarnessConfig,
  manifestComplianceAssertions,
  snapshotScaffold,
  buildScaffoldMetaPrompt,
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
    const h = makeHarnessConfig(fakeComponents({ family: { taxonomy: { language: 'typescript', surface: 'frontend' } } }))
    assert.match(h.setupCommand!, /pnpm install/)
    assert.match(h.testCommand!, /pnpm/)
  })
  test('rust → cargo fetch + cargo check', () => {
    const h = makeHarnessConfig(fakeComponents({ family: { taxonomy: { language: 'rust', surface: 'zkvm' } } }))
    assert.match(h.setupCommand!, /cargo fetch/)
    assert.match(h.testCommand!, /cargo check/)
  })
  test('go → go mod tidy + go build + vet', () => {
    const h = makeHarnessConfig(fakeComponents({ family: { taxonomy: { language: 'go', surface: 'api' } } }))
    assert.match(h.setupCommand!, /go mod tidy/)
    assert.match(h.testCommand!, /go build/)
  })
  test('move → aptos move compile --dev', () => {
    const h = makeHarnessConfig(fakeComponents({ family: { taxonomy: { language: 'move', surface: 'contracts' } } }))
    assert.match(h.testCommand!, /aptos move compile --dev/)
  })
  test('solidity → forge build', () => {
    const h = makeHarnessConfig(fakeComponents({ family: { taxonomy: { language: 'solidity', surface: 'contracts' } } }))
    assert.match(h.testCommand!, /forge build/)
  })
  test('unknown language → no-op test (never block eval)', () => {
    const h = makeHarnessConfig(fakeComponents({ family: { taxonomy: { language: 'zig', surface: 'firmware' } } }))
    assert.equal(h.testCommand, 'true')
  })
})

describe('scaffold-bridge: manifestComplianceAssertions', () => {
  test('emits one assertion per unique file target across family + layers', () => {
    const c = fakeComponents({
      family: {
        id: 'f', taxonomy: { language: 'typescript', surface: 'frontend' },
        files: [{ source: 'a', target: 'src/main.ts' }, { source: 'b', target: 'package.json' }],
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
    const assertions = manifestComplianceAssertions(fakeComponents({ family: { id: 'empty', taxonomy: { language: 'typescript', surface: 'frontend' }, files: [] } }))
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
        projectName: 'test', family: 'react-vite-ts', layers: ['framework:react-vite-ts', 'capability:tailwind'],
        partner: null, slots: {}, variables: {},
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
      composedSpec: { projectName: 't', family: 'react-vite-ts', layers: [], partner: null, slots: {}, variables: {} } as any,
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
      composedSpec: { projectName: 't', family: 'f', layers: [], partner: null, slots: {}, variables: {} } as any,
      snapshot: { files: {}, rows: {}, kv: {} },
    })
    assert.match(prompt, /empty scaffold/)
    assert.ok(prompt.length > 100)
  })
})
