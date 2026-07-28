#!/usr/bin/env node
/**
 * CI invariant: every record in `.evolve/runs.jsonl` must have a pinned
 * `<alias>@<snapshot>` model field. Defense-in-depth — appendRunRecord()
 * already validates, this catches manual edits + migrations that drift.
 *
 * Exits 0 on clean, 1 on any bare alias.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'

import { modelHasSnapshot } from '@tangle-network/agent-eval'

const path = process.argv[2] ?? resolvePath(process.cwd(), '.evolve', 'runs.jsonl')

if (!existsSync(path)) {
  console.log(`check-bare-alias: ${path} not found — nothing to check`)
  process.exit(0)
}

const lines = readFileSync(path, 'utf8')
  .split('\n')
  .filter((l) => l.trim().length > 0)
const violations: Array<{ line: number; runId: string; model: string; splitTag: string }> = []

for (let i = 0; i < lines.length; i += 1) {
  let record: { runId?: string; model?: string; splitTag?: string }
  try {
    record = JSON.parse(lines[i])
  } catch (e) {
    console.error(`check-bare-alias: line ${i + 1} not valid JSON: ${(e as Error).message}`)
    process.exit(1)
  }
  const { model, splitTag, runId } = record
  if (typeof model !== 'string') {
    violations.push({
      line: i + 1,
      runId: runId ?? '?',
      model: '(missing)',
      splitTag: splitTag ?? '?',
    })
    continue
  }
  if (!modelHasSnapshot(model)) {
    violations.push({ line: i + 1, runId: runId ?? '?', model, splitTag: splitTag ?? '?' })
  }
}

if (violations.length > 0) {
  console.error(`check-bare-alias: ${violations.length} bare-alias violation(s) in ${path}:`)
  for (const v of violations) {
    console.error(`  line ${v.line} runId=${v.runId} splitTag=${v.splitTag} model="${v.model}"`)
  }
  process.exit(1)
}

console.log(`check-bare-alias: ${lines.length} record(s) clean`)
