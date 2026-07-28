import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FAMILIES = ['sandbox-app-ts', 'agent-debug-ui-ts', 'agent-with-ui-ts'] as const

function familyPath(family: (typeof FAMILIES)[number], ...parts: string[]): string {
  return join(REPO, 'registry/families', family, ...parts)
}

function sourceFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root)) {
    const path = join(root, entry)
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path))
    else if (/\.[cm]?[jt]sx?$/.test(entry)) files.push(path)
  }
  return files
}

test('browser templates cannot import the server-only Sandbox SDK or Vite-expose keys', () => {
  for (const family of FAMILIES) {
    const browserInputs = [
      ...sourceFiles(familyPath(family, 'files/src')),
      familyPath(family, 'files/vite.config.ts'),
    ]
    for (const path of browserInputs) {
      const source = readFileSync(path, 'utf8')
      assert.doesNotMatch(
        source,
        /(?:from\s+|import\s*\(|require\s*\()\s*['"]@tangle-network\/sandbox(?:\/[^'"]*)?['"]/,
        `${family} browser source imports the server-only Sandbox SDK: ${path}`,
      )
      assert.doesNotMatch(
        source,
        /VITE_[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)/,
        `${family} browser source exposes a credential through Vite: ${path}`,
      )
    }

    const viteConfig = readFileSync(familyPath(family, 'files/vite.config.ts'), 'utf8')
    assert.match(viteConfig, /loadEnv\(mode, process\.cwd\(\), 'API_PORT'\)/)

    const env = readFileSync(familyPath(family, 'files/.env.example'), 'utf8')
    assert.match(env, /^TANGLE_SANDBOX_API_KEY=/m)
    assert.doesNotMatch(env, /^VITE_[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)=/m)

    const server = readFileSync(familyPath(family, 'files/server/index.ts'), 'utf8')
    assert.match(server, /from '@tangle-network\/sandbox'/)
    assert.match(server, /requiredEnv\('TANGLE_SANDBOX_API_KEY'\)/)
    assert.match(server, /process\.env\.HOST\?\.trim\(\) \|\| '127\.0\.0\.1'/)
  }
})

test('generated full-stack templates declare and build both browser and server entrypoints', () => {
  for (const family of FAMILIES) {
    const pkg = JSON.parse(readFileSync(familyPath(family, 'files/package.json'), 'utf8')) as {
      scripts: Record<string, string>
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }
    assert.match(pkg.scripts.build, /vite build/)
    assert.match(pkg.scripts.build, /tsconfig\.server\.json/)
    assert.equal(pkg.scripts.start, 'node server-dist/index.js')
    assert.equal(pkg.dependencies['@tangle-network/sandbox'], '0.15.2')
    assert.equal(pkg.dependencies['@hono/node-server'], '2.0.10')
    assert.ok(pkg.dependencies.hono)
    assert.ok(pkg.devDependencies['@types/node'])

    const manifest = JSON.parse(readFileSync(familyPath(family, 'manifest.json'), 'utf8')) as {
      files: Array<{ target: string }>
      validationChecks: Array<{ type: string; path?: string }>
    }
    const targets = new Set(manifest.files.map((file) => file.target))
    assert.ok(targets.has('.env.example'), `${family} must emit .env.example`)
    assert.ok(targets.has('server/index.ts'), `${family} must emit server/index.ts`)
    assert.ok(targets.has('tsconfig.node.json'), `${family} must emit Vite config tsconfig`)
    assert.ok(targets.has('tsconfig.server.json'), `${family} must emit server tsconfig`)
    assert.ok(
      manifest.validationChecks.some(
        (check) => check.type === 'file-exists' && check.path === 'server/index.ts',
      ),
      `${family} must validate its server entrypoint`,
    )
  }
})

test('agent-with-ui declares its state-store peers and Stop closes the active message', () => {
  const pkg = JSON.parse(
    readFileSync(familyPath('agent-with-ui-ts', 'files/package.json'), 'utf8'),
  ) as { dependencies: Record<string, string> }
  assert.equal(pkg.dependencies['@nanostores/react'], '^1.1.0')
  assert.equal(pkg.dependencies.nanostores, '^1.4.1')

  const app = readFileSync(familyPath('agent-with-ui-ts', 'files/src/App.tsx'), 'utf8')
  assert.match(app, /active\.controller\.abort\(\)/)
  assert.match(app, /completeAssistantMessage\(\{ messageId: active\.messageId \}\)/)
  assert.match(app, /activeRunRef\.current\?\.controller === controller/)
  assert.match(app, /onCancel=\{handleCancel\}/)
})

test('sandbox UI styles use the package export instead of the removed deep path', () => {
  for (const family of ['sandbox-app-ts', 'agent-with-ui-ts'] as const) {
    const css = readFileSync(familyPath(family, 'files/src/index.css'), 'utf8')
    assert.match(css, /@tangle-network\/sandbox-ui\/styles'/)
    assert.doesNotMatch(css, /@tangle-network\/sandbox-ui\/styles\.css/)
  }
})
