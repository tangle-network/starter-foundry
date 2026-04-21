// Regression tests for STARTER_FOUNDRY_DIVERSE_SERVE env flag.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { selectTemplateVersion } from '../dist/lib/selection.js'

function setup(family: string, index: object): string {
  const root = mkdtempSync(join(tmpdir(), 'sf-diverse-'))
  const dir = join(root, '.evolve', 'template-library', family)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '_index.json'), JSON.stringify(index))
  return root
}

describe('selectTemplateVersion — diverse-serve flag', () => {
  it('returns `current` when env unset (default behavior)', () => {
    const root = setup('react-vite-ts', {
      family: 'react-vite-ts',
      current: 'v_aaa',
      topN: ['v_aaa', 'v_bbb', 'v_ccc'],
    })
    try {
      const v = selectTemplateVersion('react-vite-ts', 'my-project', {
        repoRoot: root,
        envDiverseServe: undefined,
      })
      assert.equal(v, 'v_aaa')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('returns `current` when env=0', () => {
    const root = setup('react-vite-ts', {
      family: 'react-vite-ts',
      current: 'v_aaa',
      topN: ['v_aaa', 'v_bbb', 'v_ccc'],
    })
    try {
      const v = selectTemplateVersion('react-vite-ts', 'my-project', {
        repoRoot: root,
        envDiverseServe: '0',
      })
      assert.equal(v, 'v_aaa')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('picks from topN deterministically when env=1', () => {
    const root = setup('react-vite-ts', {
      family: 'react-vite-ts',
      current: 'v_aaa',
      topN: ['v_aaa', 'v_bbb', 'v_ccc'],
    })
    try {
      // Same seed → same pick, always.
      const a = selectTemplateVersion('react-vite-ts', 'my-project', {
        repoRoot: root, envDiverseServe: '1',
      })
      const b = selectTemplateVersion('react-vite-ts', 'my-project', {
        repoRoot: root, envDiverseServe: '1',
      })
      assert.equal(a, b)
      assert.ok(['v_aaa', 'v_bbb', 'v_ccc'].includes(a!))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('different seeds spread across topN', () => {
    const root = setup('react-vite-ts', {
      family: 'react-vite-ts',
      current: 'v_aaa',
      topN: ['v_aaa', 'v_bbb', 'v_ccc'],
    })
    try {
      const picks = new Set<string>()
      for (let i = 0; i < 30; i++) {
        picks.add(selectTemplateVersion('react-vite-ts', `proj-${i}`, {
          repoRoot: root, envDiverseServe: '1',
        })!)
      }
      // At least 2 of 3 versions should appear across 30 seeds (birthday-style).
      assert.ok(picks.size >= 2, `expected >=2 versions across 30 seeds, got ${picks.size}`)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('returns null when no _index.json exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'sf-diverse-'))
    try {
      const v = selectTemplateVersion('nonexistent-family', 'seed', {
        repoRoot: root, envDiverseServe: '1',
      })
      assert.equal(v, null)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('falls back to `current` when topN is empty', () => {
    const root = setup('react-vite-ts', {
      family: 'react-vite-ts',
      current: 'v_only',
      topN: [],
    })
    try {
      const v = selectTemplateVersion('react-vite-ts', 'seed', {
        repoRoot: root, envDiverseServe: '1',
      })
      assert.equal(v, 'v_only')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('accepts env=true alongside env=1', () => {
    const root = setup('react-vite-ts', {
      family: 'react-vite-ts',
      current: 'v_aaa',
      topN: ['v_aaa', 'v_bbb'],
    })
    try {
      const a = selectTemplateVersion('react-vite-ts', 'x', {
        repoRoot: root, envDiverseServe: '1',
      })
      const b = selectTemplateVersion('react-vite-ts', 'x', {
        repoRoot: root, envDiverseServe: 'true',
      })
      assert.equal(a, b)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
