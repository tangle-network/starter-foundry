#!/usr/bin/env node
// Scaffold a new partner manifest with config placeholder + buildHints stub.
// Usage:
//   node scripts/new-partner.ts --name linea --applies "react-vite-ts,nextjs-ts,forge-contracts" --description "..."

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
const description =
  arg('--description') || 'TODO: describe the partner / what this pack biases (≥20 chars).'

if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error('usage: --name <kebab-case-id> --applies "fam1,fam2" [--description "..."]')
  process.exit(2)
}

const dir = join(REPO, 'registry/partners', name)
if (existsSync(dir)) {
  console.error(`partner "${name}" already exists.`)
  process.exit(2)
}

const manifest = {
  id: name,
  description: description.length >= 20 ? description : `${description} (regenerate: ≥20 chars).`,
  appliesTo: applies.length > 0 ? applies : ['TODO-family-id'],
  files: [{ source: `files/${name}-config.json`, target: `${name}-config.json` }],
  buildHints: {
    whenToUse: 'TODO: one sentence on when a prompt should set this partner.',
    firstSteps: ['TODO: first concrete action an agent takes for this partner.'],
    gotchas: [],
  },
}

mkdirSync(dir, { recursive: true })
mkdirSync(join(dir, 'files'), { recursive: true })
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
writeFileSync(
  join(dir, 'files', `${name}-config.json`),
  JSON.stringify(
    {
      partner: name,
      docs: 'TODO: partner documentation URL',
      networks: {},
      sdk: {},
    },
    null,
    2,
  ) + '\n',
)

console.log(`✓ created partner: ${name}`)
console.log('')
console.log('Next steps:')
console.log(`  1. Fill TODO fields in registry/partners/${name}/manifest.json + the config.json.`)
console.log(
  `  2. Wire inferPartner() in src/lib/planner/detectors.ts — keywords that should route here.`,
)
console.log(`  3. Wire resolvePartnerForFamily() in src/lib/planner/helpers.ts — compat matrix.`)
console.log(`  4. pnpm validate:registry && pnpm build && pnpm test.`)
