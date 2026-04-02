#!/usr/bin/env node

/**
 * sync-warm-list.mjs
 *
 * Extracts all npm dependencies from starter-foundry families and capability
 * layers, compares against the agent-dev-container cache warm list, and outputs
 * the additions needed.
 *
 * Usage:
 *   node scripts/sync-warm-list.mjs                    # print missing deps
 *   node scripts/sync-warm-list.mjs --write             # update the warm list in place
 *   node scripts/sync-warm-list.mjs --agent-dev-path /path/to/agent-dev-container
 *
 * Run this after adding new families, updating package.json templates, or
 * adding capability layers that reference npm packages.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const shouldWrite = args.includes('--write')
const agentDevPath = (() => {
  const idx = args.indexOf('--agent-dev-path')
  if (idx >= 0 && args[idx + 1]) return args[idx + 1]
  // Default: sibling directory
  return path.resolve(repoRoot, '..', 'agent-dev-container')
})()

const warmListPath = path.join(agentDevPath, 'apps', 'host-agent', 'cache-warm-list.json')

async function collectFamilyDeps() {
  const deps = new Set()
  const familiesDir = path.join(repoRoot, 'registry', 'families')
  const families = await fs.readdir(familiesDir)

  for (const fam of families) {
    try {
      const pkg = JSON.parse(
        await fs.readFile(path.join(familiesDir, fam, 'files', 'package.json'), 'utf8'),
      )
      for (const dep of Object.keys(pkg.dependencies ?? {})) deps.add(dep)
      for (const dep of Object.keys(pkg.devDependencies ?? {})) deps.add(dep)
    } catch {
      // No package.json (Python, Rust, Go families)
    }
  }

  return deps
}

async function collectCapabilityDeps() {
  const deps = new Set()

  // shadcn deps (referenced in buildHints, installed by the agent)
  const shadcnDeps = [
    'clsx', 'tailwind-merge', 'class-variance-authority',
    '@radix-ui/react-slot', 'lucide-react',
  ]
  shadcnDeps.forEach((d) => deps.add(d))

  // Add any other capability-specific npm packages here as needed
  // The capability layers mostly provide config files, not npm deps.
  // But some buildHints reference packages the agent will install.

  return deps
}

async function readWarmList() {
  try {
    return JSON.parse(await fs.readFile(warmListPath, 'utf8'))
  } catch {
    console.error(`Cannot read warm list at ${warmListPath}`)
    console.error('Use --agent-dev-path to specify the agent-dev-container location')
    process.exit(1)
  }
}

async function main() {
  const familyDeps = await collectFamilyDeps()
  const capDeps = await collectCapabilityDeps()
  const allDeps = new Set([...familyDeps, ...capDeps])

  const warmList = await readWarmList()
  const existingNpm = new Set(warmList.filter((e) => e.startsWith('npm:')).map((e) => e.replace('npm:', '')))
  const existingPnpm = new Set(warmList.filter((e) => e.startsWith('pnpm:')).map((e) => e.replace('pnpm:', '')))

  const missingNpm = [...allDeps].filter((d) => !existingNpm.has(d)).sort()
  const missingPnpm = [...allDeps].filter((d) => !existingPnpm.has(d)).sort()

  if (missingNpm.length === 0) {
    console.log('✓ All starter-foundry deps are in the warm list')
    return
  }

  console.log(`${missingNpm.length} deps missing from warm list:`)
  missingNpm.forEach((d) => console.log(`  npm:${d}`))

  if (shouldWrite) {
    const additions = [
      ...missingNpm.map((d) => `npm:${d}`),
      ...missingPnpm.map((d) => `pnpm:${d}`),
    ]

    // Insert before the crates section
    const cratesIdx = warmList.findIndex((e) => e.startsWith('crates:'))
    if (cratesIdx >= 0) {
      warmList.splice(cratesIdx, 0, ...additions)
    } else {
      warmList.push(...additions)
    }

    await fs.writeFile(warmListPath, JSON.stringify(warmList, null, 2) + '\n')
    console.log(`\n✓ Written ${additions.length} entries to ${warmListPath}`)
  } else {
    console.log('\nRun with --write to update the warm list automatically')
  }
}

main()
