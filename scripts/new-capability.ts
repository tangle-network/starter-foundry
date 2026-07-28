#!/usr/bin/env node
// Scaffold a new capability layer with packageDeps + buildHints.
// Usage:
//   node scripts/new-capability.ts --name stripe-tax --applies "nextjs-ts,fullstack-ts" --description "..."

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : fallback
}

const name = arg('--name')
const applies = (arg('--applies') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const description = arg('--description') || 'TODO: describe what this capability adds (≥20 chars).'

if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error('usage: --name <kebab-case-id> --applies "fam1,fam2" [--description "..."]')
  process.exit(2)
}

const dir = join(REPO, 'registry/layers/capability', name)
if (existsSync(dir)) {
  console.error(`capability "${name}" already exists.`)
  process.exit(2)
}

const manifest = {
  id: name,
  description:
    description.length >= 20 ? description : `${description} (regenerate: must be ≥20 chars).`,
  appliesTo: applies.length > 0 ? applies : ['TODO-family-id'],
  files: [],
  packageDeps: { dependencies: {} },
  keywords: [name],
  buildHints: {
    whenToUse: 'TODO: one sentence on when to attach this capability.',
    firstSteps: ['TODO: first concrete action the agent takes with this capability.'],
    gotchas: [],
    placeholders: [],
  },
}

mkdirSync(dir, { recursive: true })
mkdirSync(join(dir, 'files'), { recursive: true })
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
writeFileSync(join(dir, 'files/.gitkeep'), '')

console.log(`✓ created capability: ${name}`)
console.log('')
console.log('Next steps:')
console.log(`  1. Fill TODO fields in registry/layers/capability/${name}/manifest.json.`)
console.log(
  `  2. Add runtime deps to packageDeps.dependencies (compose merges them into family package.json).`,
)
console.log(`  3. Add template files under files/ and register them in the manifest's files array.`)
console.log(
  `  4. Add keywords that trigger auto-detection. If archetype-shaped (not literal), add a signal set in`,
)
console.log(`     src/lib/planner/signals.ts + wire it in src/lib/planner/implicit-caps.ts.`)
console.log(`  5. Add a coverage test entry in tests/coverage.test.ts CAP_PROMPTS.`)
console.log(`  6. pnpm validate:registry && pnpm build && pnpm test — all must pass.`)
