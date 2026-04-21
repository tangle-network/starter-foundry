// Chaos: emitBuildoutEvent under concurrent writers + adversarial inputs.
// Extends the Branch 10 resilience surface in tests/chaos.test.ts with
// specific invariants on the buildout-traces append path.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { emitBuildoutEvent } from '../dist/lib/buildout-traces.js'

describe('chaos: emitBuildoutEvent concurrent writers', () => {
  it('20 concurrent emits produce 20 parseable JSONL lines', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sf-chaos-'))
    const tracesPath = join(dir, 'buildouts.jsonl')
    try {
      const emits = []
      for (let i = 0; i < 20; i++) {
        emits.push(
          emitBuildoutEvent(
            {
              sessionId: `s${i}`,
              sourceModel: 'chaos-test',
              sourcePath: `/tmp/s${i}`,
              scenarioId: `scenario-${i}`,
              initialPrompt: 'x'.repeat(500),
            },
            { path: tracesPath },
          ),
        )
      }
      await Promise.all(emits)
      const content = readFileSync(tracesPath, 'utf8')
      const lines = content.split('\n').filter(Boolean)
      assert.equal(lines.length, 20, `expected 20 lines, got ${lines.length}`)
      for (const line of lines) {
        assert.doesNotThrow(() => JSON.parse(line), `malformed line: ${line.slice(0, 80)}`)
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects missing sessionId with no partial write', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sf-chaos-'))
    const tracesPath = join(dir, 'buildouts.jsonl')
    try {
      await assert.rejects(
        () =>
          emitBuildoutEvent(
            { sessionId: '', sourceModel: 'test', sourcePath: '/x' },
            { path: tracesPath },
          ),
        /sessionId/,
      )
      if (existsSync(tracesPath)) {
        assert.equal(readFileSync(tracesPath, 'utf8'), '', 'no partial write on rejection')
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
