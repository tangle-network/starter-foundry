// Regression tests for brand/visual-regression/multi-propose primitives.

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { generateBrand, brandToPersonalizeJson, brandToPersonalizeCss } from '../dist/lib/brand/index.js'
import { snapshot, diff } from '../dist/lib/visual-regression.js'
import { multiPropose } from '../dist/training/template_v1/multi-propose.js'
import { harvest } from '../dist/training/template_v1/harvest.js'
import { createTempDir, removeDir } from '../dist/lib/fs.js'

test('brand: deterministic fallback produces a complete BrandKit', async () => {
  const kit = await generateBrand({ prompt: 'Build an inventory dashboard for small grocery stores', industry: 'fintech' })
  assert.ok(kit.brandName.length > 0)
  assert.ok(kit.tagline.length > 0)
  assert.ok(['formal', 'casual', 'technical', 'playful', 'neutral'].includes(kit.voice))
  assert.ok(/\d+\s+\d+%\s+\d+%/.test(kit.palette.primary), 'primary must be HSL triplet')
  assert.equal(kit.source, 'deterministic')
})

test('brand: serializes to personalize.json + personalize.css correctly', async () => {
  const kit = await generateBrand({ prompt: 'Build a crypto portfolio tracker', industry: 'crypto' })
  const json = brandToPersonalizeJson(kit)
  assert.ok(typeof (json as { brand: { name: string } }).brand.name === 'string')
  const css = brandToPersonalizeCss(kit)
  assert.match(css, /--color-primary:/)
  assert.match(css, /--font-sans:/)
})

test('visual-regression: snapshot + diff detects added/changed/removed files', async () => {
  const dir = await createTempDir('sf-visual-test')
  try {
    await fs.writeFile(path.join(dir, 'index.html'), '<html><body>initial</body></html>')
    await fs.writeFile(path.join(dir, 'src'), '') // to be overwritten
    await fs.rm(path.join(dir, 'src'))
    await fs.mkdir(path.join(dir, 'src'))
    await fs.writeFile(path.join(dir, 'src/main.ts'), 'console.log("v1")')
    const before = await snapshot(dir, 'visual-regression-test')
    assert.ok(before.files.length >= 1)

    await fs.writeFile(path.join(dir, 'src/main.ts'), 'console.log("v2")')
    await fs.writeFile(path.join(dir, 'src/styles.css'), 'body { color: red }')
    const after = await snapshot(dir, 'visual-regression-test')

    const d = diff(before, after)
    assert.ok(d.changed.length > 0 || d.added.length > 0, 'expected at least one change or add')
    assert.ok(d.changed.some((c) => c.path === 'src/main.ts'))
    assert.ok(d.added.some((p) => p === 'src/styles.css'))
  } finally {
    await removeDir(dir)
  }
})

test('multi-propose: runs N proposers and picks the highest-scoring', async () => {
  const h = harvest('src.App.tsx')
  if (h.tupleCount < 3) {
    // Skip gracefully on fresh checkouts without mined tuples.
    return
  }
  const result = await multiPropose({
    templatePath: 'src/App.tsx',
    currentSource: 'export default function App() { return null }',
    harvest: h,
    familyId: 'react-vite-ts',
    proposerCount: 3,
  })
  assert.equal(result.proposerCount, 3)
  assert.ok(result.winner.score.score >= 0)
  assert.ok(result.runnerUps.length === 2)
  // Winner must be the highest.
  for (const r of result.runnerUps) {
    assert.ok(result.winner.score.score >= r.score.score)
  }
})
