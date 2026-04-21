#!/usr/bin/env node
// Scaffold a new registry family. Writes the minimum viable set:
//   registry/families/<id>/manifest.json      (schema-valid skeleton)
//   registry/families/<id>/files/package.json (if JS runtime)
//   registry/families/<id>/files/validate-*.mjs (minimal structural validator)
//   registry/layers/framework/<id>/manifest.json
//   registry/layers/framework/<id>/files/     (empty dir)
// Plus appends a coverage test entry and emits a TODO list for manual edits.
//
// Usage:
//   node scripts/new-family.mjs --name bun-http --runtime bun --surface api
//   node scripts/new-family.mjs --name my-framework --runtime node --surface api --description "..."

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const flag = (n) => process.argv.includes(n)

const name = arg('--name')
const runtime = arg('--runtime') || 'node'
const surface = arg('--surface') || 'api'
const description = arg('--description') || `${runtime} ${surface} starter`

// Optional LLM-drafted hints. Activated when --llm is passed and the router
// key + @ax-llm/ax are available. When off, the hint slots carry TODO
// placeholders (the contributor fills them in).
async function draftHintsWithLLM(nameArg, runtimeArg, surfaceArg, descriptionArg) {
  if (!flag('--llm')) return null
  try {
    const { createLLM, isLLMAvailable } = await import('../dist/lib/llm.js')
    if (!isLLMAvailable()) {
      console.log('  (--llm requested but no key set; skipping LLM draft)')
      return null
    }
    const { ax } = await import('@ax-llm/ax')
    const drafter = ax(
      'familyName:string, runtime:string, surface:string, description:string -> whenToUse:string, firstSteps:string[], gotchas:string[]',
    )
    const llm = createLLM()
    const out = await drafter.forward(llm, {
      familyName: nameArg,
      runtime: runtimeArg,
      surface: surfaceArg,
      description: descriptionArg,
    })
    return {
      whenToUse: out.whenToUse ?? null,
      firstSteps: Array.isArray(out.firstSteps) ? out.firstSteps : [],
      gotchas: Array.isArray(out.gotchas) ? out.gotchas : [],
    }
  } catch (err) {
    console.log(`  (LLM draft failed: ${err.message}; falling back to TODO placeholders)`)
    return null
  }
}

if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error('usage: --name <kebab-case-id> [--runtime <node|bun|deno|rust|go|python|wasm>] [--surface <api|frontend|worker|contracts|agent-service|inference>] [--description "..."]')
  process.exit(2)
}

const familyDir = join(REPO, 'registry/families', name)
const frameworkDir = join(REPO, 'registry/layers/framework', name)

if (existsSync(familyDir) || existsSync(frameworkDir)) {
  console.error(`family "${name}" already exists. Delete ${familyDir} and ${frameworkDir} to regenerate.`)
  process.exit(2)
}

// Infer a sensible language from runtime.
const language = {
  bun: 'typescript', deno: 'typescript', node: 'typescript',
  rust: 'rust', go: 'go', python: 'python', wasm: 'rust',
}[runtime] || 'typescript'

const drafted = await draftHintsWithLLM(name, runtime, surface, description)

const familyManifest = {
  id: name,
  description: description.length >= 20 ? description : `${description} — ${runtime} ${surface} starter (regenerate description before shipping)`,
  tags: [runtime, surface, language],
  taxonomy: { language, runtime, surface },
  defaults: { projectType: surface, serviceName: `starter-foundry-${name}` },
  files: [],
  validationChecks: [],
  contextHints: { commands: [], entrypoints: [], preview: null, extensionPoints: [] },
  keywords: [name, `${runtime} ${surface}`],
  tieredKeywords: {
    tier1: [name, `${runtime} ${surface}`],
    tier2: [],
  },
  buildHints: {
    whenToUse: drafted?.whenToUse ?? `TODO: one sentence on when a prompt should route here. Describe the product archetype, not the tech.`,
    firstSteps: drafted?.firstSteps?.length ? drafted.firstSteps : [
      'TODO: first command an agent should run (install deps + start dev server).',
      'TODO: primary entrypoint the agent extends.',
      'TODO: where brand / product strings live.',
    ],
    gotchas: drafted?.gotchas?.length ? drafted.gotchas : [
      'TODO: one non-obvious trap specific to this runtime.',
    ],
    placeholders: [
      { path: 'TODO/entrypoint.xyz', description: 'TODO: name the default file agents must replace with product logic (≥20 chars).' },
    ],
  },
}

const frameworkManifest = {
  id: name,
  description: `${runtime} framework layer for ${name} family.`,
  appliesTo: [name],
  files: [],
}

mkdirSync(familyDir, { recursive: true })
mkdirSync(join(familyDir, 'files'), { recursive: true })
mkdirSync(frameworkDir, { recursive: true })
mkdirSync(join(frameworkDir, 'files'), { recursive: true })

writeFileSync(join(familyDir, 'manifest.json'), JSON.stringify(familyManifest, null, 2) + '\n')
writeFileSync(join(frameworkDir, 'manifest.json'), JSON.stringify(frameworkManifest, null, 2) + '\n')

// Minimal .gitkeep so empty `files/` dirs stay tracked.
writeFileSync(join(familyDir, 'files/.gitkeep'), '')
writeFileSync(join(frameworkDir, 'files/.gitkeep'), '')

console.log(`✓ created family: ${name}`)
console.log('')
console.log('Next steps (none are optional):')
console.log(`  1. Fill the TODO fields in registry/families/${name}/manifest.json buildHints.`)
console.log(`  2. Add template files under registry/families/${name}/files/ (e.g. package.json, validate-*.mjs)`)
console.log(`     and register them in the family manifest's "files" array.`)
console.log(`  3. Add framework-layer template files under registry/layers/framework/${name}/files/`)
console.log(`     and register them in the layer manifest's "files" array.`)
console.log(`  4. Wire routing in src/lib/planner/projects.ts (chooseApiFamily or buildWebProject)`)
console.log(`     so prompts matching your keywords route to "${name}".`)
console.log(`  5. Add a coverage test entry in tests/coverage.test.ts FAMILY_PROMPTS:`)
console.log(`     "${name}": "A prompt that should route here"`)
console.log(`  6. If this family needs slot layers (database/auth/payments/queue),`)
console.log(`     add "${name}" to each slot layer's appliesTo array in registry/layers/{database,auth,payments,queue}/*/manifest.json`)
console.log(`  7. pnpm validate:registry && pnpm build && pnpm test — all must pass.`)
console.log(`  8. Before opening a PR, run scripts/run-buildout-pipeline.mjs and attach the delta.`)
