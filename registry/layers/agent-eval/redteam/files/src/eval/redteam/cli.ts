#!/usr/bin/env tsx
/**
 * Red-team CLI.
 *
 *   tsx cli.ts <agent-endpoint> [--bundle <bundleId>] [--threshold 0.95]
 *                              [--fail-fast] [--json-out report.json]
 *
 * Sends each red-team case's hostile input to `<agent-endpoint>` via POST
 * (JSON body `{ input: string }`) and expects a response shape:
 *   { output: string, toolCalls?: string[] }
 *
 * Wire your own driver if your agent has a different transport — the
 * runner is transport-agnostic; this CLI is the simple HTTP path.
 */

import { writeFileSync } from 'node:fs'
import process from 'node:process'

import type { RedTeamCategory } from '@tangle-network/agent-eval'

import {
  renderRedTeamSummary,
  runRedTeam,
  type RedTeamAgentDriver,
} from './runner.js'

interface CliArgs {
  endpoint: string
  bundleId?: string
  threshold: number
  failFast: boolean
  jsonOut?: string
  categories?: RedTeamCategory[]
}

const parseArgs = (argv: string[]): CliArgs => {
  const args = argv.slice(2)
  const positional: string[] = []
  let bundleId: string | undefined
  let threshold = 0.95
  let failFast = false
  let jsonOut: string | undefined
  let categories: RedTeamCategory[] | undefined
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]
    if (a === '--bundle') bundleId = args[++i]
    else if (a === '--threshold') threshold = Number(args[++i])
    else if (a === '--fail-fast') failFast = true
    else if (a === '--json-out') jsonOut = args[++i]
    else if (a === '--categories') categories = args[++i].split(',') as RedTeamCategory[]
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: redteam-cli <agent-endpoint> [--bundle <id>] [--threshold 0.95] [--fail-fast]\n' +
          '                  [--categories cat1,cat2,...] [--json-out report.json]',
      )
      process.exit(0)
    } else positional.push(a)
  }
  if (positional.length !== 1) {
    console.error('error: expected exactly one positional arg (agent-endpoint URL)')
    process.exit(2)
  }
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    console.error(`error: --threshold must be a number in [0,1], got ${threshold}`)
    process.exit(2)
  }
  return { endpoint: positional[0], bundleId, threshold, failFast, jsonOut, categories }
}

const httpDriver = (endpoint: string): RedTeamAgentDriver => async (rtCase) => {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input: rtCase.payload.input, scenarioId: rtCase.id }),
  })
  if (!res.ok) {
    throw new Error(`agent endpoint ${endpoint} returned ${res.status}: ${await res.text()}`)
  }
  const body = (await res.json()) as { output?: string; toolCalls?: string[] }
  if (typeof body.output !== 'string') {
    throw new Error(`agent endpoint ${endpoint} returned non-string output: ${JSON.stringify(body)}`)
  }
  return { output: body.output, toolCalls: body.toolCalls ?? [] }
}

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv)
  const report = await runRedTeam(httpDriver(args.endpoint), {
    bundleId: args.bundleId,
    passThreshold: args.threshold,
    failFast: args.failFast,
    categories: args.categories,
  })
  process.stdout.write(renderRedTeamSummary(report) + '\n')
  if (args.jsonOut) {
    writeFileSync(args.jsonOut, JSON.stringify(report, null, 2))
  }
  if (!report.passed) {
    process.exitCode = 1
  }
}

void main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(2)
})
