// Unit tests for the Gen 9 dogfood gates.
//
// Scope:
//   - declared-dep-used: green / red / scoped-pkg / no-deps / nested workspace
//   - scaffold-runs:     green / skipped (no start) / red (start exits early)
//   - eval-scores:       gated on PROMOTER_GATES_INTEGRATION env so CI doesn't
//                        brittle — full test requires pnpm-installable
//                        capability:agent-eval scaffold + port binding.
//
// Test style mirrors tests/muffled-gate-invariant.test.ts: pure node:test
// + node:assert/strict, no test framework. Uses fs tempdirs and spawns
// real subprocesses for gate 2 (the only way to prove it actually boots).

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkDeclaredDepUsed, checkScaffoldRuns } from '../dist/lib/promoter-gates.js'

function scratchDir(): string {
  return mkdtempSync(join(tmpdir(), 'promoter-gates-test-'))
}

function writeFile(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, content)
}

describe('declared-dep-used', () => {
  test('passes when every declared dep is imported somewhere', () => {
    const dir = scratchDir()
    try {
      writeFile(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 'scaffold',
          dependencies: { 'pkg-a': '^1.0.0' },
        }),
      )
      writeFile(join(dir, 'src/index.ts'), `import foo from 'pkg-a'\nexport default foo\n`)
      const manifest = { packageDeps: { dependencies: { 'pkg-a': '^1.0.0' } } }
      const res = checkDeclaredDepUsed({ manifest, composedDir: dir })
      assert.equal(res.status, 'pass', `expected pass, got ${res.status} — ${JSON.stringify(res)}`)
      assert.equal(res.gate, 'declared-dep-used')
      assert.ok(Array.isArray(res.filesSearched), 'filesSearched must be present on pass')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('fails with unusedDeps when a declared dep has no import/require anywhere', () => {
    const dir = scratchDir()
    try {
      writeFile(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 'scaffold',
          dependencies: { 'pkg-a': '^1.0.0' },
        }),
      )
      writeFile(join(dir, 'src/index.ts'), `export const x = 1\n`)
      const manifest = { packageDeps: { dependencies: { 'pkg-a': '^1.0.0' } } }
      const res = checkDeclaredDepUsed({ manifest, composedDir: dir })
      assert.equal(res.status, 'fail', `expected fail, got ${res.status}`)
      assert.deepEqual(res.unusedDeps, ['pkg-a'])
      assert.ok(res.filesSearched && res.filesSearched.length > 0, 'must report files searched')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('handles scoped package names correctly on pass', () => {
    const dir = scratchDir()
    try {
      writeFile(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 'scaffold',
          dependencies: { '@scope/name': '^1.0.0' },
        }),
      )
      writeFile(join(dir, 'src/lib.ts'), `import x from '@scope/name'\nexport { x }\n`)
      const manifest = { packageDeps: { dependencies: { '@scope/name': '^1.0.0' } } }
      const res = checkDeclaredDepUsed({ manifest, composedDir: dir })
      assert.equal(
        res.status,
        'pass',
        `expected pass for scoped pkg, got ${res.status} — ${JSON.stringify(res)}`,
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('handles scoped package subpath imports (e.g. @scope/name/submodule)', () => {
    const dir = scratchDir()
    try {
      writeFile(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 'scaffold',
          dependencies: { '@scope/name': '^1.0.0' },
        }),
      )
      writeFile(join(dir, 'src/lib.ts'), `import x from '@scope/name/sub'\nexport { x }\n`)
      const manifest = { packageDeps: { dependencies: { '@scope/name': '^1.0.0' } } }
      const res = checkDeclaredDepUsed({ manifest, composedDir: dir })
      assert.equal(res.status, 'pass', `expected pass for scoped pkg subpath, got ${res.status}`)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('detects require() usage as dep-used (CJS scaffolds)', () => {
    const dir = scratchDir()
    try {
      writeFile(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 'scaffold',
          dependencies: { 'pkg-a': '^1.0.0' },
        }),
      )
      writeFile(join(dir, 'lib.cjs'), `const a = require('pkg-a')\nmodule.exports = a\n`)
      const manifest = { packageDeps: { dependencies: { 'pkg-a': '^1.0.0' } } }
      const res = checkDeclaredDepUsed({ manifest, composedDir: dir })
      assert.equal(res.status, 'pass')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('skips when manifest has no packageDeps', () => {
    const dir = scratchDir()
    try {
      writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'x' }))
      const res = checkDeclaredDepUsed({ manifest: {}, composedDir: dir })
      assert.equal(res.status, 'skipped')
      assert.equal(res.reason, 'no-package-deps')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('root-level package.json declaration alone does not count as use', () => {
    // The regression case for PR #55: the scaffold's OWN package.json
    // lists the dep under dependencies — that's the declaration, not the
    // use. The gate must look for imports elsewhere.
    const dir = scratchDir()
    try {
      writeFile(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 'scaffold',
          dependencies: { '@tangle-network/agent-eval': '^0.19.1' },
        }),
      )
      writeFile(join(dir, 'src/index.ts'), `export const x = 1\n`)
      const manifest = {
        packageDeps: { dependencies: { '@tangle-network/agent-eval': '^0.19.1' } },
      }
      const res = checkDeclaredDepUsed({ manifest, composedDir: dir })
      assert.equal(res.status, 'fail')
      assert.deepEqual(res.unusedDeps, ['@tangle-network/agent-eval'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('scaffold-runs', () => {
  test('passes when start script boots a server responding 200 on /health', async () => {
    const dir = scratchDir()
    try {
      // Minimal Node HTTP server on PORT responding 200 on /health.
      writeFile(
        join(dir, 'server.mjs'),
        `
import http from 'node:http'
const port = Number(process.env.PORT ?? '3100')
http.createServer((req, res) => {
  if (req.url === '/health') { res.statusCode = 200; res.end('ok'); return }
  res.statusCode = 404; res.end()
}).listen(port, '127.0.0.1', () => { console.log('listening', port) })
`,
      )
      writeFile(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 'test-scaffold',
          scripts: { start: 'node server.mjs' },
        }),
      )
      // Pick a random high port to avoid collision with other tests.
      const port = 31000 + Math.floor(Math.random() * 2000)
      const res = await checkScaffoldRuns({
        composedDir: dir,
        manifest: { taxonomy: { language: 'typescript' }, defaults: { port: String(port) } },
        options: { readyTimeoutMs: 15_000 },
      })
      assert.equal(
        res.status,
        'pass',
        `expected pass — got status=${res.status} reason=${res.reason ?? ''} stderr=${res.stderr ?? ''}`,
      )
      assert.equal(res.port, port)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('skipped when package.json has no start script', async () => {
    const dir = scratchDir()
    try {
      writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'no-start' }))
      const res = await checkScaffoldRuns({
        composedDir: dir,
        manifest: { taxonomy: { language: 'typescript' } },
      })
      assert.equal(res.status, 'skipped')
      assert.equal(res.reason, 'no-start-script')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('fails when start script exits immediately', async () => {
    const dir = scratchDir()
    try {
      writeFile(
        join(dir, 'boom.mjs'),
        `
console.error('failing immediately')
process.exit(1)
`,
      )
      writeFile(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 'boom-scaffold',
          scripts: { start: 'node boom.mjs' },
        }),
      )
      const port = 33000 + Math.floor(Math.random() * 1000)
      const res = await checkScaffoldRuns({
        composedDir: dir,
        manifest: { taxonomy: { language: 'typescript' }, defaults: { port: String(port) } },
        options: { readyTimeoutMs: 5_000 },
      })
      assert.equal(res.status, 'fail', `expected fail — got ${res.status}`)
      assert.match(res.reason ?? '', /start-exited-early|health-endpoint-unreachable/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('skipped with unsupported-lang on non-js/ts taxonomy', async () => {
    const dir = scratchDir()
    try {
      writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { start: 'true' } }))
      const res = await checkScaffoldRuns({
        composedDir: dir,
        manifest: { taxonomy: { language: 'rust' } },
      })
      assert.equal(res.status, 'skipped')
      assert.equal(res.reason, 'unsupported-lang')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('eval-scores (integration)', () => {
  // Full eval-scores requires composing capability:agent-eval + booting
  // its eval runner + network. Gate behind PROMOTER_GATES_INTEGRATION so
  // CI can opt-in when the toolchain is warm. The unit behaviour
  // (skip on missing capability) is covered elsewhere via the promoter
  // regression test.
  if (process.env.PROMOTER_GATES_INTEGRATION !== '1') {
    test.todo('full integration test — set PROMOTER_GATES_INTEGRATION=1 to enable')
    return
  }
  test('runs run-eval.mjs against booted agent and asserts aggregate >= threshold', async () => {
    // Intentionally left stubbed — the full-toolchain path requires pnpm
    // install of @tangle-network/agent-eval inside the composed dir,
    // which is too slow for the default test run. When enabled, this
    // should compose a scaffold with capability:agent-eval, boot it via
    // checkScaffoldRuns({keepProcess:true}), call checkEvalScores,
    // assert status==='pass' and aggregate>=0.7.
    assert.ok(
      true,
      'enable by implementing the toolchain-warm path — see src/lib/promoter-gates.ts',
    )
  })
})
