import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const REPO = process.cwd()
const GAP_SCRIPT = join(REPO, 'scripts/detect-family-gaps.ts')
const PROMOTE_SCRIPT = join(REPO, 'scripts/promote-family-proposal.ts')
const BUILDOUT_FIXTURE = join(REPO, 'tests/fixtures/buildouts.jsonl')

function gapArgs(...args: string[]): string[] {
  return [GAP_SCRIPT, '--traces', BUILDOUT_FIXTURE, ...args]
}

// ── gap detector contract tests ─────────────────────────────────────

test('detect-family-gaps: emits parseable JSON with candidate shape', () => {
  const res = spawnSync('node', gapArgs('--json', '--top', '3'), {
    cwd: REPO,
    encoding: 'utf8',
  })
  assert.equal(res.status, 0, `gap detector failed: ${res.stderr}`)
  const parsed = JSON.parse(res.stdout) as {
    topN: number
    candidates: Array<{
      id: string
      description: string
      taxonomy: { language: string; runtime: string; surface: string }
      priority: number
      cues: string[]
      occurrences: number
    }>
  }
  assert.ok(Array.isArray(parsed.candidates), 'must emit candidates[]')
  assert.ok(parsed.candidates.length <= 3, `--top 3 returned ${parsed.candidates.length} > 3`)
  for (const c of parsed.candidates) {
    assert.match(c.id, /^[a-z][a-z0-9-]*$/, `id ${c.id} must be kebab-case`)
    assert.ok(c.description.length >= 10, `description too short: ${c.description}`)
    assert.ok(c.taxonomy.language, 'taxonomy.language missing')
    assert.ok(c.taxonomy.runtime, 'taxonomy.runtime missing')
    assert.ok(c.taxonomy.surface, 'taxonomy.surface missing')
    assert.ok(c.priority >= 0 && c.priority <= 1, `priority ${c.priority} out of [0,1]`)
    assert.ok(Array.isArray(c.cues), 'cues must be array')
    assert.ok(c.occurrences >= 1, `occurrences=${c.occurrences} < 1`)
  }
})

test('detect-family-gaps: --min-count filters low-demand scenarios', () => {
  const res = spawnSync('node', gapArgs('--json', '--top', '50', '--min-count', '3'), {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, STARTER_FOUNDRY_SYNTHETIC_RUN: '1' },
  })
  assert.equal(res.status, 0)
  const parsed = JSON.parse(res.stdout) as { candidates: Array<{ occurrences: number }> }
  for (const c of parsed.candidates) {
    assert.ok(c.occurrences >= 3, `min-count=3 but occurrences=${c.occurrences}`)
  }
})

test('detect-family-gaps: candidates are priority-sorted descending', () => {
  const res = spawnSync('node', gapArgs('--json', '--top', '10'), {
    cwd: REPO,
    encoding: 'utf8',
  })
  assert.equal(res.status, 0)
  const parsed = JSON.parse(res.stdout) as { candidates: Array<{ priority: number }> }
  for (let i = 1; i < parsed.candidates.length; i++) {
    assert.ok(
      parsed.candidates[i]!.priority <= parsed.candidates[i - 1]!.priority,
      `candidates not sorted by priority at index ${i}`,
    )
  }
})

// ── promoter contract tests ─────────────────────────────────────────

test('promote-family-proposal: rejects manifest with TODO placeholders at schema gate', () => {
  const fixtureId = `test-todo-reject-${Math.random().toString(36).slice(2, 8)}`
  const draftDir = join(REPO, '.evolve/family-proposals', fixtureId)
  mkdirSync(join(draftDir, 'files'), { recursive: true })
  writeFileSync(
    join(draftDir, 'manifest.json'),
    JSON.stringify({
      id: fixtureId,
      description: 'TODO: describe this family — this placeholder must trip the gate',
      tags: ['test'],
      taxonomy: { language: 'typescript', runtime: 'node', surface: 'frontend' },
      defaults: { projectType: 'frontend' },
      files: [],
    }, null, 2),
  )
  writeFileSync(
    join(draftDir, 'framework.manifest.json'),
    JSON.stringify({ id: fixtureId, description: 'test', appliesTo: [fixtureId], files: [] }, null, 2),
  )

  try {
    const res = spawnSync('node', [PROMOTE_SCRIPT, '--id', fixtureId, '--no-pr'], {
      cwd: REPO,
      encoding: 'utf8',
      env: { ...process.env, STARTER_FOUNDRY_SYNTHETIC_RUN: '1' },
    })
    assert.equal(res.status, 0, `promoter should exit 0 on schema reject (not crash): ${res.stderr}`)
    assert.match(res.stdout, /schema-fail/, 'output must mention schema-fail gate')
    // validation-errors.json written to draft dir
    const errPath = join(draftDir, 'validation-errors.json')
    assert.ok(existsSync(errPath), `validation-errors.json missing at ${errPath}`)
    const err = JSON.parse(readFileSync(errPath, 'utf8'))
    assert.equal(err.gate, 'schema', 'gate must be schema for TODO rejection')
    const errorsText = JSON.stringify(err.errors)
    assert.match(errorsText, /TODO/, 'error message must mention TODO placeholders')
    // registry not touched
    assert.ok(!existsSync(join(REPO, 'registry/families', fixtureId)), 'registry must not be written on schema fail')
  } finally {
    rmSync(draftDir, { recursive: true, force: true })
    rmSync(join(REPO, 'registry/families', fixtureId), { recursive: true, force: true })
    rmSync(join(REPO, 'registry/layers/framework', fixtureId), { recursive: true, force: true })
  }
})

test('promote-family-proposal: rejects manifest.id mismatch at schema gate', () => {
  const fixtureId = `test-id-mismatch-${Math.random().toString(36).slice(2, 8)}`
  const draftDir = join(REPO, '.evolve/family-proposals', fixtureId)
  mkdirSync(join(draftDir, 'files'), { recursive: true })
  writeFileSync(
    join(draftDir, 'manifest.json'),
    JSON.stringify({
      id: 'wrong-id-not-matching',
      description: 'valid description that is more than twenty characters long to pass the length gate',
      tags: ['test'],
      taxonomy: { language: 'typescript', runtime: 'node', surface: 'frontend' },
      defaults: { projectType: 'frontend' },
      files: [],
    }, null, 2),
  )

  try {
    const res = spawnSync('node', [PROMOTE_SCRIPT, '--id', fixtureId, '--no-pr'], {
      cwd: REPO,
      encoding: 'utf8',
      env: { ...process.env, STARTER_FOUNDRY_SYNTHETIC_RUN: '1' },
    })
    assert.equal(res.status, 0)
    const errPath = join(draftDir, 'validation-errors.json')
    assert.ok(existsSync(errPath))
    const err = JSON.parse(readFileSync(errPath, 'utf8'))
    assert.equal(err.gate, 'schema')
    assert.match(JSON.stringify(err.errors), /id mismatch/, 'must flag id mismatch')
  } finally {
    rmSync(draftDir, { recursive: true, force: true })
  }
})

test('promote-family-proposal: --all scans existing drafts without error', () => {
  // This runs against whatever's in .evolve/family-proposals/. The promoter
  // must exit 0 even when drafts fail — we're testing the scan loop itself.
  const res = spawnSync('node', [PROMOTE_SCRIPT, '--all', '--no-pr', '--dry-run'], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, STARTER_FOUNDRY_SYNTHETIC_RUN: '1' },
  })
  assert.equal(res.status, 0, `--all should exit 0: ${res.stderr}`)
  assert.match(res.stdout, /promotion summary/, 'must print summary line')
})

test('promote-family-proposal: missing draft dir exits cleanly with informative error', () => {
  const res = spawnSync('node', [PROMOTE_SCRIPT, '--id', 'definitely-nonexistent-draft-xyz123', '--no-pr'], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, STARTER_FOUNDRY_SYNTHETIC_RUN: '1' },
  })
  assert.equal(res.status, 0)
  assert.match(res.stdout, /no-draft|missing manifest/, 'must report missing manifest')
})

// ── Candidate-shape contract (for nightly feedback closure) ─────────

test('gap candidates → propose input shape: taxonomy fields are non-empty strings', () => {
  const res = spawnSync('node', gapArgs('--json', '--top', '5'), {
    cwd: REPO,
    encoding: 'utf8',
  })
  const parsed = JSON.parse(res.stdout) as { candidates: Array<{ taxonomy: { language: string; runtime: string; surface: string } }> }
  for (const c of parsed.candidates) {
    assert.ok(typeof c.taxonomy.language === 'string' && c.taxonomy.language.length > 0)
    assert.ok(typeof c.taxonomy.runtime === 'string' && c.taxonomy.runtime.length > 0)
    assert.ok(typeof c.taxonomy.surface === 'string' && c.taxonomy.surface.length > 0)
  }
})
