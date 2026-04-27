#!/usr/bin/env node
/**
 * research-harness CLI — `pnpm research <subcommand>`.
 *
 * Subcommands:
 *   propose   — draft hypotheses via runProposeReview (reads --goal, prints JSON)
 *   screen    — 1-rep screener pass over hypotheses/queue.json
 *   validate  — multi-rep validator over passed-floor candidates
 *   sweep     — screen + validate end-to-end, write scorecard
 *
 * The CLI is intentionally thin. All real work lives in runner.ts +
 * screener.ts + validator.ts + proposer.ts so callers can compose them
 * directly without going through a shell.
 *
 * The harness ships with a NoOpScenarioRunner that throws with a clear
 * message — a real consumer must inject a real runner. We refuse to ship
 * a "default" runner that fakes success (muffled-gate pattern).
 */

import { resolve } from 'node:path'
import process from 'node:process'

import { runScreen, runSweep, runValidate } from './runner.js'
import { propose } from './proposer.js'
import type { ScenarioRunner } from './types.js'

interface Argv {
  command: string
  flags: Map<string, string>
  positional: string[]
}

function parseArgv(args: readonly string[]): Argv {
  const command = args[0] ?? ''
  const flags = new Map<string, string>()
  const positional: string[] = []
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === undefined) continue
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=')
      if (eqIdx >= 0) {
        flags.set(arg.slice(2, eqIdx), arg.slice(eqIdx + 1))
      } else {
        const next = args[i + 1]
        if (next !== undefined && !next.startsWith('--')) {
          flags.set(arg.slice(2), next)
          i += 1
        } else {
          flags.set(arg.slice(2), 'true')
        }
      }
    } else {
      positional.push(arg)
    }
  }
  return { command, flags, positional }
}

function fail(message: string): never {
  process.stderr.write(`research-harness: ${message}\n`)
  process.exit(1)
}

function noOpRunner(): ScenarioRunner {
  return {
    scenarioIds: [],
    runTrial: async () => {
      throw new Error(
        'research-harness CLI invoked without an injected ScenarioRunner. ' +
          'Either compose the runner programmatically (import runScreen / runSweep) or wire ' +
          'a custom CLI that supplies a real runner. The default refuses to fake results.',
      )
    },
  }
}

async function main(): Promise<void> {
  const argv = parseArgv(process.argv.slice(2))
  const queuePath = resolve(argv.flags.get('queue') ?? 'hypotheses/queue.json')
  const resultsDir = resolve(
    argv.flags.get('results') ?? process.env.RESEARCH_RESULTS_DIR ?? 'research-results',
  )

  switch (argv.command) {
    case 'propose': {
      const goal = argv.flags.get('goal')
      if (!goal) fail('propose requires --goal "<description>"')
      const count = Number.parseInt(argv.flags.get('count') ?? '5', 10)
      // Default: refuse to run without a wired LLM. This keeps the bundle
      // honest — the consumer has to inject `callJson` for real proposals.
      const out = await propose({
        goal,
        count,
        callJson: async () => {
          throw new Error(
            'propose: no LLM hook wired. Compose `propose()` programmatically with a callJson ' +
              'that hits router.tangle.tools (or any compatible JSON endpoint).',
          )
        },
      })
      process.stdout.write(`${JSON.stringify(out.hypotheses, null, 2)}\n`)
      return
    }
    case 'screen': {
      const { report, path } = await runScreen({
        queuePath,
        resultsDir,
        runner: noOpRunner(),
      })
      process.stdout.write(`screened ${report.ranked.length} → ${path}\n`)
      return
    }
    case 'validate': {
      const candidatesArg = argv.flags.get('candidates')
      if (!candidatesArg) fail('validate requires --candidates "id1,id2,..."')
      const candidateIds = candidatesArg.split(',').map((s) => s.trim()).filter(Boolean)
      const { report, path } = await runValidate({
        queuePath,
        resultsDir,
        runner: noOpRunner(),
        candidateIds,
      })
      process.stdout.write(`validated ${report.results.length} → ${path}\n`)
      return
    }
    case 'sweep': {
      const out = await runSweep({
        queuePath,
        resultsDir,
        runner: noOpRunner(),
      })
      process.stdout.write(
        `sweep ${out.runId}: queue=${out.queueSize} screened=${out.screen.ranked.length} ` +
          `validated=${out.validate?.results.length ?? 0} scorecard=${out.scorecardPath}\n`,
      )
      return
    }
    case '':
    case 'help':
    case '--help':
    case '-h': {
      process.stdout.write(
        'usage: research-harness <propose|screen|validate|sweep> [flags]\n' +
          '  propose  --goal "<text>" [--count N]\n' +
          '  screen   [--queue PATH] [--results DIR]\n' +
          '  validate --candidates id1,id2,...  [--queue PATH] [--results DIR]\n' +
          '  sweep    [--queue PATH] [--results DIR]\n',
      )
      return
    }
    default:
      fail(`unknown command "${argv.command}". Try --help.`)
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`)
  process.exit(1)
})
