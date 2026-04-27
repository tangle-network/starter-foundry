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
  // Gen-15 eval-shape layers — these emit measurement signals (CI,
  // Cohen's d, per-turn aggregate scores). The Gen-15.1 audit found
  // three muffled-gate instances here that the Gen-9 SCAN_FILES did
  // not cover; adding them prevents re-introduction.
  'registry/layers/agent-eval/trace-multi-turn/files/src/eval/trace/per-turn-scorer.ts',
  'registry/families/agent-research-harness-ts/files/src/research/screener.ts',
  'registry/families/agent-research-harness-ts/files/src/research/validator.ts',
  'registry/families/agent-eval-harness-py/files/src/eval/regression.py',
  'registry/layers/agent-eval/judge-pairwise/files/src/eval/judges/pairwise-runner.ts',
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
 * Gen-15 muffled-gate sub-shape #1: ternary returning literal `0` for an
 * unmeasured/zero-weight branch, with no adjacent `unmeasured`/`null`
 * status. Pattern caught: `weightTotal > 0 ? weightedSum / weightTotal : 0`
 * where the variable name carries score/metric/aggregate semantics.
 *
 * The fix is to return `null` + a `status: 'unmeasured'` field. Lines
 * with the `unmeasured` literal nearby (same line or adjacent lines) are
 * accepted — they're explicitly disambiguating the branch.
 */
const findUnmeasuredZero: MuffledFinder = (file, text) => {
  const out = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.includes('muffle-ok:')) continue
    const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
    if (!code.trim()) continue
    // Muffled-gate shape: ternary whose CONDITION is a denominator-style
    // ">0 / .length / != 0" guard and whose FALSE branch is literal `0`.
    // That's the exact shape that masks "no rubric matched / nothing
    // graded / count was zero" as if it were a measurement of zero.
    //
    // Excluded by design: `cond ? 1 : 0` (deterministic binary score),
    // `cond ? expr : null` (already disambiguated), and any branch
    // returning a non-zero literal.
    const ternaryMatch =
      /(\w[\w.\[\]]*)\s*(?:>\s*0|!==?\s*0|\.length\s*>\s*0)\s*\?\s*([^?:]+?)\s*:\s*0\b/.exec(code)
    if (
      ternaryMatch &&
      // Match the keywords as case-insensitive substrings; camelCase
      // identifiers like `aggregateScore` / `overallRate` count.
      /(score|metric|aggregate|mean|rate)/i.test(code) &&
      !/\bnull\b/.test(code) &&
      ternaryMatch[2]!.trim() !== '1' && // binary 0/1 score is not a muffle
      ternaryMatch[2]!.trim() !== '0'
    ) {
      // Window of ±2 lines: if a true `'unmeasured'` literal status or a
      // `: null` companion appears nearby, the author has explicitly
      // disambiguated the branch — accept.
      const window = lines
        .slice(Math.max(0, i - 2), i + 3)
        // Strip comments before window check so a comment containing
        // "unmeasured" doesn't whitewash a real muffle.
        .map((l) => l.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, ''))
        .join('\n')
      if (/['"]unmeasured['"]/.test(window) || /:\s*null\b/.test(window)) continue
      out.push({
        file,
        line: i + 1,
        lineText: line.trim(),
        pattern: 'unmeasured-zero-ternary (`x > 0 ? expr : 0` with no unmeasured/null sibling)',
      })
    }
  }
  return out
}

/**
 * Gen-15 muffled-gate sub-shape #2: degenerate CI where `lower` and
 * `upper` reference the SAME identifier (collapses to a point, not an
 * interval estimate). Pre-fix the screener wrote `{ lower: delta,
 * upper: delta }` to satisfy a non-null contract.
 *
 * The fix is to surface `null` plus an `estimate-only` verdict.
 */
const findDegenerateCi: MuffledFinder = (file, text) => {
  const out = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.includes('muffle-ok:')) continue
    const code = line.replace(/\/\/.*$/, '')
    // `{ lower: <ident>, upper: <same-ident> }` — same identifier in
    // both slots is the muffled gate. Allow numeric literals (a real
    // hard-coded interval is a different smell, not this one).
    const match =
      /\{\s*lower\s*:\s*([A-Za-z_$][\w$]*)\s*,\s*upper\s*:\s*([A-Za-z_$][\w$]*)\s*\}/.exec(code)
    if (match && match[1] === match[2]) {
      out.push({
        file,
        line: i + 1,
        lineText: line.trim(),
        pattern: `degenerate-ci ({ lower: ${match[1]}, upper: ${match[2]} } — same identifier ⇒ no interval)`,
      })
    }
  }
  return out
}

/**
 * Gen-15 muffled-gate sub-shape #3: `cohensD: 0` / `cohens_d: 0` literal
 * adjacent to a 1-rep / `reps: 1` declaration. Cohen's d at n=1 is
 * statistically undefined — writing `0` masks the absence of an estimate.
 * The fix is `cohensD: null` with a verdict that forbids promotion on
 * n=1 inputs.
 */
const findFakeEffectSize: MuffledFinder = (file, text) => {
  const out = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.includes('muffle-ok:')) continue
    const code = line.replace(/\/\/.*$/, '')
    if (!/\b(cohensD|cohens_d)\s*:\s*0\b/.test(code)) continue
    // Look for `reps: 1` in a ±5-line window — same object literal.
    const window = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 6)).join('\n')
    if (/\breps\s*:\s*1\b/.test(window) || /\brep_count\s*:\s*1\b/.test(window)) {
      out.push({
        file,
        line: i + 1,
        lineText: line.trim(),
        pattern: "fake-effect-size (cohensD: 0 alongside reps: 1 — n=1 has no Cohen's d)",
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
      finders: [
        ...DEFAULT_FINDERS,
        ...UNIVERSAL_FINDERS,
        findPermissiveKindDefault,
        findUnmeasuredZero,
        findDegenerateCi,
        findFakeEffectSize,
      ],
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
    for (const p of [
      'scripts/promote-family-proposal.ts',
      'scripts/promote-capability-proposal.ts',
    ]) {
      const text = readFileSync(join(REPO_ROOT, p), 'utf8')
      assert.match(text, /HARNESS_CONFIGS/, `${p} must import HARNESS_CONFIGS from scaffold-bridge`)
    }
  })

  test('makeHarnessConfig throws on unknown language (no silent-pass fallback)', async () => {
    const mod = await import('../dist/eval/scaffold-bridge.js')
    const fake = {
      family: { taxonomy: { language: 'zig-not-yet-supported', surface: 'firmware' } },
      layers: [],
    }
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

// Gen-15.1 sub-shape finders — verified against fixtures so a future
// refactor can't silently weaken them. Each fixture contains both a
// muffled instance (must be flagged) and an acceptable case (must NOT
// be flagged).
describe('muffled-gate finders: Gen-15.1 sub-shapes', () => {
  const FIXTURES = join(REPO_ROOT, 'tests/fixtures/muffled-gate')

  test('findUnmeasuredZero detects ternary-returns-0 without unmeasured sibling', () => {
    const text = readFileSync(join(FIXTURES, 'unmeasured-zero.fixture.txt'), 'utf8')
    const findings = findUnmeasuredZero('unmeasured-zero.fixture.txt', text)
    assert.equal(
      findings.length,
      2,
      `expected 2 unmeasured-zero findings, got ${findings.length}: ${JSON.stringify(findings, null, 2)}`,
    )
    // Lines 3 and 4 are the muffled instances; line 6 is acceptable
    // (the literal `'unmeasured'` would whitelist it, comments do not).
    assert.deepEqual(
      findings.map((f) => f.line).sort((a, b) => a - b),
      [3, 7],
    )
  })

  test('findDegenerateCi detects { lower: x, upper: x } same-identifier', () => {
    const text = readFileSync(join(FIXTURES, 'degenerate-ci.fixture.txt'), 'utf8')
    const findings = findDegenerateCi('degenerate-ci.fixture.txt', text)
    assert.equal(findings.length, 1, 'must flag the {lower:delta,upper:delta} line only')
    assert.equal(findings[0]!.line, 2)
    assert.match(findings[0]!.pattern, /degenerate-ci/)
  })

  test('findFakeEffectSize detects cohensD: 0 with reps: 1 in same window', () => {
    const text = readFileSync(join(FIXTURES, 'fake-effect-size.fixture.txt'), 'utf8')
    const findings = findFakeEffectSize('fake-effect-size.fixture.txt', text)
    assert.equal(findings.length, 1, 'must flag only the reps:1 + cohensD:0 instance')
    // Line 9 in the fixture: cohensD: 0 inside the reps:1 object.
    assert.equal(findings[0]!.line, 9)
  })

  test('codebase-wide scan with new finders surfaces ZERO findings post-Gen-15.1-fix', () => {
    // After this PR, the previously-muffled instances are fixed. Re-run
    // ALL three new finders against the SCAN_FILES and assert clean.
    let total = 0
    for (const file of SCAN_FILES) {
      const abs = join(REPO_ROOT, file)
      if (!existsSync(abs)) continue
      const text = readFileSync(abs, 'utf8')
      total += findUnmeasuredZero(file, text).length
      total += findDegenerateCi(file, text).length
      total += findFakeEffectSize(file, text).length
    }
    assert.equal(total, 0, 'no Gen-15.1 muffled-gate sub-shapes should remain post-fix')
  })
})
