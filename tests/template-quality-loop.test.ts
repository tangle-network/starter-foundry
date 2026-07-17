// Regression test for the template-quality loop. Verifies each stage
// produces structurally-valid output without requiring an LLM key
// (deterministic fallback path is the contract-under-test).

import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'
import { harvest } from '../dist/training/template_v1/harvest.js'
import { synthesize } from '../dist/training/template_v1/synthesize.js'
import { judge } from '../dist/training/template_v1/judge.js'

const REWRITES_FIXTURE = join(process.cwd(), 'tests/fixtures/template-rewrites')

test('harvest: reads mined tuples and extracts patterns', () => {
  const h = harvest('src.App.tsx', REWRITES_FIXTURE)
  assert.ok(h.tupleCount > 0, `expected tuples for src.App.tsx, got ${h.tupleCount}`)
  assert.ok(h.templatePath.length > 0)
  assert.ok(Array.isArray(h.frequentlyAddedLines))
  assert.ok(Array.isArray(h.frequentImports))
  assert.ok(Array.isArray(h.samplesAfter))
  assert.ok(Array.isArray(h.editPatterns))
})

test('harvest: empty key returns zero tuples', () => {
  const h = harvest('does.not.exist', REWRITES_FIXTURE)
  assert.equal(h.tupleCount, 0)
})

test('synthesize: deterministic fallback produces a non-empty candidate', async () => {
  const h = harvest('src.App.tsx', REWRITES_FIXTURE)
  const current =
    'import React from "react"\n\n// leading comment\n// another comment\n// third comment\n\nexport default function App() { return null }'
  const s = await synthesize({
    templatePath: 'src/App.tsx',
    currentSource: current,
    harvest: h,
    familyId: 'react-vite-ts',
  })
  assert.ok(s.candidate.length > 0)
  assert.ok(s.mode === 'llm' || s.mode === 'deterministic')
  assert.ok(s.reasoning.length > 0)
})

test('judge: computes bounded composite score', async () => {
  const h = harvest('src.App.tsx', REWRITES_FIXTURE)
  const current = 'export default function App() { return null }'
  const candidate =
    'import { Button } from "@/components/ui/button"\nexport default function App() { return <Button>Go</Button> }'
  const j = judge({
    templatePath: 'src/App.tsx',
    currentSource: current,
    candidate,
    harvest: h,
  })
  assert.ok(j.score >= 0 && j.score <= 1, `score out of bounds: ${j.score}`)
  assert.ok(typeof j.reasoning === 'string' && j.reasoning.length > 0)
  for (const [dim, v] of Object.entries(j.dimensions)) {
    assert.ok(v >= 0 && v <= 1, `dim ${dim} out of bounds: ${v}`)
  }
})
