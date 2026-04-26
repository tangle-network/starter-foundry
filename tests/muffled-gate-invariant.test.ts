// Muffled-gate invariant — scans the eval/gate surface for the patterns
// enumerated in .evolve/patterns/muffled-gate.md. Any new instance added
// to a scanned file fails this test with a clear file:line message.
// Escape hatch: `// muffle-ok: <reason>` on the same line.
//
// Scanner logic now lives in @tangle-network/agent-eval (0.7.2+). This
// file configures the scan (SCAN_FILES + a local finder for the
// SF-specific permissive-kind-default pattern) and runs it.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  scanForMuffledGates,
  formatFindings,
  DEFAULT_FINDERS,
  UNIVERSAL_FINDERS,
  type MuffledFinder,
} from '@tangle-network/agent-eval'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

/**
 * Files scanned for context-specific patterns. New gate-adjacent files
 * must be added here — see .evolve/patterns/muffled-gate.md §"Scan scope".
 */
const SCAN_FILES = [
  'src/eval/scaffold-bridge.ts',
  'src/lib/template-quality.ts',
  'src/lib/prompt-e2e.ts',
  'scripts/promote-family-proposal.ts',
  'scripts/promote-capability-proposal.ts',
  'scripts/audit-scaffold-quality.ts',
  'scripts/meta-harness-eval.ts',
  'scripts/agent-eval-scaffold.ts',
]

/**
 * SF-specific finder: `?? 'starter'` / `?? 'workspace'` — missing-field
 * defaults that turn missing data into a specific permissive value.
 * Not in the agent-eval default bundle because the string literals are
 * SF-domain-specific (the kind discriminator on a compose spec).
 */
const findPermissiveKindDefault: MuffledFinder = (file, text) => {
  const out = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.includes('muffle-ok:')) continue
    const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
    if (!code.trim()) continue
    if (/\?\?\s*['"](starter|workspace)['"]/.test(code)) {
      out.push({
        file,
        line: i + 1,
        lineText: line.trim(),
        pattern: 'permissive-kind-default (?? "starter"/"workspace")',
      })
    }
  }
  return out
}

/**
 * Duplicate per-language dispatch tables. HARNESS_CONFIGS in
 * scaffold-bridge.ts is the single source of truth; promoters import it.
 * A regression that redeclares `case 'typescript' ... testCommand` in N
 * files silently drifts. Enforced as a separate test below since it's a
 * whole-repo invariant, not a per-file scan.
 */
function checkDuplicateHarnessDispatch(): string[] {
  const witnesses: string[] = []
  for (const file of SCAN_FILES) {
    const abs = join(REPO_ROOT, file)
    if (!existsSync(abs)) continue
    const text = readFileSync(abs, 'utf8')
    const hasTrio =
      /case\s+['"]typescript['"]\s*:/.test(text) &&
      /case\s+['"]rust['"]\s*:/.test(text) &&
      /case\s+['"]go['"]\s*:/.test(text) &&
      /testCommand\s*:/.test(text)
    if (hasTrio) witnesses.push(file)
  }
  return witnesses
}

describe('muffled-gate invariant', () => {
  test('zero unannotated muffled-gate patterns in scanned files', () => {
    const findings = scanForMuffledGates({
      repoRoot: REPO_ROOT,
      scanFiles: SCAN_FILES,
      finders: [...DEFAULT_FINDERS, ...UNIVERSAL_FINDERS, findPermissiveKindDefault],
      autoDerive: {
        roots: ['src', 'scripts'],
        extensions: /\.(ts|mjs|js)$/,
        importsContain: '@tangle-network/agent-eval',
        universalFinders: UNIVERSAL_FINDERS,
      },
    })
    if (findings.length > 0) assert.fail(formatFindings(findings))
  })

  test('HARNESS_CONFIGS is the single source of truth (no duplicate switches)', () => {
    const witnesses = checkDuplicateHarnessDispatch()
    assert.ok(
      witnesses.length <= 1,
      `Only scaffold-bridge.ts should declare the per-language switch; found in: ${witnesses.join(', ')}. ` +
      `Promoters must import HARNESS_CONFIGS instead.`,
    )
  })

  test('promoters import HARNESS_CONFIGS', () => {
    for (const p of ['scripts/promote-family-proposal.ts', 'scripts/promote-capability-proposal.ts']) {
      const text = readFileSync(join(REPO_ROOT, p), 'utf8')
      assert.match(text, /HARNESS_CONFIGS/, `${p} must import HARNESS_CONFIGS from scaffold-bridge`)
    }
  })

  test('makeHarnessConfig throws on unknown language (no silent-pass fallback)', async () => {
    const mod = await import('../dist/eval/scaffold-bridge.js')
    const fake = { family: { taxonomy: { language: 'zig-not-yet-supported', surface: 'firmware' } }, layers: [] }
    assert.throws(() => mod.makeHarnessConfig(fake as never), /unsupported taxonomy\.language/)
  })

  test('prepareScaffoldForEval bakes cwd into the returned harness', () => {
    const src = readFileSync(join(REPO_ROOT, 'src/eval/scaffold-bridge.ts'), 'utf8')
    assert.match(
      src,
      /const\s+harness\s*=\s*\{\s*\.\.\.makeHarnessConfig\([^)]*\)\s*,\s*cwd\s*:\s*scaffoldDir\s*\}/,
      'prepareScaffoldForEval must return a harness with cwd: scaffoldDir baked in',
    )
  })

  test('HARNESS_CONFIGS.typescript uses strict tsc (no `|| true`)', async () => {
    const mod = await import('../dist/eval/scaffold-bridge.js')
    const cmd = mod.HARNESS_CONFIGS.typescript!.testCommand as string
    assert.doesNotMatch(cmd, /\|\| true/)
    assert.match(cmd, /tsc\s+--noEmit/)
  })
})
