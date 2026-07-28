import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { composeStarter } from '../dist/lib/compose.js'
import { createTempDir, readJson, removeDir } from '../dist/lib/fs.js'
import { loadProjectSpec } from '../dist/lib/registry.js'
import type { ComposeReport, ComposeSpec } from '../dist/types.js'

test('compose writes files and ownership report', async () => {
  const spec = await loadProjectSpec(path.resolve('specs/coinbase-landing.json'))
  const outDir = await createTempDir('starter-foundry-compose')

  try {
    const result = await composeStarter({ spec, outDir })
    const report = await readJson<ComposeReport>(result.composeReportPath)
    const indexHtml = await fs.readFile(path.join(outDir, 'index.html'), 'utf8')

    assert.equal(report.components.family, 'frontend-static')
    assert.deepEqual(report.components.layers, ['framework:web-static', 'capability:chart-widget'])
    assert.equal(report.components.partner, 'coinbase')
    assert.match(indexHtml, /Launch a Coinbase-ready growth surface/)
    assert.equal(report.fileOwnership['starter-brand.json'], 'coinbase')
  } finally {
    await removeDir(outDir)
  }
})

test('compose resolves dependency slots with spec overrides', async () => {
  const spec = await loadProjectSpec(path.resolve('specs/api-health.json'))
  const outDir = await createTempDir('starter-foundry-compose-slot')

  try {
    const result = await composeStarter({ spec, outDir })
    const report = await readJson<ComposeReport>(result.composeReportPath)
    const dbConfig = await fs.readFile(path.join(outDir, 'database-config.json'), 'utf8')

    assert.equal(report.components.slots.database, 'database:postgres')
    assert.match(dbConfig, /postgres/)
    assert.ok(report.components.layers.includes('database:postgres'))
  } finally {
    await removeDir(outDir)
  }
})

test('compose carries slot overrides and partner files into fullstack starters', async () => {
  const spec = await loadProjectSpec(path.resolve('specs/fullstack-control-plane.json'))
  const outDir = await createTempDir('starter-foundry-compose-fullstack')

  try {
    const result = await composeStarter({ spec, outDir })
    const report = await readJson<ComposeReport>(result.composeReportPath)
    const dbConfig = await fs.readFile(path.join(outDir, 'database-config.json'), 'utf8')
    const sdkConfig = await fs.readFile(path.join(outDir, 'sdk-config.json'), 'utf8')
    const authConfig = await fs.readFile(path.join(outDir, 'auth-config.json'), 'utf8')
    const paymentsConfig = await fs.readFile(path.join(outDir, 'payments-config.json'), 'utf8')
    const queueConfig = await fs.readFile(path.join(outDir, 'queue-config.json'), 'utf8')
    const brandConfig = await fs.readFile(path.join(outDir, 'starter-brand.json'), 'utf8')

    assert.equal(report.components.family, 'fullstack-ts')
    assert.equal(report.components.slots.database, 'database:convex')
    assert.equal(report.components.slots.sdk, 'sdk:coinbase-cdp')
    assert.equal(report.components.slots.auth, 'auth:clerk')
    assert.equal(report.components.slots.payments, 'payments:stripe')
    assert.equal(report.components.slots.queue, 'queue:bullmq')
    assert.ok(report.components.layers.includes('framework:fullstack-node-ts'))
    assert.ok(report.components.layers.includes('database:convex'))
    assert.ok(report.components.layers.includes('sdk:coinbase-cdp'))
    assert.match(dbConfig, /convex/)
    assert.match(sdkConfig, /coinbase-cdp/)
    assert.match(authConfig, /clerk/)
    assert.match(paymentsConfig, /stripe/)
    assert.match(queueConfig, /bullmq/)
    assert.match(brandConfig, /Coinbase/)
  } finally {
    await removeDir(outDir)
  }
})

// --- Variant system tests ---

test('variant selection is deterministic — same projectName produces same files', async () => {
  const spec: ComposeSpec = {
    projectName: 'variant-test-alpha',
    family: 'nextjs-ts',
    layers: [
      'framework:nextjs-app-router',
      'capability:tailwind',
      'capability:shadcn',
      'capability:layout-landing',
    ],
  }
  const outDir1 = await createTempDir('sf-variant-1')
  const outDir2 = await createTempDir('sf-variant-2')
  try {
    const r1 = await composeStarter({ spec, outDir: outDir1 })
    const r2 = await composeStarter({ spec, outDir: outDir2 })
    const hero1 = await fs.readFile(
      path.join(outDir1, 'src/components/landing/hero-section.tsx'),
      'utf8',
    )
    const hero2 = await fs.readFile(
      path.join(outDir2, 'src/components/landing/hero-section.tsx'),
      'utf8',
    )
    assert.equal(hero1, hero2, 'Same projectName should produce identical variant files')
    assert.deepEqual(r1.filesWritten, r2.filesWritten)
  } finally {
    await removeDir(outDir1)
    await removeDir(outDir2)
  }
})

test('variant selection differs for different projectNames', async () => {
  const names = [
    'alpha-project',
    'beta-project',
    'gamma-project',
    'delta-project',
    'epsilon-project',
  ]
  const personalizeContents = new Set<string>()
  for (const name of names) {
    const spec: ComposeSpec = {
      projectName: name,
      family: 'nextjs-ts',
      layers: [
        'framework:nextjs-app-router',
        'capability:tailwind',
        'capability:shadcn',
        'capability:layout-landing',
      ],
    }
    const outDir = await createTempDir(`sf-variant-${name}`)
    try {
      await composeStarter({ spec, outDir })
      const json = await fs.readFile(path.join(outDir, 'src/personalize.json'), 'utf8')
      personalizeContents.add(json)
    } finally {
      await removeDir(outDir)
    }
  }
  assert.ok(
    personalizeContents.size > 1,
    `Expected variant diversity across ${names.length} project names, got ${personalizeContents.size} unique personalize.json outputs`,
  )
})

test('layers without variants still use files/ directory', async () => {
  const spec: ComposeSpec = {
    projectName: 'no-variant-test',
    family: 'nextjs-ts',
    layers: [
      'framework:nextjs-app-router',
      'capability:tailwind',
      'capability:shadcn',
      'capability:layout-auth',
    ],
  }
  const outDir = await createTempDir('sf-no-variant')
  try {
    const result = await composeStarter({ spec, outDir })
    assert.ok(
      result.filesWritten.includes('app/sign-in/page.tsx'),
      'layout-auth should compose from files/ without variants',
    )
  } finally {
    await removeDir(outDir)
  }
})
