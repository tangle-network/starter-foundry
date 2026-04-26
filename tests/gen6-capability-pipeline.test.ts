import assert from 'node:assert/strict'
import test from 'node:test'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const REPO = process.cwd()
const GAP_SCRIPT = join(REPO, 'scripts/detect-capability-gaps.ts')

// ── Gen 6 R6: capability gap detector contract ───────────────────────

test('detect-capability-gaps: emits parseable JSON with ProposeCapabilityInput-shaped candidates', () => {
  const res = spawnSync('node', [GAP_SCRIPT, '--json', '--top', '3'], { cwd: REPO, encoding: 'utf8' })
  assert.equal(res.status, 0, `gap detector failed: ${res.stderr}`)
  const parsed = JSON.parse(res.stdout) as {
    topN: number
    candidates: Array<{
      id: string
      description: string
      appliesTo: string[]
      slotFiles: string[]
      priority: number
      occurrences: number
      uncoveredTokens: string[]
      productCues: string[]
    }>
  }
  assert.ok(Array.isArray(parsed.candidates), 'must emit candidates[]')
  assert.ok(parsed.candidates.length <= 3)
  for (const c of parsed.candidates) {
    assert.match(c.id, /^[a-z][a-z0-9-]*$/, `id ${c.id} must be kebab-case`)
    assert.ok(c.description.length >= 10, 'description too short')
    assert.ok(Array.isArray(c.appliesTo) && c.appliesTo.length > 0, 'appliesTo must be non-empty')
    assert.ok(Array.isArray(c.slotFiles) && c.slotFiles.length >= 2, 'slotFiles must have ≥2 entries')
    assert.ok(c.priority >= 0 && c.priority <= 1, `priority ${c.priority} out of [0,1]`)
    assert.ok(c.occurrences >= 1, `occurrences=${c.occurrences}`)
    assert.ok(Array.isArray(c.uncoveredTokens) && c.uncoveredTokens.length > 0, 'uncoveredTokens must be non-empty (that is the gap signal)')
    assert.ok(Array.isArray(c.productCues), 'productCues must be array')
  }
})

test('detect-capability-gaps: appliesTo families all exist in registry', () => {
  const res = spawnSync('node', [GAP_SCRIPT, '--json', '--top', '10', '--min-count', '3'], { cwd: REPO, encoding: 'utf8' })
  assert.equal(res.status, 0)
  const parsed = JSON.parse(res.stdout) as { candidates: Array<{ id: string; appliesTo: string[] }> }
  const existingFamilies = new Set(readdirSync(join(REPO, 'registry/families')))
  for (const c of parsed.candidates) {
    for (const fam of c.appliesTo) {
      assert.ok(existingFamilies.has(fam), `${c.id} claims appliesTo:${fam} but registry/families/${fam} doesn't exist`)
    }
  }
})

test('detect-capability-gaps: candidates are priority-sorted descending', () => {
  const res = spawnSync('node', [GAP_SCRIPT, '--json', '--top', '10'], { cwd: REPO, encoding: 'utf8' })
  assert.equal(res.status, 0)
  const parsed = JSON.parse(res.stdout) as { candidates: Array<{ priority: number }> }
  for (let i = 1; i < parsed.candidates.length; i++) {
    assert.ok(
      parsed.candidates[i]!.priority <= parsed.candidates[i - 1]!.priority,
      `candidates not sorted by priority at index ${i}`,
    )
  }
})

test('detect-capability-gaps: --min-count filters low-demand scenarios', () => {
  const res = spawnSync('node', [GAP_SCRIPT, '--json', '--top', '50', '--min-count', '5'], {
    cwd: REPO,
    encoding: 'utf8',
  })
  assert.equal(res.status, 0)
  const parsed = JSON.parse(res.stdout) as { candidates: Array<{ occurrences: number }> }
  for (const c of parsed.candidates) {
    assert.ok(c.occurrences >= 5, `min-count=5 but occurrences=${c.occurrences}`)
  }
})

test('detect-capability-gaps: never proposes a token that is already in a capability keyword', () => {
  // Smoke: uncoveredTokens should truly be uncovered by any cap's keywords.
  const res = spawnSync('node', [GAP_SCRIPT, '--json', '--top', '5'], { cwd: REPO, encoding: 'utf8' })
  const parsed = JSON.parse(res.stdout) as { candidates: Array<{ uncoveredTokens: string[] }> }

  // Build the real capability keyword set
  const capsDir = join(REPO, 'registry/layers/capability')
  const kw = new Set<string>()
  for (const id of readdirSync(capsDir)) {
    const mp = join(capsDir, id, 'manifest.json')
    if (!existsSync(mp)) continue
    try {
      const m = JSON.parse(readFileSync(mp, 'utf8')) as { keywords?: string[]; tieredKeywords?: { tier1?: string[]; tier2?: string[] } }
      for (const k of [...(m.keywords ?? []), ...(m.tieredKeywords?.tier1 ?? []), ...(m.tieredKeywords?.tier2 ?? [])]) {
        kw.add(String(k).toLowerCase())
      }
    } catch { /* skip */ }
  }

  for (const c of parsed.candidates) {
    for (const t of c.uncoveredTokens) {
      // The token shouldn't be covered by any capability keyword (substring-match semantic)
      for (const k of kw) {
        assert.ok(
          !(k === t || k.includes(t) || t.includes(k)),
          `uncoveredTokens claims "${t}" but capability keyword "${k}" covers it`,
        )
      }
    }
  }
})
