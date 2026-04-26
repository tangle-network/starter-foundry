#!/usr/bin/env tsx
// gen11.5-validate-catalog — composes every agent-runtime family in
// the registry and runs its declared validationChecks. Reports a pass
// summary + per-bundle detail. Used to gate Stream B catalog growth:
// no commit lands a bundle that doesn't pass all its declared checks.

import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { composeStarter } from '../src/lib/compose.js'
import { validateComposedDir } from '../src/lib/validate.js'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FAMILIES = join(REPO, 'registry/families')

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
  const dir = mkdtempSync(join(tmpdir(), `gen11.5-validate-${family}-`))
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
    // Some validators (schedule-valid) read the manifest from the composed dir.
    // The composer doesn't write the manifest there by default, so copy it in.
    const familyManifest = join(FAMILIES, family, 'manifest.json')
    if (!existsSync(join(dir, 'manifest.json'))) {
      copyFileSync(familyManifest, join(dir, 'manifest.json'))
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
    .filter((d) => d.startsWith('agent-runtime-'))
    .sort()

  console.log(`gen11.5-validate-catalog — ${targets.length} agent-runtime bundles`)
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
  const fullPass = results.filter(
    (r) => r.composed && r.passedChecks === r.totalChecks && r.totalChecks > 0,
  )
  console.log(`Summary: ${fullPass.length}/${results.length} bundles passed all gates`)
  console.log('')
  if (fullPass.length === results.length) {
    console.log('All agent-runtime bundles green. Catalog breadth = ' + results.length + '.')
    process.exit(0)
  } else {
    console.log('Failures detected. Fix per-bundle errors above before commit.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
