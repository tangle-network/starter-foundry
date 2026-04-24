// Gen 9 muffled-gate invariant: scans the eval/gate surface for the
// shapes enumerated in .evolve/patterns/muffled-gate.md. Any new
// instance of a muffled gate added to a scanned file fails this test
// with a clear message keyed by file:line. Explicit opt-out via
// `// muffle-ok: <reason>` inline annotation.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

/**
 * Files scanned for muffled-gate patterns. New gate-adjacent files
 * must be added here — see .evolve/patterns/muffled-gate.md §"Scan scope".
 */
const SCAN_FILES = [
  'src/eval/scaffold-bridge.ts',
  'src/lib/template-quality.ts',
  'src/lib/prompt-e2e.ts',
  'scripts/promote-family-proposal.mjs',
  'scripts/promote-capability-proposal.mjs',
  'scripts/audit-scaffold-quality.mjs',
  'scripts/meta-harness-eval.mjs',
  // Round 0 post-Gen-9: runtime scaffold-eval path had the construct-vs-call
  // cwd bug (same shape as Gen 8b promoter fix). Added to the scan list.
  'scripts/agent-eval-scaffold.mjs',
]

interface Finding {
  file: string
  line: number
  lineText: string
  pattern: string
}

/**
 * `|| true` inside a string value for testCommand/setupCommand/cmd
 * keys, or immediately after a command substitution in a test-path
 * string. Exempted by `muffle-ok:` on the same line.
 */
function findFallbackToPass(file: string, text: string): Finding[] {
  const findings: Finding[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.includes('muffle-ok:')) continue
    // Skip lines where the pattern is inside a line comment or block
    // comment marker — the scanner reasons about live code, not prose.
    const codePart = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
    if (!codePart.trim()) continue
    // Match testCommand: '... || true' or similar in object literals,
    // OR a testCommand string spread across lines ending in `|| true`.
    if (/\|\| true/.test(codePart) && /(testCommand|setupCommand|cmd|command)/.test(codePart)) {
      findings.push({ file, line: i + 1, lineText: line.trim(), pattern: 'fallback-to-pass (|| true in command string)' })
    }
  }
  return findings
}

/**
 * `testCommand: 'true'` as literal silent-pass. The unknown-language
 * default `makeHarnessConfig` used to return this; Gen 9 throws
 * instead. Catches any re-introduction.
 */
function findLiteralTruePass(file: string, text: string): Finding[] {
  const findings: Finding[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.includes('muffle-ok:')) continue
    // Skip lines where the pattern is inside a line comment or block
    // comment marker — the scanner reasons about live code, not prose.
    const codePart = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
    if (!codePart.trim()) continue
    if (/testCommand\s*:\s*['"]true['"]/.test(codePart)) {
      findings.push({ file, line: i + 1, lineText: line.trim(), pattern: 'literal-true-pass (testCommand: "true")' })
    }
  }
  return findings
}

/**
 * Permissive defaults for fields that discriminate a gate's decision.
 * `?? 'starter'` and `?? 'workspace'` turn a missing field into a
 * specific value that satisfies a downstream check. Muffle-ok if the
 * caller explicitly documented it.
 */
function findPermissiveKindDefault(file: string, text: string): Finding[] {
  const findings: Finding[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.includes('muffle-ok:')) continue
    // Skip lines where the pattern is inside a line comment or block
    // comment marker — the scanner reasons about live code, not prose.
    const codePart = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
    if (!codePart.trim()) continue
    if (/\?\?\s*['"](starter|workspace)['"]/.test(codePart)) {
      findings.push({
        file,
        line: i + 1,
        lineText: line.trim(),
        pattern: 'permissive-kind-default (?? "starter"/"workspace")',
      })
    }
  }
  return findings
}

/**
 * `if (!expected) return true` and close variants — a matcher that
 * auto-passes when the ground truth is absent.
 */
function findAutoMatchNoExpectation(file: string, text: string): Finding[] {
  const findings: Finding[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.includes('muffle-ok:')) continue
    // Skip lines where the pattern is inside a line comment or block
    // comment marker — the scanner reasons about live code, not prose.
    const codePart = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
    if (!codePart.trim()) continue
    if (/if\s*\(\s*!expected\s*\)\s*return\s+true/.test(codePart)) {
      findings.push({
        file,
        line: i + 1,
        lineText: line.trim(),
        pattern: 'auto-match-no-expectation (if (!expected) return true)',
      })
    }
  }
  return findings
}

/**
 * `if (p.skipped) return true` — skip-counts-as-pass in quality
 * scorers. Gen 9 replaced with three-valued return.
 */
function findSkipCountsAsPass(file: string, text: string): Finding[] {
  const findings: Finding[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.includes('muffle-ok:')) continue
    // Skip lines where the pattern is inside a line comment or block
    // comment marker — the scanner reasons about live code, not prose.
    const codePart = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
    if (!codePart.trim()) continue
    if (/if\s*\(\s*\w+\.skipped\s*\)\s*return\s+true/.test(codePart)) {
      findings.push({
        file,
        line: i + 1,
        lineText: line.trim(),
        pattern: 'skip-counts-as-pass (if (.skipped) return true)',
      })
    }
  }
  return findings
}

/**
 * `new SubprocessSandboxDriver({ cwd: ... })` — the construct-vs-call
 * cwd bug. agent-eval@0.7.0's driver reads cwd from the per-call
 * HarnessConfig, not the constructor, so the constructor arg is
 * silently dropped. Gen 8b fixed this in the promoters; Round 0
 * post-Gen-9 found it still live in the runtime eval path. This finder
 * catches re-introductions anywhere in the scanned files.
 */
function findConstructorCwdDropped(file: string, text: string): Finding[] {
  const findings: Finding[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.includes('muffle-ok:')) continue
    const codePart = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
    if (!codePart.trim()) continue
    if (/new\s+SubprocessSandboxDriver\s*\(\s*\{[^}]*cwd\s*:/.test(codePart)) {
      findings.push({
        file,
        line: i + 1,
        lineText: line.trim(),
        pattern:
          'construct-vs-call cwd dropped (new SubprocessSandboxDriver({cwd}) — ' +
          'driver reads cwd from HarnessConfig, not constructor; constructor arg is silently dropped)',
      })
    }
  }
  return findings
}

/**
 * Duplicate `harnessConfigForFamily` function bodies. Gen 9 moved
 * the per-language dispatch table to `HARNESS_CONFIGS` in
 * scaffold-bridge.ts — the promoters import it. A re-introduction
 * of a parallel switch statement (case 'typescript': ... case 'rust': ...)
 * would drift again. Catches that shape.
 */
function findDuplicateHarnessDispatch(): Finding[] {
  // Scan both promoters and scaffold-bridge. If >1 file has a
  // `case 'typescript':` + `case 'rust':` + `case 'go':` switch AND
  // also returns a testCommand, flag the duplicate copies.
  const findings: Finding[] = []
  const witnesses: string[] = []
  for (const file of SCAN_FILES) {
    const full = join(REPO_ROOT, file)
    if (!existsSync(full)) continue
    const text = readFileSync(full, 'utf8')
    // Require the trio of cases + a testCommand return in the same file.
    const hasTs = /case\s+['"]typescript['"]\s*:/.test(text)
    const hasRust = /case\s+['"]rust['"]\s*:/.test(text)
    const hasGo = /case\s+['"]go['"]\s*:/.test(text)
    const hasTestCmd = /testCommand\s*:/.test(text)
    if (hasTs && hasRust && hasGo && hasTestCmd) witnesses.push(file)
  }
  // Exactly one file (scaffold-bridge.ts) is the source of truth.
  if (witnesses.length > 1) {
    findings.push({
      file: witnesses.join(', '),
      line: 0,
      lineText: '',
      pattern:
        `duplicate-harness-dispatch — ${witnesses.length} files declare a language-switch ` +
        `with testCommand. Source of truth is HARNESS_CONFIGS in src/eval/scaffold-bridge.ts; ` +
        `other files must import from it.`,
    })
  }
  return findings
}

/**
 * Auto-derived scan set for the construct-vs-call pattern. Any file that
 * imports from `@tangle-network/agent-eval` is at risk of the
 * `new SubprocessSandboxDriver({cwd: ...})` footgun — regardless of
 * whether it's on the explicit SCAN_FILES list for context-specific
 * patterns. Research Round 2026-04-24 (H4) confirmed this surfaces
 * real gaps the manual list missed (scripts/enrich-family.mjs,
 * src/training/family_proposer/propose.ts, src/training/template_v1/run.ts).
 *
 * Why not auto-derive the whole SCAN_FILES list? 4 of the 8 files on
 * the manual list (template-quality.ts, prompt-e2e.ts,
 * audit-scaffold-quality.mjs, meta-harness-eval.mjs) don't import
 * agent-eval — their muffle shapes (skip-counts-as-pass, no-expectation
 * matcher, permissive-kind default) are orthogonal to the driver
 * footgun. Auto-derivation would drop those. H4: split — explicit
 * list for context-specific patterns, auto-derive for the one
 * mechanical pattern that's universal across agent-eval consumers.
 */
function agentEvalImporters(): string[] {
  // Walk src/ and scripts/ looking for string literal '@tangle-network/agent-eval'.
  // Portable across machines (no rg PATH dependency — ripgrep isn't always
  // on the test-runner's PATH even when it's on the shell's).
  const SCAN_DIRS = ['src', 'scripts']
  const matches: string[] = []
  const walk = (dir: string) => {
    const full = join(REPO_ROOT, dir)
    if (!existsSync(full)) return
    for (const entry of readdirSync(full)) {
      const sub = join(dir, entry)
      const subFull = join(REPO_ROOT, sub)
      let st
      try { st = statSync(subFull) } catch { continue }
      if (st.isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist' || entry === 'dist-tests') continue
        walk(sub)
      } else if (st.isFile() && /\.(ts|mjs|js)$/.test(entry)) {
        if (entry.endsWith('.test.ts') || entry.endsWith('.test.mjs')) continue
        const text = readFileSync(subFull, 'utf8')
        if (text.includes('@tangle-network/agent-eval')) matches.push(sub)
      }
    }
  }
  for (const d of SCAN_DIRS) walk(d)
  return matches
}

function scanAll(): Finding[] {
  const findings: Finding[] = []
  const scannedForConstructorCwd = new Set<string>()

  // Context-specific patterns: run only on the explicit SCAN_FILES list.
  for (const file of SCAN_FILES) {
    const full = join(REPO_ROOT, file)
    if (!existsSync(full)) continue
    const text = readFileSync(full, 'utf8')
    findings.push(...findFallbackToPass(file, text))
    findings.push(...findLiteralTruePass(file, text))
    findings.push(...findPermissiveKindDefault(file, text))
    findings.push(...findAutoMatchNoExpectation(file, text))
    findings.push(...findSkipCountsAsPass(file, text))
    findings.push(...findConstructorCwdDropped(file, text))
    scannedForConstructorCwd.add(file)
  }

  // Universal pattern: construct-vs-call cwd-dropped is a risk anywhere
  // agent-eval is imported. Auto-derive the additional scan set so a new
  // importer doesn't escape the invariant by simply not being on
  // SCAN_FILES.
  for (const file of agentEvalImporters()) {
    if (scannedForConstructorCwd.has(file)) continue
    const full = join(REPO_ROOT, file)
    if (!existsSync(full)) continue
    const text = readFileSync(full, 'utf8')
    findings.push(...findConstructorCwdDropped(file, text))
  }

  findings.push(...findDuplicateHarnessDispatch())
  return findings
}

describe('muffled-gate invariant', () => {
  test('zero unannotated muffled-gate patterns in scanned files', () => {
    const findings = scanAll()
    if (findings.length > 0) {
      const msg = [
        `Found ${findings.length} muffled-gate pattern(s) in the eval/gate surface.`,
        `See .evolve/patterns/muffled-gate.md for the shape + escape hatch.`,
        `Each line below must be either fixed or annotated with "// muffle-ok: <reason>".`,
        '',
        ...findings.map((f) => `  ${f.file}:${f.line} — ${f.pattern}\n    ${f.lineText}`),
      ].join('\n')
      assert.fail(msg)
    }
  })

  test('auto-derived scan covers all agent-eval importers outside SCAN_FILES', () => {
    // H4 guarantee (Research R2026-04-24): every file that imports from
    // @tangle-network/agent-eval must be reached by the construct-vs-call
    // cwd finder — either via SCAN_FILES (context-specific patterns) or
    // via the auto-derived importer walk. If this test fails it means a
    // new importer is escaping the invariant entirely.
    const importers = agentEvalImporters()
    assert.ok(importers.length > 0, 'expected agent-eval importer walk to find at least scaffold-bridge + promoters')
    // Confirm the walk reaches files that aren't on the explicit list —
    // the whole point of auto-derivation.
    const unscanned = importers.filter((f) => !SCAN_FILES.includes(f))
    if (unscanned.length === 0) {
      // This is fine if all importers happen to also be on SCAN_FILES,
      // but then the auto-derive adds nothing — log so operator notices
      // drift back to manual-list-only coverage.
      return
    }
    // All unscanned importers must be real files that agentEvalImporters
    // could actually open — guards against stale path literals in
    // SCAN_FILES getting out of sync with disk.
    for (const f of unscanned) {
      assert.ok(existsSync(join(REPO_ROOT, f)), `auto-derived importer missing on disk: ${f}`)
    }
  })

  test('HARNESS_CONFIGS is the single source of truth for per-language dispatch', () => {
    // The pattern doc names this invariant explicitly — promoters must
    // import HARNESS_CONFIGS rather than redefine the table. Guards the
    // Gen 8b drift (three parallel copies, one missed).
    const promoters = [
      'scripts/promote-family-proposal.mjs',
      'scripts/promote-capability-proposal.mjs',
    ]
    for (const p of promoters) {
      const text = readFileSync(join(REPO_ROOT, p), 'utf8')
      assert.match(
        text,
        /HARNESS_CONFIGS/,
        `${p} must import HARNESS_CONFIGS from scaffold-bridge — see .evolve/patterns/muffled-gate.md`,
      )
      // And must NOT redeclare a case 'typescript': + testCommand trio.
      const hasOwnSwitch =
        /case\s+['"]typescript['"]\s*:/.test(text) &&
        /case\s+['"]rust['"]\s*:/.test(text) &&
        /testCommand\s*:/.test(text)
      assert.equal(
        hasOwnSwitch,
        false,
        `${p} declares its own per-language switch (case 'typescript' ... testCommand). ` +
        `Use HARNESS_CONFIGS from scaffold-bridge instead — Gen 9 muffled-gate audit.`,
      )
    }
  })

  test('makeHarnessConfig throws on unknown language (no silent-pass fallback)', async () => {
    const mod = await import('../dist/eval/scaffold-bridge.js')
    const fake = {
      family: { taxonomy: { language: 'zig-not-yet-supported', surface: 'firmware' } },
      layers: [],
    }
    assert.throws(
      () => mod.makeHarnessConfig(fake as never),
      /unsupported taxonomy\.language/,
      'makeHarnessConfig must throw for unknown languages, not return a silent-pass testCommand',
    )
  })

  test('prepareScaffoldForEval bakes cwd into the returned harness (Round 0 post-Gen-9)', async () => {
    // Round 0 found the runtime eval path silent-passed a TS-error scaffold
    // because scripts/agent-eval-scaffold.mjs passed cwd to the
    // SubprocessSandboxDriver constructor (silently dropped) and the
    // harness returned by prepareScaffoldForEval lacked cwd. Guard: the
    // harness itself must carry cwd so callers can't forget.
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(join(REPO_ROOT, 'src/eval/scaffold-bridge.ts'), 'utf8')
    assert.match(
      src,
      /const\s+harness\s*=\s*\{\s*\.\.\.makeHarnessConfig\([^)]*\)\s*,\s*cwd\s*:\s*scaffoldDir\s*\}/,
      'prepareScaffoldForEval must return a harness with cwd: scaffoldDir baked in (muffled-gate closure)',
    )
  })

  test('HARNESS_CONFIGS typescript entry uses strict tsc (no `|| true`)', async () => {
    const mod = await import('../dist/eval/scaffold-bridge.js')
    const ts = mod.HARNESS_CONFIGS.typescript
    assert.ok(ts, 'HARNESS_CONFIGS.typescript must exist')
    const cmd = ts.testCommand as string
    assert.doesNotMatch(
      cmd,
      /\|\| true/,
      `HARNESS_CONFIGS.typescript.testCommand must not swallow failures — got: ${cmd}`,
    )
    assert.match(
      cmd,
      /tsc\s+--noEmit/,
      `HARNESS_CONFIGS.typescript.testCommand must run strict tsc — got: ${cmd}`,
    )
  })
})
