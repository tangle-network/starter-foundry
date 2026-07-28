/**
 * Atomic append-only writer for `.evolve/runs.jsonl`.
 *
 * - Validates each record (so a bare-alias slip never lands on disk)
 * - Appends one JSON object per line
 * - Uses `O_APPEND` (Node's `appendFileSync` is `O_APPEND`-flagged) so
 *   concurrent writers don't tear lines on POSIX
 *
 * The store is intentionally tiny: substrate, not service. Higher-level
 * call sites (auto-loop, propose-*, audit) compose against it.
 *
 * @public
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateRunRecord, type RunRecord } from '@tangle-network/agent-eval'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = resolvePath(__dirname, '..', '..')

export const RUNS_JSONL_PATH = resolvePath(REPO_ROOT, '.evolve', 'runs.jsonl')

/** Append a record to `.evolve/runs.jsonl`. Throws on validation failure. */
export function appendRunRecord(record: RunRecord, path: string = RUNS_JSONL_PATH): void {
  validateRunRecord(record)
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  appendFileSync(path, JSON.stringify(record) + '\n', 'utf8')
}

/** Read every record. Returns empty array when the file is missing. */
export function readRunRecords(path: string = RUNS_JSONL_PATH): RunRecord[] {
  if (!existsSync(path)) return []
  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
  return lines.map((line, idx) => {
    try {
      return validateRunRecord(JSON.parse(line))
    } catch (e) {
      throw new Error(`${path} line ${idx + 1}: ${(e as Error).message}`, { cause: e })
    }
  })
}

/** Stream-style read (yields one record at a time). For large files. */
export function* iterRunRecords(path: string = RUNS_JSONL_PATH): Generator<RunRecord> {
  if (!existsSync(path)) return
  const lines = readFileSync(path, 'utf8').split('\n')
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx]
    if (!line.trim()) continue
    try {
      yield validateRunRecord(JSON.parse(line))
    } catch (e) {
      throw new Error(`${path} line ${idx + 1}: ${(e as Error).message}`, { cause: e })
    }
  }
}
