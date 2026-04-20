// run.ts — orchestrate harvest → synthesize → judge → audit → emit-candidate.
// CLI:
//   pnpm tsx src/training/template_v1/run.ts --template-key src.App.tsx --family react-vite-ts --template-target src/App.tsx --source-path registry/layers/framework/react-vite-ts/files/App.tsx [--apply] [--dry-run]
//
// Does NOT auto-merge. Writes the candidate + judge report under
// .evolve/template-candidates/ for human review. --apply copies the
// candidate over the source template only if --yes is also passed.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { harvest } from './harvest.js'
import { synthesize } from './synthesize.js'
import { judge } from './judge.js'
import { audit } from './audit.js'
import type { ComposeSpec } from '../../types.js'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const CANDIDATES_DIR = join(REPO, '.evolve/template-candidates')

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const flag = (name: string): boolean => process.argv.includes(name)

async function main(): Promise<void> {
  const templateKey = arg('--template-key')
  const family = arg('--family')
  const templateTarget = arg('--template-target')
  const sourcePath = arg('--source-path')

  if (!templateKey || !family || !templateTarget || !sourcePath) {
    console.error(
      'usage: --template-key <e.g. src.App.tsx> --family <id> --template-target <path in scaffold> --source-path <repo path to the canonical template source> [--dry-run] [--apply --yes]',
    )
    process.exit(2)
  }

  const absoluteSource = resolve(REPO, sourcePath)
  if (!existsSync(absoluteSource)) {
    console.error(`source template not found: ${absoluteSource}`)
    process.exit(2)
  }
  const currentSource = readFileSync(absoluteSource, 'utf8')

  console.log(`harvesting: ${templateKey}`)
  const h = harvest(templateKey)
  console.log(`  ${h.tupleCount} tuples (${h.writeCount} writes, ${h.editCount} edits)`)
  console.log(`  ${h.frequentlyAddedLines.length} frequently-added lines`)
  console.log(`  ${h.frequentImports.length} frequent imports`)

  if (h.tupleCount < 3) {
    console.log(`✗ not enough tuples to synthesize — need ≥3, have ${h.tupleCount}`)
    process.exit(1)
  }

  console.log('synthesizing candidate...')
  const s = await synthesize({
    templatePath: h.templatePath,
    currentSource,
    harvest: h,
    familyId: family,
  })
  console.log(`  mode: ${s.mode}`)
  console.log(`  reasoning: ${s.reasoning.slice(0, 200)}`)

  console.log('judging...')
  const j = judge({
    templatePath: h.templatePath,
    currentSource,
    candidate: s.candidate,
    harvest: h,
  })
  console.log(`  score: ${j.score.toFixed(3)}`)
  for (const [dim, v] of Object.entries(j.dimensions)) {
    console.log(`    ${dim}: ${v.toFixed(3)}`)
  }

  if (flag('--dry-run')) {
    console.log('\n[dry-run] — skipping audit + candidate write')
    return
  }

  console.log('auditing candidate in a composed scaffold...')
  const spec: ComposeSpec = {
    projectName: `template-audit-${templateKey.replace(/\./g, '-')}`,
    family,
    layers: [`framework:${family}`, 'capability:shadcn', 'capability:tailwind'].filter(Boolean),
    partner: null,
    slots: {},
    variables: { headline: 'Audit', subheadline: 'Template-audit compose' },
  }
  const a = await audit({ spec, templateTarget, candidateSource: s.candidate })
  console.log(`  audit: ${a.ok ? '✓ OK' : `✗ FAIL @ ${a.stage}`} (${a.durationMs}ms)`)
  if (!a.ok) {
    console.log(a.stderrTail)
  }

  // Emit candidate + report.
  mkdirSync(CANDIDATES_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const candidateFile = join(CANDIDATES_DIR, `${templateKey}.${stamp}.candidate`)
  const reportFile = join(CANDIDATES_DIR, `${templateKey}.${stamp}.report.json`)
  writeFileSync(candidateFile, s.candidate)
  writeFileSync(reportFile, JSON.stringify({
    templatePath: h.templatePath,
    templateKey,
    family,
    tupleCount: h.tupleCount,
    synthesizer: { mode: s.mode, reasoning: s.reasoning },
    judge: j,
    audit: a,
    decision: a.ok && j.score > 0.55 ? 'promotable' : 'reject',
    generatedAt: new Date().toISOString(),
  }, null, 2))

  console.log(`\ncandidate → ${candidateFile}`)
  console.log(`report    → ${reportFile}`)

  if (flag('--apply') && flag('--yes') && a.ok && j.score > 0.55) {
    writeFileSync(absoluteSource, s.candidate)
    console.log(`\n✓ applied candidate to ${absoluteSource} (score ${j.score.toFixed(2)})`)
    console.log(`  commit the change + attach the report in the PR body.`)
  } else if (flag('--apply')) {
    console.log('\nnot applied — either audit failed, score too low, or --yes not passed.')
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
