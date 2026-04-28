/**
 * `pnpm refresh-snapshots [--check | --apply]`
 *
 * `--check` (default) — verify the lock against the live API; warn within
 * 30 days of deprecation, fail past deprecation. Read-only.
 *
 * `--apply` — call the live API and overwrite `.evolve/snapshots.lock.json`
 * with the resolved snapshots. Operator-only (CODEOWNERS).
 */

import { refreshSnapshots } from '../snapshot-resolver.js'

export interface RefreshCliOptions {
  check: boolean
  apply: boolean
  json: boolean
}

export async function runRefreshSnapshots(opts: RefreshCliOptions): Promise<number> {
  if (opts.check && opts.apply) {
    process.stderr.write('refresh-snapshots: --check and --apply are mutually exclusive\n')
    return 2
  }
  // Default behaviour: --check.
  const mode = opts.apply ? 'apply' : 'check'
  const report = await refreshSnapshots({ check: !opts.apply, apply: opts.apply })

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  } else {
    process.stdout.write(`mode: ${mode}\n`)
    if (report.entries.length === 0) {
      process.stdout.write(
        '(empty lock — seed roles with `seedRoles` from src/lib/snapshot-resolver.ts before --apply)\n',
      )
    }
    for (const e of report.entries) {
      const tag = e.status === 'unchanged' ? '·' : e.status === 'updated' ? '↑' : '!'
      process.stdout.write(
        `  ${tag} ${e.logicalName} (${e.alias}): ${e.oldSnapshot ?? '(none)'} → ${e.newSnapshot ?? '(none)'}` +
          (e.daysUntilDeprecation !== null ? ` [deprecates in ${e.daysUntilDeprecation}d]` : '') +
          '\n',
      )
    }
    for (const w of report.warnings) process.stderr.write(`warn: ${w}\n`)
    for (const e of report.errors) process.stderr.write(`err:  ${e}\n`)
  }
  return report.ok ? 0 : 1
}
