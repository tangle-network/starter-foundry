#!/usr/bin/env node
// Opens one PR per promotable template candidate found in
// .evolve/template-candidates/sweep-summary.json. Requires `gh` CLI
// authenticated. Skips if a PR with the same sweep-timestamp tag
// already exists (idempotent on re-runs within the same sweep).
//
// CI invocation:
//   node scripts/open-template-prs.mjs
// Dry-run (no PRs opened):
//   node scripts/open-template-prs.mjs --dry-run

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SUMMARY = join(REPO, '.evolve/template-candidates/sweep-summary.json')
const DRY_RUN = process.argv.includes('--dry-run')

if (!existsSync(SUMMARY)) {
  console.error('✗ no sweep-summary.json — run template-quality-sweep.mjs first')
  process.exit(2)
}

const summary = JSON.parse(readFileSync(SUMMARY, 'utf8'))
const promotable = (summary.results ?? []).filter((r) => r.report?.decision === 'promotable')

if (promotable.length === 0) {
  console.log('no promotable candidates in current sweep — nothing to PR')
  process.exit(0)
}

// Confirm we're on a clean branch + gh is available.
if (!DRY_RUN) {
  const ghCheck = spawnSync('gh', ['--version'], { encoding: 'utf8' })
  if (ghCheck.status !== 0) {
    console.error('✗ `gh` CLI not available — install + authenticate first')
    process.exit(2)
  }
}

for (const result of promotable) {
  const branchName = `template-sweep/${result.family}/${result.templateKey.replace(/\./g, '-')}-${Date.now().toString(36)}`
  const report = result.report
  const candidateText = (() => {
    // The candidate file sits alongside the report with the same timestamp.
    const reportName = `${result.templateKey}.${report.generatedAt.replace(/[:.]/g, '-')}.report.json`
    const candidateName = reportName.replace('.report.json', '.candidate')
    const candidatePath = join(REPO, '.evolve/template-candidates', candidateName)
    return existsSync(candidatePath) ? { path: candidatePath, name: candidateName } : null
  })()

  if (!candidateText) {
    console.log(`⚠ ${result.scaffoldFile}: report exists but candidate file missing — skip`)
    continue
  }

  console.log(`\n── PR: ${result.scaffoldFile} → ${result.family} ──`)
  console.log(`  branch: ${branchName}`)
  console.log(`  judge score: ${report.judge?.score?.toFixed?.(3) ?? '?'}`)

  if (DRY_RUN) {
    console.log(`  [dry-run] would branch + apply candidate + open PR`)
    continue
  }

  const cmds = [
    ['git', ['checkout', '-b', branchName]],
    // Apply candidate to the source template.
    [
      'node',
      [
        '-e',
        `require('fs').copyFileSync(${JSON.stringify(candidateText.path)}, ${JSON.stringify(join(REPO, result.sourcePath))})`,
      ],
    ],
    ['git', ['add', result.sourcePath]],
    [
      'git',
      [
        'commit',
        '-m',
        `template-sweep: propose ${result.templateKey} rewrite (score ${report.judge?.score?.toFixed?.(2) ?? '?'})`,
      ],
    ],
    ['git', ['push', 'origin', branchName]],
    [
      'gh',
      [
        'pr',
        'create',
        '--title',
        `template-sweep: ${result.templateKey} (score ${report.judge?.score?.toFixed?.(2) ?? '?'})`,
        '--body',
        [
          `## Automated template-quality sweep proposal`,
          ``,
          `- **Scaffold file**: \`${result.scaffoldFile}\``,
          `- **Family**: \`${result.family}\``,
          `- **Source template**: \`${result.sourcePath}\``,
          `- **Times rewritten**: ${result.timesRewritten}× across recent buildouts`,
          `- **Judge score**: ${report.judge?.score?.toFixed?.(3) ?? '?'}`,
          `- **Synthesizer mode**: ${report.synthesizer?.mode ?? '?'}`,
          `- **Audit**: ${report.audit?.ok ? '✓' : '✗'} (${report.audit?.stage ?? '?'})`,
          ``,
          `### Synthesizer reasoning`,
          `> ${(report.synthesizer?.reasoning ?? '').slice(0, 400)}`,
          ``,
          `### Judge dimensions`,
          Object.entries(report.judge?.dimensions ?? {})
            .map(([d, v]) => `- ${d}: ${typeof v === 'number' ? v.toFixed(3) : v}`)
            .join('\n'),
          ``,
          `---`,
          `_Opened by \`scripts/open-template-prs.mjs\` — part of the Branch 2 template-quality loop._`,
        ].join('\n'),
      ],
    ],
    ['git', ['checkout', '-']],
  ]

  let ok = true
  for (const [cmd, args] of cmds) {
    const proc = spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8', stdio: 'pipe' })
    if (proc.status !== 0) {
      console.error(`  ✗ \`${cmd} ${args.slice(0, 2).join(' ')}\` exit ${proc.status}`)
      console.error(`    stderr: ${(proc.stderr ?? '').slice(0, 300)}`)
      ok = false
      // Try to return to prior branch on failure.
      spawnSync('git', ['checkout', '-'], { cwd: REPO, encoding: 'utf8' })
      break
    }
  }
  if (ok) console.log(`  ✓ PR opened`)
}

console.log(`\n✓ opened PRs for ${promotable.length} promotable candidate(s)`)
