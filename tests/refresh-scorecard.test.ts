// Integration tests for scripts/refresh-scorecard.mjs.
//
// Runs the script against synthetic inputs in a temp dir and asserts the
// emitted scorecard.json has the right values, targets, staleness flags,
// and the new Gen-2 inputs manifest. Prevents silent refactor regressions
// where a flow's computation flips direction or input source.
//
// Gen-2 added: inputs manifest, staleness gates, run-weighted median turns.

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO = resolve(fileURLToPath(new URL('../', import.meta.url)))
const SCRIPT = join(REPO, 'scripts/refresh-scorecard.mjs')

function runScorecardIn(fixtureDir: string): { code: number; stdout: string } {
  // Gen-2: STARTER_FOUNDRY_REPO_OVERRIDE redirects the scorecard's REPO
  // resolution to the fixture dir, so it reads .evolve/ from the fixture
  // and writes scorecard.json back to the fixture. No global state touched.
  const res = spawnSync('node', [SCRIPT], {
    cwd: fixtureDir,
    encoding: 'utf8',
    env: { ...process.env, STARTER_FOUNDRY_REPO_OVERRIDE: fixtureDir },
  })
  return { code: res.status ?? -1, stdout: res.stdout + '\n' + res.stderr }
}

function writeFixture(dir: string, opts: {
  buildoutsJsonl?: string
  buildoutAnalysis?: object | null
  capabilityGaps?: object | null
  scaffoldAudit?: object | null
  markStaleBy?: 'buildout' | 'gaps' | 'audit' | 'none'
}): void {
  mkdirSync(join(dir, '.evolve/traces'), { recursive: true })
  mkdirSync(join(dir, 'registry/families'), { recursive: true })
  mkdirSync(join(dir, 'registry/layers/capability'), { recursive: true })
  mkdirSync(join(dir, 'registry/partners'), { recursive: true })
  if (opts.buildoutsJsonl !== undefined) {
    writeFileSync(join(dir, '.evolve/traces/buildouts.jsonl'), opts.buildoutsJsonl)
  }
  if (opts.buildoutAnalysis !== undefined && opts.buildoutAnalysis !== null) {
    writeFileSync(join(dir, '.evolve/buildout-analysis.json'), JSON.stringify(opts.buildoutAnalysis))
  }
  if (opts.capabilityGaps !== undefined && opts.capabilityGaps !== null) {
    writeFileSync(join(dir, '.evolve/capability-gaps.json'), JSON.stringify(opts.capabilityGaps))
  }
  if (opts.scaffoldAudit !== undefined && opts.scaffoldAudit !== null) {
    writeFileSync(join(dir, '.evolve/scaffold-quality-audit.json'), JSON.stringify(opts.scaffoldAudit))
  }
  // Registry placeholders so family/capability/partner counts are known.
  mkdirSync(join(dir, 'registry/families/f1'), { recursive: true })
  mkdirSync(join(dir, 'registry/layers/capability/c1'), { recursive: true })
  mkdirSync(join(dir, 'registry/partners/p1'), { recursive: true })

  // If requested, backdate one input so the staleness gate triggers.
  // Set the buildouts.jsonl mtime to NOW; the target input mtime to 1hr ago.
  const now = Date.now() / 1000
  const oneHourAgo = (Date.now() - 3600_000) / 1000
  if (opts.buildoutsJsonl) {
    try { utimesSync(join(dir, '.evolve/traces/buildouts.jsonl'), now, now) } catch { /* noop */ }
  }
  const backdate = (sub: string) => {
    try { utimesSync(join(dir, sub), oneHourAgo, oneHourAgo) } catch { /* noop */ }
  }
  if (opts.markStaleBy === 'buildout') backdate('.evolve/buildout-analysis.json')
  if (opts.markStaleBy === 'gaps') backdate('.evolve/capability-gaps.json')
  if (opts.markStaleBy === 'audit') backdate('.evolve/scaffold-quality-audit.json')
}

describe('refresh-scorecard', () => {
  test('run-weighted median turns comes from buildouts.jsonl directly', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scorecard-test-'))
    try {
      // 5 runs with turn counts [10, 20, 30, 40, 50] → median = 30
      const lines = [10, 20, 30, 40, 50].map((t, i) => JSON.stringify({
        outcome: { toolCallsTotal: t, allPass: true },
        scenarioId: `s${i}`,
      })).join('\n')
      writeFixture(dir, {
        buildoutsJsonl: lines,
        buildoutAnalysis: {
          summary: { passRate: 0.8, costRollup: {} },
          perScenario: [{ meanTurns: 30 }],
          topRewrittenFiles: [{ timesRewritten: 3 }],
        },
      })
      const res = runScorecardIn(dir)
      assert.equal(res.code, 0, `script failed: ${res.stdout}`)
      const out = JSON.parse(readFileSync(join(dir, '.evolve/scorecard.json'), 'utf8'))
      const runW = out.flows.find((f: any) => f.name === 'median_turns_per_buildout_run_weighted')
      assert.equal(runW.value, 30, 'run-weighted median of [10,20,30,40,50] should be 30')
      assert.equal(runW.direction, 'lower-better')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('inputs manifest records every JSON read with mtimes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scorecard-test-'))
    try {
      writeFixture(dir, {
        buildoutsJsonl: JSON.stringify({ outcome: { toolCallsTotal: 50 }, scenarioId: 's1' }),
        buildoutAnalysis: { summary: { passRate: 1, costRollup: {} }, perScenario: [], topRewrittenFiles: [] },
        capabilityGaps: { breakdown: { scaffoldGap: 0, orchestration: 0 } },
        scaffoldAudit: { audits: [{ phases: [{ ok: true }] }] },
      })
      const res = runScorecardIn(dir)
      assert.equal(res.code, 0, res.stdout)
      const out = JSON.parse(readFileSync(join(dir, '.evolve/scorecard.json'), 'utf8'))
      assert.ok(Array.isArray(out.inputs), 'scorecard should emit inputs[]')
      const paths = out.inputs.map((i: any) => i.path)
      assert.ok(paths.some((p: string) => p.includes('buildout-analysis')), 'includes buildout-analysis.json')
      assert.ok(paths.some((p: string) => p.includes('capability-gaps')), 'includes capability-gaps.json')
      assert.ok(paths.some((p: string) => p.includes('scaffold-quality-audit')), 'includes scaffold-quality-audit.json')
      for (const entry of out.inputs) {
        assert.match(entry.mtime, /^\d{4}-\d{2}-\d{2}T/, 'mtime is ISO 8601')
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('stale input flags the downstream flow', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scorecard-test-'))
    try {
      writeFixture(dir, {
        // buildouts.jsonl is NOW; buildout-analysis.json is backdated → stale
        buildoutsJsonl: JSON.stringify({ outcome: { toolCallsTotal: 50 }, scenarioId: 's1' }),
        buildoutAnalysis: { summary: { passRate: 0.9, costRollup: {} }, perScenario: [], topRewrittenFiles: [{ timesRewritten: 7 }] },
        capabilityGaps: { breakdown: { scaffoldGap: 5, orchestration: 2 } },
        scaffoldAudit: { audits: [{ phases: [{ ok: true }] }] },
        markStaleBy: 'buildout',
      })
      const res = runScorecardIn(dir)
      assert.equal(res.code, 0, res.stdout)
      const out = JSON.parse(readFileSync(join(dir, '.evolve/scorecard.json'), 'utf8'))
      assert.equal(out.stale?.anyFlowStale, true, 'anyFlowStale should trip')
      assert.equal(out.stale?.buildout, true, 'buildout input is stale')
      // Flows reading from buildout are marked stale individually.
      const passRate = out.flows.find((f: any) => f.name === 'buildout_pass_rate')
      assert.equal(passRate.stale, true, 'buildout_pass_rate is marked stale')
      // Flows NOT reading from the stale input should not be marked.
      const gaps = out.flows.find((f: any) => f.name === 'scaffold_gap_installs')
      assert.notEqual(gaps.stale, true, 'scaffold_gap_installs (from capability-gaps) is NOT stale in this fixture')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('missing inputs produce unmeasured flows, not crashes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scorecard-test-'))
    try {
      // Only buildouts.jsonl — no analysis, gaps, or audit.
      writeFixture(dir, {
        buildoutsJsonl: JSON.stringify({ outcome: { toolCallsTotal: 42 } }),
      })
      const res = runScorecardIn(dir)
      assert.equal(res.code, 0, res.stdout)
      const out = JSON.parse(readFileSync(join(dir, '.evolve/scorecard.json'), 'utf8'))
      // Run-weighted median SHOULD be computed (from buildouts.jsonl directly).
      const runW = out.flows.find((f: any) => f.name === 'median_turns_per_buildout_run_weighted')
      assert.equal(runW.value, 42)
      // buildout_pass_rate should be unmeasured (no analysis).
      const passRate = out.flows.find((f: any) => f.name === 'buildout_pass_rate')
      assert.equal(passRate.status, 'unmeasured')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  // Gen-3: counterfactual fallback. When main analysis is stale AND
  // internal analysis is fresh, scorecard reads from internal and marks
  // the buildout-derived flows with source:'counterfactual' instead of
  // stale:true.
  test('counterfactual fallback substitutes when main stale + internal fresh', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scorecard-cf-test-'))
    try {
      writeFixture(dir, {
        buildoutsJsonl: JSON.stringify({ outcome: { toolCallsTotal: 50, allPass: true }, scenarioId: 's1' }),
        // Main stale pass rate = 0.5
        buildoutAnalysis: { summary: { passRate: 0.5, costRollup: {} }, perScenario: [], topRewrittenFiles: [] },
        markStaleBy: 'buildout',
      })
      // Internal analysis is fresh + has a different pass rate (0.99) so we
      // can tell which source the scorecard read from.
      mkdirSync(join(dir, '.evolve'), { recursive: true })
      writeFileSync(
        join(dir, '.evolve/buildout-analysis-internal.json'),
        JSON.stringify({
          schemaVersion: 1,
          generator: 'starter-foundry:replay-traces',
          summary: { passRate: 0.99, costRollup: {} },
          perScenario: [],
        }),
      )
      const res = runScorecardIn(dir)
      assert.equal(res.code, 0, res.stdout)
      const out = JSON.parse(readFileSync(join(dir, '.evolve/scorecard.json'), 'utf8'))
      assert.equal(out.buildoutSource, 'counterfactual', 'buildoutSource marker present')
      const passRate = out.flows.find((f: any) => f.name === 'buildout_pass_rate')
      // Scorecard should have read 0.99 (internal), not 0.5 (main/stale).
      assert.equal(passRate.value, 0.99, 'read from internal when main stale')
      assert.notEqual(passRate.stale, true, 'not stale when counterfactual substitutes')
      assert.equal(passRate.source, 'counterfactual', 'source marker on the flow')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('counterfactual NOT used when main is fresh', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scorecard-cf-test-'))
    try {
      writeFixture(dir, {
        buildoutsJsonl: JSON.stringify({ outcome: { toolCallsTotal: 50, allPass: true }, scenarioId: 's1' }),
        buildoutAnalysis: { summary: { passRate: 0.75, costRollup: {} }, perScenario: [], topRewrittenFiles: [] },
      })
      // Both main and internal exist, both fresh. Scorecard should prefer main.
      mkdirSync(join(dir, '.evolve'), { recursive: true })
      writeFileSync(
        join(dir, '.evolve/buildout-analysis-internal.json'),
        JSON.stringify({ summary: { passRate: 0.99, costRollup: {} }, perScenario: [] }),
      )
      const res = runScorecardIn(dir)
      assert.equal(res.code, 0, res.stdout)
      const out = JSON.parse(readFileSync(join(dir, '.evolve/scorecard.json'), 'utf8'))
      assert.equal(out.buildoutSource, 'historical', 'historical when main fresh')
      const passRate = out.flows.find((f: any) => f.name === 'buildout_pass_rate')
      assert.equal(passRate.value, 0.75, 'read from main when fresh')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
