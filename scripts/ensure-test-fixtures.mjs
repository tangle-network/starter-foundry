#!/usr/bin/env node
// Seed .evolve/traces/buildouts.jsonl from tests/fixtures/ when no mined
// data is present. Lets integration tests that depend on the trace file
// run deterministically on fresh clones (CI, new dev machine) without
// requiring Claude Code session history.
//
// If the real trace file already exists, do nothing — miner output always
// wins over the synthetic fixture.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE = join(REPO, 'tests/fixtures/buildouts.jsonl')
const TARGET = join(REPO, '.evolve/traces/buildouts.jsonl')

if (existsSync(TARGET)) {
  process.exit(0)
}

if (!existsSync(FIXTURE)) {
  console.error(`[ensure-test-fixtures] missing fixture at ${FIXTURE}`)
  process.exit(1)
}

mkdirSync(dirname(TARGET), { recursive: true })
copyFileSync(FIXTURE, TARGET)
console.log(`[ensure-test-fixtures] seeded ${TARGET} from tests/fixtures/buildouts.jsonl`)
