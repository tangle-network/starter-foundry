#!/usr/bin/env node
// Interactive CLI REPL for testing prompts against the live registry.
// Usage:
//   pnpm tsx scripts/repl.ts
//   > Build a React dashboard for crypto trading
//
// Echoes the planPrompt decision, the composed layer set, the partner,
// and a 5-line preview of the AGENTS.md that would render. No writes —
// purely informational.

import readline from 'node:readline'
import { planPrompt } from '../dist/lib/prompt-planner.js'
import { validatePlan } from '../dist/lib/validate-plan.js'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
process.stdout.write(
  'starter-foundry repl — type a prompt, get the routing decision. ctrl-c to exit.\n> ',
)

rl.on('line', async (line) => {
  const prompt = line.trim()
  if (!prompt) {
    process.stdout.write('> ')
    return
  }

  try {
    const plan = await planPrompt({ prompt, partner: null })
    const kind = plan.kind
    process.stdout.write(`\nkind:       ${kind}\n`)
    if (kind === 'starter') {
      process.stdout.write(`family:     ${plan.spec.family}\n`)
      process.stdout.write(`partner:    ${plan.spec.partner ?? '(none)'}\n`)
      process.stdout.write(`layers:     ${(plan.spec.layers ?? []).join(', ')}\n`)
      process.stdout.write(`slots:      ${JSON.stringify(plan.spec.slots ?? {})}\n`)
      process.stdout.write(`confidence: ${plan.confidence}\n`)
      const v = await validatePlan(plan.spec)
      process.stdout.write(
        `validates:  ${v.ok ? '✓' : '✗'}${v.ok ? '' : ' — ' + v.issues.map((i) => i.message).join('; ')}\n`,
      )
    } else if (kind === 'workspace') {
      process.stdout.write(`projects:\n`)
      for (const proj of plan.spec.projects ?? []) {
        process.stdout.write(
          `  - ${proj.id ?? '?'} → ${proj.spec.family} [${(proj.spec.layers ?? []).length} layers]\n`,
        )
      }
    }
    process.stdout.write(`reasons:    ${(plan.reasons ?? []).join(' | ')}\n`)
  } catch (err) {
    process.stdout.write(`error: ${err.message}\n`)
  }
  process.stdout.write('\n> ')
})

rl.on('close', () => {
  process.stdout.write('\n')
  process.exit(0)
})
