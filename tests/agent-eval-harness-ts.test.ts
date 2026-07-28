// Tests for the agent-eval-harness-ts family + the three base eval layers
// it composes (agent-eval:scenarios / agent-eval:judge-rubric /
// agent-eval:regression). These are static-shape tests — they verify the
// registry shape, manifest contracts, file presence, and key invariants
// that would silently degrade quality if drifted.
//
// Regression bait — each test names the bug it would catch:
//
//   - Manifest declares files[] entries that don't exist on disk
//     (silent compose breakage, validate-registry catches some but not the
//      cross-file consistency between manifest + tieredKeywords).
//   - Family ships agent.json + AGENTS.md but AGENTS.md lacks required
//     frontmatter keys → agents-md-valid fails at scaffold time, but only
//     if a consumer actually composes the family. Test it here in CI.
//   - Layer manifests claim provides[]/requires[] but the chain breaks
//     (regression DAG: regression requires scenarios; judge-rubric requires
//      scenarios). If a refactor drops a `requires`, the harness composes
//      but the gate has no scenarios to read.
//   - Tier1 keywords overlap with another family — routing ambiguity.
//   - The runner's TS imports an export that no longer exists in
//     @tangle-network/agent-eval (covered by typecheck).
//   - The auto-research scaffold must keep the 0.19 multi-shot adapter as
//     the product-agent default, not regress to prompt-only evolution.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')
const FAMILY_DIR = join(REPO, 'registry/families/agent-eval-harness-ts')
const LAYERS_DIR = join(REPO, 'registry/layers/agent-eval')

interface FamilyManifest {
  id: string
  description: string
  tags: string[]
  taxonomy?: { language?: string; runtime?: string; surface?: string }
  files: Array<{ source: string; target: string }>
  validationChecks?: Array<{ type: string; path?: string }>
  tieredKeywords?: { tier1?: string[]; tier2?: string[]; tier3?: string[] }
  defaults?: Record<string, unknown>
}

interface LayerManifest {
  id: string
  group?: string
  slot?: string
  description: string
  appliesTo?: string[]
  provides?: string[]
  requires?: string[]
  files: Array<{ source: string; target: string }>
  validationChecks?: Array<{ type: string; path?: string }>
  tieredKeywords?: { tier1?: string[] }
}

function loadFamilyManifest(): FamilyManifest {
  return JSON.parse(readFileSync(join(FAMILY_DIR, 'manifest.json'), 'utf8')) as FamilyManifest
}

function loadLayerManifest(layerId: string): LayerManifest {
  return JSON.parse(
    readFileSync(join(LAYERS_DIR, layerId, 'manifest.json'), 'utf8'),
  ) as LayerManifest
}

test('agent-eval-harness-ts family exists with required shape', () => {
  const mf = loadFamilyManifest()
  assert.equal(mf.id, 'agent-eval-harness-ts', 'family id matches dir name')
  assert.equal(mf.taxonomy?.language, 'typescript')
  assert.equal(mf.taxonomy?.runtime, 'node')
  assert.equal(mf.taxonomy?.surface, 'eval-runner')
  // Description is the dispatcher's primary signal; > 60 chars enforces
  // operators write a real description, not a one-liner that strands routing.
  assert.ok(mf.description.length > 60, 'family description must be substantive')
})

test('every file declared in family manifest.files exists on disk', () => {
  const mf = loadFamilyManifest()
  const missing: string[] = []
  for (const f of mf.files) {
    const p = join(FAMILY_DIR, f.source)
    if (!existsSync(p)) missing.push(f.source)
  }
  assert.deepEqual(
    missing,
    [],
    `family manifest declares files[] that don't exist:\n  ${missing.join('\n  ')}`,
  )
})

test('AGENTS.md has frontmatter with required keys', () => {
  const agentsMd = readFileSync(join(FAMILY_DIR, 'files/AGENTS.md'), 'utf8')
  assert.ok(agentsMd.startsWith('---\n'), 'AGENTS.md must start with YAML frontmatter')
  const closeIdx = agentsMd.indexOf('\n---', 4)
  assert.notEqual(closeIdx, -1, 'AGENTS.md frontmatter must close')
  const block = agentsMd.slice(4, closeIdx)
  for (const required of ['name', 'role', 'domain', 'version']) {
    assert.match(
      block,
      new RegExp(`(^|\\n)${required}:`),
      `AGENTS.md frontmatter must declare ${required}`,
    )
  }
  // Body invariants — the muffled-gate pattern: a doc without explicit
  // refusal/sections is a silent rubber-stamp. Force at least Role + How.
  const sections = [...agentsMd.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1])
  assert.ok(
    sections.length >= 2,
    `AGENTS.md must have at least 2 ## sections; got ${sections.length}`,
  )
})

test('agent.json points systemPromptFile at AGENTS.md', () => {
  const agentJson = JSON.parse(readFileSync(join(FAMILY_DIR, 'files/agent.json'), 'utf8'))
  assert.equal(
    agentJson.prompt?.systemPromptFile,
    'AGENTS.md',
    'agent.json must declare systemPromptFile: AGENTS.md',
  )
  assert.equal(
    agentJson.permissions?.network,
    'deny',
    'eval harness must default to network: deny — gates router access through the harness, not free-form fetch',
  )
})

test('package.json pins @tangle-network/agent-eval to the current cohort', () => {
  const pkg = JSON.parse(readFileSync(join(FAMILY_DIR, 'files/package.json'), 'utf8'))
  const dep = pkg.dependencies?.['@tangle-network/agent-eval']
  assert.equal(
    dep,
    '0.134.2',
    `package.json must pin @tangle-network/agent-eval 0.134.2; got ${dep}`,
  )
  assert.ok(pkg.scripts?.eval, 'pnpm eval script must be wired')
  assert.ok(pkg.scripts?.['eval:gate'], 'pnpm eval:gate script must be wired')
})

test('runner.ts imports the agent-eval primitives we claim to compose', () => {
  const src = readFileSync(join(FAMILY_DIR, 'files/src/eval/runner.ts'), 'utf8')
  for (const symbol of [
    'FileSystemTraceStore',
    'FileSystemExperimentStore',
    'SubprocessSandboxDriver',
    'runTestGradedScenario',
  ]) {
    assert.match(
      src,
      new RegExp(`\\b${symbol}\\b`),
      `runner.ts must import ${symbol} from @tangle-network/agent-eval`,
    )
  }
})

test('runner.ts wires the 0.21 capture-integrity directives', () => {
  // Each primitive maps to one of the four directives in
  // SKILL.md § Capture integrity. Removing one reintroduces the
  // shipped-bug class (raw events lost / wrong route used silently /
  // partial capture undetected). The template must wire them by default
  // — see registry/families/agent-eval-harness-ts/files/AGENTS.md.
  const src = readFileSync(join(FAMILY_DIR, 'files/src/eval/runner.ts'), 'utf8')
  for (const symbol of [
    'FileSystemRawProviderSink', // Directive 1
    'assertLlmRoute', // Directive 2
    'assertRunCaptured', // Directive 3
  ]) {
    assert.match(
      src,
      new RegExp(`\\b${symbol}\\b`),
      `runner.ts must wire ${symbol} (capture-integrity directive)`,
    )
  }
  // The /traces subpath is the canonical import path for the integrity
  // surface — main barrel doesn't re-export FileSystemRawProviderSink.
  assert.match(
    src,
    /@tangle-network\/agent-eval\/traces/,
    'runner.ts must import integrity primitives from the /traces subpath',
  )
})

test('campaign.ts wraps runEvalCampaign with capture integrity by construction (0.22)', () => {
  const path = join(FAMILY_DIR, 'files/src/eval/campaign.ts')
  assert.ok(existsSync(path), 'campaign.ts must ship with the eval-harness template')
  const src = readFileSync(path, 'utf8')
  // 0.22 EvalCampaign + replay: the canonical entrypoint for benchmark sweeps
  assert.match(
    src,
    /\brunEvalCampaign\b/,
    'campaign.ts must import runEvalCampaign from agent-eval',
  )
  // Capture integrity wired by construction — see eval-campaign.ts in agent-eval
  assert.match(
    src,
    /\bFileSystemRawProviderSink\b/,
    'campaign.ts must wire FileSystemRawProviderSink via rawSinkFactory',
  )
  assert.match(
    src,
    /rawSinkFactory/,
    'campaign.ts must pass rawSinkFactory so every run gets per-run raw capture',
  )
})

test('CI workflow runs typecheck + eval and uploads scorecard artifact', () => {
  const yml = readFileSync(join(FAMILY_DIR, 'files/.github/workflows/eval.yml'), 'utf8')
  assert.match(yml, /pnpm typecheck/, 'eval CI must run pnpm typecheck')
  assert.match(yml, /pnpm eval/, 'eval CI must invoke pnpm eval')
  assert.match(yml, /upload-artifact/, 'eval CI must upload the scorecard artifact')
  assert.match(
    yml,
    /\.evolve\/scorecard\.json/,
    'eval CI must reference the .evolve/scorecard.json artifact path',
  )
})

test('scenarios layer provides eval:scenarios and applies to harness families', () => {
  const mf = loadLayerManifest('scenarios')
  assert.deepEqual(mf.provides, ['eval:scenarios'])
  assert.deepEqual(
    (mf.appliesTo ?? []).slice().sort(),
    ['agent-eval-harness-ts', 'agent-research-harness-ts'].sort(),
    'agent-eval:scenarios must apply to both TS harness families post-consolidation',
  )
  // Verify the loader file exists and has a load function.
  const loader = readFileSync(
    join(LAYERS_DIR, 'scenarios/files/src/eval/scenario-loader.ts'),
    'utf8',
  )
  assert.match(loader, /export async function loadScenarios/)
})

test('judge-rubric layer requires eval:scenarios and exposes a rubric runner', () => {
  const mf = loadLayerManifest('judge-rubric')
  assert.deepEqual(mf.provides, ['eval:judge-rubric'])
  assert.deepEqual(mf.requires, ['eval:scenarios'])
  assert.deepEqual(
    (mf.appliesTo ?? []).slice().sort(),
    ['agent-eval-harness-ts', 'agent-research-harness-ts'].sort(),
  )
  const runner = readFileSync(
    join(LAYERS_DIR, 'judge-rubric/files/src/eval/judges/rubric-runner.ts'),
    'utf8',
  )
  for (const symbol of [
    'buildRubricJudge',
    'calibrateRubric',
    'isCiGating',
    'CI_GATING_THRESHOLDS',
  ]) {
    assert.match(
      runner,
      new RegExp(`export\\b[\\s\\S]*?\\b${symbol}\\b`),
      `${symbol} must be exported`,
    )
  }
})

test('regression layer requires eval:scenarios and ships gate + CLI + workflow', () => {
  const mf = loadLayerManifest('regression')
  assert.deepEqual(mf.provides, ['eval:regression'])
  assert.deepEqual(mf.requires, ['eval:scenarios'])
  assert.deepEqual(
    (mf.appliesTo ?? []).slice().sort(),
    ['agent-eval-harness-ts', 'agent-research-harness-ts'].sort(),
  )
  // gate.ts must use the statistical primitives the manifest claims.
  const gate = readFileSync(
    join(LAYERS_DIR, 'regression/files/src/eval/regression/gate.ts'),
    'utf8',
  )
  for (const symbol of [
    'bootstrapCi',
    'welchsTTest',
    'cohensD',
    'compareToBaseline',
    'benjaminiHochberg',
  ]) {
    assert.match(gate, new RegExp(`\\b${symbol}\\b`), `gate.ts must use ${symbol}`)
  }
  // CLI must declare the three exit codes the README documents.
  const cli = readFileSync(join(LAYERS_DIR, 'regression/files/src/eval/regression/cli.ts'), 'utf8')
  assert.match(cli, /GATE_EXIT/, 'CLI must use the GATE_EXIT map for exit codes')
  // CI workflow must drive the gate against origin/main.
  const yml = readFileSync(
    join(LAYERS_DIR, 'regression/files/.github/workflows/regression-gate.yml'),
    'utf8',
  )
  assert.match(yml, /origin\/main/, 'regression CI must compare against origin/main')
  assert.match(yml, /pnpm eval:gate/, 'regression CI must invoke pnpm eval:gate')
})

test('every layer file declared in manifest.files exists on disk', () => {
  for (const layerId of ['scenarios', 'judge-rubric', 'regression']) {
    const mf = loadLayerManifest(layerId)
    const missing: string[] = []
    for (const f of mf.files) {
      const p = join(LAYERS_DIR, layerId, f.source)
      if (!existsSync(p)) missing.push(f.source)
    }
    assert.deepEqual(
      missing,
      [],
      `agent-eval:${layerId} declares files[] that don't exist:\n  ${missing.join('\n  ')}`,
    )
  }
})

test('auto-research layer exports the campaign optimizer + run-analysis bridge', () => {
  const loop = readFileSync(
    join(LAYERS_DIR, 'auto-research/files/src/eval/auto-research/loop.ts'),
    'utf8',
  )
  assert.match(loop, /\brunOptimization\b/, 'loop must import runOptimization')
  assert.match(
    loop,
    /export async function runMultiShotTrajectoryOptimization/,
    'loop must expose the scaffold-level multi-shot wrapper',
  )
  assert.match(
    loop,
    /promot|holdout|actionable side/i,
    'loop docs must preserve promotion/ASI semantics for generated harnesses',
  )

  // Current run-analysis bridge: analyzeRuns is the canonical post-sweep
  // primitive for evidence-backed launch decision reports.
  assert.match(
    loop,
    /\banalyzeRuns\b/,
    'loop must import analyzeRuns from @tangle-network/agent-eval/contract',
  )
  assert.match(
    loop,
    /@tangle-network\/agent-eval\/contract/,
    'loop must import the run-analysis bridge from the /contract subpath',
  )
  assert.match(
    loop,
    /export async function analyzeOptimization\b/,
    'loop must expose analyzeOptimization as the scaffold-level run-analysis entrypoint',
  )

  const barrel = readFileSync(
    join(LAYERS_DIR, 'auto-research/files/src/eval/auto-research/index.ts'),
    'utf8',
  )
  assert.match(
    barrel,
    /\brunMultiShotTrajectoryOptimization\b/,
    'barrel must re-export the multi-shot wrapper',
  )
  assert.match(barrel, /\banalyzeOptimization\b/, 'barrel must re-export the RL-bridge wrapper')
})

test('tier1 keywords are eval-suffixed multi-word phrases (no bare nouns)', () => {
  // Per Gen-15 W1 spec: tier1 keywords must be eval-suffixed multi-word phrases
  // like `eval-harness-ts`, never bare nouns like `eval` or `rubric`. Bare
  // nouns explode tier1 overlap — a `rubric` tier1 collides with every
  // judge-rubric variant the registry will ever ship.
  const FAMILY_BARE_BANLIST = new Set(['eval', 'rubric', 'judge', 'scenario', 'gate', 'harness'])
  const family = loadFamilyManifest()
  const familyTier1 = family.tieredKeywords?.tier1 ?? []
  assert.ok(familyTier1.length > 0, 'family must declare tier1 keywords')
  for (const kw of familyTier1) {
    assert.ok(
      !FAMILY_BARE_BANLIST.has(kw),
      `family tier1 keyword "${kw}" is a bare noun — must be multi-word eval-suffixed phrase`,
    )
    assert.ok(kw.includes('-') || kw.includes(' '), `family tier1 "${kw}" must be multi-word`)
  }
  for (const layerId of ['scenarios', 'judge-rubric', 'regression']) {
    const mf = loadLayerManifest(layerId)
    const t1 = mf.tieredKeywords?.tier1 ?? []
    for (const kw of t1) {
      assert.ok(
        !FAMILY_BARE_BANLIST.has(kw),
        `layer ${layerId} tier1 keyword "${kw}" is a bare noun — banned`,
      )
    }
  }
})

test('no tier1 keyword collisions across new family + layers + existing registry', () => {
  // Per the muffled-gate / overlap-routing pattern: two families (or family
  // + layer) sharing a tier1 keyword strand routing — operator prompts that
  // hit the keyword resolve nondeterministically. Surface every overlap.
  const newKeywords = new Map<string, string[]>()
  const family = loadFamilyManifest()
  for (const kw of family.tieredKeywords?.tier1 ?? []) {
    newKeywords.set(kw, ['family:agent-eval-harness-ts'])
  }
  for (const layerId of ['scenarios', 'judge-rubric', 'regression']) {
    const mf = loadLayerManifest(layerId)
    for (const kw of mf.tieredKeywords?.tier1 ?? []) {
      const arr = newKeywords.get(kw) ?? []
      arr.push(`layer:agent-eval:${layerId}`)
      newKeywords.set(kw, arr)
    }
  }
  // Walk every family in the registry and check overlap with our new tier1s.
  const FAMILIES = readdirSync(join(REPO, 'registry/families')).filter(
    (f) => !f.startsWith('.') && f !== 'agent-eval-harness-ts',
  )
  const collisions: string[] = []
  for (const fam of FAMILIES) {
    const mfPath = join(REPO, 'registry/families', fam, 'manifest.json')
    if (!existsSync(mfPath)) continue
    const mf = JSON.parse(readFileSync(mfPath, 'utf8'))
    const t1: string[] = mf.tieredKeywords?.tier1 ?? []
    for (const kw of t1) {
      if (newKeywords.has(kw)) {
        collisions.push(`"${kw}" — ${fam} <-> ${newKeywords.get(kw)!.join(',')}`)
      }
    }
  }
  assert.deepEqual(
    collisions,
    [],
    `tier1 keyword collisions (routing ambiguity):\n  ${collisions.join('\n  ')}`,
  )
})
