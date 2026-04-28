#!/usr/bin/env node
/**
 * Daily canary scan over `.evolve/runs.jsonl`.
 *
 * Filters runs to the trailing `--days N` window (default 7), runs all
 * three canaries, prints the report as JSON to stdout. Exits:
 *   - 0 when no alerts fire
 *   - 2 when one or more alerts fire (so a scheduler can flag without
 *     conflating with hard test failure exit code 1)
 *
 * Wired by `.github/workflows/canary-check.yml` daily at 09:30 UTC.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'

import { runCanaries, type CanaryReport } from '../src/lib/run-canaries.js'
import { validateRunRecord, type RunRecord } from '../src/lib/run-record.js'

interface Args {
  path: string
  days: number
  json: boolean
  /** When true: skip recency filtering and check the entire jsonl. */
  all: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    path: resolvePath(process.cwd(), '.evolve', 'runs.jsonl'),
    days: 7,
    json: true,
    all: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!
    if (a === '--days') {
      const next = argv[i + 1]
      const parsed = next === undefined ? Number.NaN : Number.parseInt(next, 10)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`--days requires a positive integer, got: ${next}`)
      }
      args.days = parsed
      i += 1
    } else if (a === '--path') {
      const next = argv[i + 1]
      if (next === undefined) throw new Error('--path requires a value')
      args.path = resolvePath(next)
      i += 1
    } else if (a === '--all') {
      args.all = true
    } else if (a === '--no-json') {
      args.json = false
    } else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'usage: canary-check [--days N] [--path .evolve/runs.jsonl] [--all] [--no-json]\n',
      )
      process.exit(0)
    } else {
      throw new Error(`unknown arg: ${a}`)
    }
  }
  return args
}

function readRunsSince(path: string, sinceMs: number, all: boolean): RunRecord[] {
  if (!existsSync(path)) return []
  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
  const out: RunRecord[] = []
  for (let i = 0; i < lines.length; i += 1) {
    let record: RunRecord
    try {
      record = validateRunRecord(JSON.parse(lines[i]!))
    } catch (e) {
      throw new Error(`runs.jsonl line ${i + 1}: ${(e as Error).message}`, { cause: e })
    }
    // RunRecord has no top-level timestamp; `wallMs` is duration, not
    // wall-clock. We rely on the file order being chronological (the
    // store appends and never reorders) and accept that `--days` is a
    // positional filter, not a timestamp filter, when timestamps are
    // unavailable. If timestamps are added later, swap in a real
    // recency filter.
    out.push(record)
  }
  if (all) return out
  // Take the trailing N records by line position. The default
  // `--days 7` × ~30 runs/day ≈ 210 trailing records — match that.
  const approxPerDay = 30
  const trailingCount = Math.max(approxPerDay * sinceMs, 50)
  return out.slice(-trailingCount)
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const trailingCount = args.all ? 0 : args.days
  const runs = readRunsSince(args.path, trailingCount, args.all)

  const report: CanaryReport = runCanaries(runs, {
    silentStageFailure: { stage: 'typecheck', consecutiveThreshold: 3 },
    scoreDrift: { key: 'searchScore', historyWindow: 50, recentWindow: 20 },
    failureModeShift: {},
  })

  const summary = {
    path: args.path,
    runsScanned: runs.length,
    days: args.all ? 'all' : args.days,
    counts: report.counts,
    alerts: report.alerts,
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n')
  } else {
    process.stdout.write(
      `canary-check: scanned ${runs.length} run(s), ${report.alerts.length} alert(s)\n`,
    )
    for (const a of report.alerts) {
      process.stdout.write(`  [${a.severity}] ${a.kind}: ${a.message}\n`)
    }
  }

  process.exit(report.alerts.length > 0 ? 2 : 0)
}

main().catch((error: unknown) => {
  process.stderr.write(`canary-check: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
