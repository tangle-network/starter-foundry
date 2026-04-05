#!/usr/bin/env node

import process from 'node:process'
import { createAuditBundle } from './lib/audit.js'
import { batchExport } from './lib/batch-export.js'
import { fattenStarter } from './lib/fatten.js'
import { evaluateAgents } from './lib/agent-runners.js'
import { benchmarkStarter } from './lib/benchmark.js'
import { buildCatalog } from './lib/catalog.js'
import { composeStarter } from './lib/compose.js'
import { createContextPack } from './lib/context-pack.js'
import { readJson } from './lib/fs.js'
import { runPromptCorpus } from './lib/prompt-e2e.js'
import { planPrompt } from './lib/prompt-planner.js'
import { runProofSuite } from './lib/prove.js'
import { listRegistry, loadProjectSpec } from './lib/registry.js'
import { createRelease } from './lib/release.js'
import { selectStarter } from './lib/selection.js'
import { validateStarter } from './lib/validate.js'
import { benchmarkWorkspace, composeWorkspace, createWorkspaceContextPack } from './lib/workspace.js'
import type { WorkspaceSpec } from './types.js'

interface ParsedArgs {
  command: string
  options: Record<string, string | boolean>
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2)
  const command = args[0] ?? ''
  const options: Record<string, string | boolean> = {}

  for (let index = 1; index < args.length; index += 1) {
    const token = args[index]!

    if (!token.startsWith('--')) continue

    const key = token.slice(2)
    const next = args[index + 1]

    if (next && !next.startsWith('--')) {
      options[key] = next
      index += 1
    } else {
      options[key] = true
    }
  }

  return { command, options }
}

function print(value: unknown, jsonMode: boolean): void {
  if (jsonMode) {
    console.log(JSON.stringify(value, null, 2))
    return
  }

  if (typeof value === 'string') {
    console.log(value)
    return
  }

  console.log(JSON.stringify(value, null, 2))
}

function usage(): string {
  return [
    'starter-foundry <command> [options]',
    '',
    'Commands:',
    '  list',
    '  catalog',
    '  plan --prompt <text> [--partner <id>]',
    '  select --prompt <text> [--partner <id>]',
    '  compose --spec <path> --out <dir>',
    '  validate --spec <path> [--out <dir>]',
    '  context --spec <path> [--out <dir>]',
    '  bench --spec <path> [--runs <n>] [--out <dir>]',
    '  workspace-compose --spec <path> --out <dir>',
    '  workspace-context --spec <path> [--out <dir>]',
    '  workspace-bench --spec <path> [--runs <n>] [--out <dir>]',
    '  prompt-e2e --corpus <path> [--out <dir>]',
    '  prove --corpus <path> --out <dir>',
    '  audit --spec <path> [--out <dir>]',
    '  evaluate --spec <path> [--agents <list>] [--out <dir>]',
    '  release --spec <path> [--out <dir>] [--runs <n>]',
    '  batch-export --out <dir> [--mapping <path>] [--filter <names>] [--fatten] [--skip-validate] [--concurrency <n>]',
    '  fatten --spec <path> --out <dir>',
    '',
    'Flags:',
    '  --json    Print structured JSON',
  ].join('\n')
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv)
  const jsonMode = Boolean(options['json'])

  switch (command) {
    case 'list': {
      const registry = await listRegistry()
      print(registry, jsonMode)
      break
    }

    case 'catalog': {
      const catalog = await buildCatalog()
      print(catalog, true)
      break
    }

    case 'plan': {
      if (!options['prompt']) throw new Error('Missing --prompt')

      const result = await planPrompt({
        prompt: String(options['prompt']),
        partner: options['partner'] ? String(options['partner']) : null,
      })

      print(result, true)
      break
    }

    case 'select': {
      if (!options['prompt']) throw new Error('Missing --prompt')

      const result = await selectStarter({
        prompt: String(options['prompt']),
        partner: options['partner'] ? String(options['partner']) : null,
      })

      print(result, jsonMode)
      break
    }

    case 'compose': {
      if (!options['spec'] || !options['out']) throw new Error('compose requires --spec and --out')

      const spec = await loadProjectSpec(String(options['spec']))
      const result = await composeStarter({ spec, outDir: String(options['out']) })

      print(result, jsonMode)
      break
    }

    case 'validate': {
      if (!options['spec']) throw new Error('validate requires --spec')

      const spec = await loadProjectSpec(String(options['spec']))
      const result = await validateStarter({
        spec,
        outDir: options['out'] ? String(options['out']) : null,
      })

      print(result, jsonMode)
      break
    }

    case 'context': {
      if (!options['spec']) throw new Error('context requires --spec')

      const spec = await loadProjectSpec(String(options['spec']))
      const result = await createContextPack({
        spec,
        outDir: options['out'] ? String(options['out']) : null,
      })

      print(result, jsonMode)
      break
    }

    case 'bench': {
      if (!options['spec']) throw new Error('bench requires --spec')

      const spec = await loadProjectSpec(String(options['spec']))
      const runs = options['runs'] ? Number.parseInt(String(options['runs']), 10) : 1
      const result = await benchmarkStarter({
        spec,
        runs,
        outDir: options['out'] ? String(options['out']) : null,
      })

      print(result, true)
      break
    }

    case 'workspace-compose': {
      if (!options['spec'] || !options['out']) throw new Error('workspace-compose requires --spec and --out')

      const spec = await readJson<WorkspaceSpec>(String(options['spec']))
      const result = await composeWorkspace({ spec, outDir: String(options['out']) })

      print(result, true)
      break
    }

    case 'workspace-context': {
      if (!options['spec']) throw new Error('workspace-context requires --spec')

      const spec = await readJson<WorkspaceSpec>(String(options['spec']))
      const result = await createWorkspaceContextPack({
        spec,
        outDir: options['out'] ? String(options['out']) : null,
      })

      print(result, true)
      break
    }

    case 'workspace-bench': {
      if (!options['spec']) throw new Error('workspace-bench requires --spec')

      const spec = await readJson<WorkspaceSpec>(String(options['spec']))
      const runs = options['runs'] ? Number.parseInt(String(options['runs']), 10) : 1
      const result = await benchmarkWorkspace({
        spec,
        runs,
        outDir: options['out'] ? String(options['out']) : null,
      })

      print(result, true)
      break
    }

    case 'prompt-e2e': {
      if (!options['corpus']) throw new Error('prompt-e2e requires --corpus')

      const result = await runPromptCorpus({
        corpusPath: String(options['corpus']),
        outDir: options['out'] ? String(options['out']) : null,
      })

      print(result, true)
      break
    }

    case 'prove': {
      if (!options['corpus'] || !options['out']) throw new Error('prove requires --corpus and --out')

      const result = await runProofSuite({
        corpusPath: String(options['corpus']),
        outDir: String(options['out']),
      })

      print(result, true)
      break
    }

    case 'audit': {
      if (!options['spec']) throw new Error('audit requires --spec')

      const spec = await loadProjectSpec(String(options['spec']))
      const result = await createAuditBundle({
        spec,
        outDir: options['out'] ? String(options['out']) : null,
      })

      print(result, true)
      break
    }

    case 'evaluate': {
      if (!options['spec']) throw new Error('evaluate requires --spec')

      const spec = await loadProjectSpec(String(options['spec']))
      const result = await evaluateAgents({
        spec,
        outDir: options['out'] ? String(options['out']) : null,
        agents: options['agents']
          ? String(options['agents'])
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
          : null,
      })

      print(result, true)
      break
    }

    case 'release': {
      if (!options['spec']) throw new Error('release requires --spec')

      const spec = await loadProjectSpec(String(options['spec']))
      const runs = options['runs'] ? Number.parseInt(String(options['runs']), 10) : 1
      const result = await createRelease({
        spec,
        outDir: options['out'] ? String(options['out']) : null,
        benchmarkRuns: runs,
        agents: options['agents']
          ? String(options['agents'])
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
          : null,
      })

      print(result, true)
      break
    }

    case 'batch-export': {
      if (!options['mapping'] || !options['out']) throw new Error('batch-export requires --mapping and --out')

      const mappingPath = String(options['mapping'])
      const filter = options['filter']
        ? String(options['filter']).split(',').map((v) => v.trim()).filter(Boolean)
        : null
      const concurrency = options['concurrency'] ? Number.parseInt(String(options['concurrency']), 10) : 4

      const result = await batchExport({
        mappingPath,
        outDir: String(options['out']),
        filter,
        fatten: Boolean(options['fatten']),
        validate: !options['skip-validate'],
        concurrency,
      })

      print(result, true)
      break
    }

    case 'fatten': {
      if (!options['spec'] || !options['out']) throw new Error('fatten requires --spec and --out')

      const spec = await loadProjectSpec(String(options['spec']))
      const outDir = String(options['out'])

      // Compose first
      await composeStarter({ spec, outDir })

      // Then fatten with deps + pre-bundle + build
      const result = await fattenStarter(outDir)

      print(result, true)
      break
    }

    default:
      console.log(usage())
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
