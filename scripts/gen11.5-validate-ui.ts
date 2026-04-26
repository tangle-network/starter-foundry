#!/usr/bin/env tsx
// gen11.5-validate-ui — composes agent-with-ui-ts / orchestrator-with-ui-ts /
// sandbox-app-ts and runs their declared validationChecks. Mirrors
// gen11.5-validate-catalog.ts but targets the UI surface.

import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { composeStarter } from '../src/lib/compose.js'
import { validateComposedDir } from '../src/lib/validate.js'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FAMILIES = join(REPO, 'registry/families')

const TARGET_PREFIXES = ['agent-with-ui-', 'orchestrator-with-ui-', 'sandbox-app-']

interface PerBundleResult {
  family: string
  composed: boolean
  composeError?: string
  totalChecks: number
  passedChecks: number
  failures: { type: string; path?: string; error?: string }[]
}

async function validateBundle(family: string): Promise<PerBundleResult> {
  const result: PerBundleResult = {
    family,
    composed: false,
    totalChecks: 0,
    passedChecks: 0,
    failures: [],
  }
  const dir = mkdtempSync(join(tmpdir(), `gen11.5-validate-ui-${family}-`))
  try {
    await composeStarter({
      spec: { family, layers: [], projectName: family },
      outDir: dir,
    })
    result.composed = true
    const reportPath = join(dir, '.starter-foundry/compose-report.json')
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
      validationChecks: Parameters<typeof validateComposedDir>[0]['checks']
    }
    const validation = await validateComposedDir({
      composedDir: dir,
      checks: report.validationChecks,
    })
    result.totalChecks = validation.checks.length
    result.passedChecks = validation.checks.filter((c) => c.ok).length
    result.failures = validation.checks
      .filter((c) => !c.ok)
      .map((c) => ({
        type: c.check.type,
        path: 'path' in c.check ? c.check.path : undefined,
        error: 'error' in c ? c.error : undefined,
      }))
  } catch (err) {
    result.composeError = err instanceof Error ? err.message : String(err)
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* best-effort */
    }
  }
  return result
}

async function main(): Promise<void> {
  const targets = readdirSync(FAMILIES)
    .filter((d) => TARGET_PREFIXES.some((p) => d.startsWith(p)))
    .sort()

  console.log(`gen11.5-validate-ui — ${targets.length} UI bundles`)
  console.log('─'.repeat(72))

  const results: PerBundleResult[] = []
  for (const family of targets) {
    process.stdout.write(`  ${family} ... `)
    const r = await validateBundle(family)
    results.push(r)
    if (r.composed && r.passedChecks === r.totalChecks && r.totalChecks > 0) {
      console.log(`PASS (${r.passedChecks}/${r.totalChecks} gates)`)
    } else if (r.composed) {
      console.log(`FAIL (${r.passedChecks}/${r.totalChecks} gates)`)
      for (const f of r.failures) {
        console.log(`    ✗ ${f.type}${f.path ? ' ' + f.path : ''}`)
        if (f.error) console.log(`      → ${f.error}`)
      }
    } else {
      console.log(`COMPOSE-FAIL: ${r.composeError ?? 'unknown'}`)
    }
  }

  console.log('─'.repeat(72))
  const fullPass = results.filter((r) => r.composed && r.passedChecks === r.totalChecks && r.totalChecks > 0)
  console.log(`Summary: ${fullPass.length}/${results.length} UI bundles passed all gates`)
  process.exit(fullPass.length === results.length ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
