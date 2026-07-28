#!/usr/bin/env node
// Propose a brand-new family: given an id + taxonomy + description,
// asks the LLM (synthesized from N closest peer families) to draft a
// full manifest + template files, then writes the result to
// .evolve/family-proposals/<id>/ for human review.
//
// Usage:
//   node scripts/propose-family.ts \
//     --id remix-static-ts \
//     --language typescript --runtime node --surface frontend \
//     --description "Remix v2 app with static-route export"
//
// Optionally include product cues:
//     --cues "SSR with streaming" --cues "MDX route modules"
//
// The proposal is NEVER auto-promoted. Review .evolve/family-proposals/<id>/
// and run `pnpm promote:family-proposal <id>` (implementation pending) or
// manually `mv` into registry/ after inspection.

import {
  proposeFamily,
  proposeFamilyWithRLMToDisk,
} from '../dist/training/family_proposer/propose.js'

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : fallback
}
function args(flag) {
  const out = []
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === flag) out.push(process.argv[i + 1])
  }
  return out
}

const id = arg('--id')
const description = arg('--description')
const language = arg('--language', 'typescript')
const runtime = arg('--runtime', 'node')
const surface = arg('--surface', 'frontend')
const cues = args('--cues')
const rlm = process.argv.includes('--rlm')
const maxShots = Number(arg('--max-shots', '3')) || 3

if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error(
    'usage: --id <kebab> --description "..." [--language ...] [--runtime ...] [--surface ...] [--cues "..."] [--rlm] [--max-shots N]',
  )
  process.exit(2)
}
if (!description) {
  console.error('--description is required')
  process.exit(2)
}

const proposeInput = {
  id,
  description,
  taxonomy: { language, runtime, surface },
  productCues: cues.length > 0 ? cues : undefined,
}
const proposal = rlm
  ? await proposeFamilyWithRLMToDisk(proposeInput, { maxShots })
  : await proposeFamily(proposeInput)

console.log('')
console.log(`✓ proposal emitted → ${proposal.proposalDir}`)
console.log(`  mode: ${proposal.mode}`)
console.log(`  peer families: ${proposal.peerFamilies.join(', ')}`)
console.log(`  template files: ${proposal.templateFiles.length}`)
if (proposal.reasoning) {
  console.log('')
  console.log('reasoning:')
  console.log(`  ${proposal.reasoning.slice(0, 500)}`)
}
console.log('')
console.log('next steps:')
console.log('  1. Review the manifest + framework.manifest.json + files/')
console.log(
  `  2. If acceptable, copy to registry/families/${id}/ and registry/layers/framework/${id}/`,
)
console.log(
  '  3. Wire routing in src/lib/planner/projects.ts + coverage test in tests/coverage.test.ts',
)
console.log('  4. pnpm validate:registry && pnpm build && pnpm test')
