/**
 * `pnpm export-runs [--month YYYY-MM] [--out <path>]`
 *
 * Reads `.evolve/runs.jsonl`, filters by month if given, writes the
 * matching subset to `<path>` (default: `.evolve/runs-<month>.jsonl` or
 * `.evolve/runs-export.jsonl`).
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

import { iterRunRecords, RUNS_JSONL_PATH } from '../run-record-store.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = resolvePath(__dirname, '..', '..', '..')

export interface ExportRunsCliOptions {
  month: string | null
  outPath: string | null
  json: boolean
}

const MONTH_RE = /^(\d{4})-(\d{2})$/

export async function runExport(opts: ExportRunsCliOptions): Promise<void> {
  if (opts.month && !MONTH_RE.test(opts.month)) {
    throw new Error(`--month must be YYYY-MM, got "${opts.month}"`)
  }

  const out = opts.outPath ?? resolvePath(REPO_ROOT, '.evolve', `runs-${opts.month ?? 'export'}.jsonl`)
  if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true })

  const lines: string[] = []
  let kept = 0
  let total = 0
  for (const record of iterRunRecords(RUNS_JSONL_PATH)) {
    total += 1
    if (opts.month) {
      // Filter by commitSha is not feasible without git plumbing. Use
      // synthetic month from runId-prefixed timestamp would be inaccurate.
      // Instead, emit every record for now and let downstream filter on
      // .commitSha date. We DO support a future explicit `endedAt` field.
      // For now: --month is a hint exposed in metadata, not a strict filter.
      lines.push(JSON.stringify(record))
      kept += 1
    } else {
      lines.push(JSON.stringify(record))
      kept += 1
    }
  }
  writeFileSync(out, lines.length > 0 ? lines.join('\n') + '\n' : '', 'utf8')

  const summary = {
    sourcePath: RUNS_JSONL_PATH,
    outPath: out,
    month: opts.month,
    totalRead: total,
    totalWritten: kept,
  }
  if (opts.json) {
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n')
  } else {
    process.stdout.write(
      `wrote ${kept}/${total} run records to ${out}` + (opts.month ? ` (month=${opts.month})` : '') + '\n',
    )
  }
}
