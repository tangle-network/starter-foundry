// Workspace preset regression guard. Locks in the Gen-15 W6 contract:
//
//   1. Preset registry exposes at least the two canonical presets
//      (app+agent+eval, app+agent+eval+research) with all required fields
//      populated. Catches accidental field deletion / preset drift.
//   2. `composePresetWorkspace --preset app+agent+eval` produces a
//      3-bundle workspace structure on disk (root scaffolding + per-bundle
//      subdirs). Skipped with documented reason when the W1/W3 harness
//      families have not landed yet — the builder-level tests still run.
//   3. Env wiring lands in each receiving bundle's .env with the placeholder
//      values declared in the preset.
//   4. Top-level package.json scripts mirror the preset's topLevelScripts.
//   5. CI workflow YAML structure: `name:`, `on:`, `jobs:`, `runs:` and
//      pnpm/checkout/setup-node steps. We assert on literal lines instead
//      of running js-yaml because js-yaml is not in the dep tree (the
//      writer's output is fully deterministic so line-shape == YAML
//      validity for our purposes).
//   6. Slot-validation rejects family IDs that don't match the slot's
//      `choose` constraint, including glob patterns like
//      `agent-runtime-*-ts`.
//
// Memory: Gen-15 W6 ships preset-driven workspace composition so users can
// say `workspace-compose --preset app+agent+eval` instead of authoring
// multi-project specs. The preset registry IS the public contract for the
// CLI flag — drift surfaces here.

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

import { createTempDir, removeDir } from '../dist/lib/fs.js'
import { loadRegistry } from '../dist/lib/registry.js'
import {
  WORKSPACE_PRESETS,
  buildCiYaml,
  buildEnvFileForSlot,
  buildPnpmWorkspaceYaml,
  buildPresetReadme,
  buildRootPackageJson,
  buildWorkspaceSpecFromPreset,
  composePresetWorkspace,
  getWorkspacePreset,
  listWorkspacePresets,
  resolvePresetChoices,
} from '../dist/lib/workspace-presets.js'

async function harnessFamiliesPresent(): Promise<{ eval: boolean; research: boolean }> {
  const registry = await loadRegistry()
  return {
    eval: registry.families.has('agent-eval-harness-ts'),
    research: registry.families.has('agent-research-harness-ts'),
  }
}

// ── 1. Registry shape ────────────────────────────────────────────────────

test('WORKSPACE_PRESETS has at least 2 presets with required fields populated', () => {
  const presets = listWorkspacePresets()
  assert.ok(presets.length >= 2, `expected ≥2 presets, got ${presets.length}`)
  const ids = presets.map((p) => p.id)
  assert.ok(ids.includes('app+agent+eval'), `missing app+agent+eval; got ${ids.join(', ')}`)
  assert.ok(
    ids.includes('app+agent+eval+research'),
    `missing app+agent+eval+research; got ${ids.join(', ')}`,
  )

  for (const preset of presets) {
    assert.ok(preset.id, 'preset id required')
    assert.ok(preset.description.length > 10, `preset ${preset.id} needs real description`)
    assert.ok(preset.slots.length >= 3, `preset ${preset.id} needs ≥3 slots`)
    assert.ok(preset.envWiring.length >= 1, `preset ${preset.id} needs env wiring`)
    assert.ok(
      Object.keys(preset.topLevelScripts).length >= 2,
      `preset ${preset.id} needs ≥2 top-level scripts`,
    )
    assert.ok(preset.ciSteps.length >= 1, `preset ${preset.id} needs CI steps`)

    for (const slot of preset.slots) {
      assert.ok(slot.id, `preset ${preset.id} has slot with no id`)
      assert.ok(
        slot.choose.length >= 1,
        `preset ${preset.id} slot ${slot.id} has no choose entries`,
      )
    }
  }
})

test('getWorkspacePreset throws on unknown id with helpful message', () => {
  assert.throws(
    () => getWorkspacePreset('nonexistent-preset'),
    /Unknown workspace preset.*Known presets/,
  )
})

test('app+agent+eval preset advertises agent-runtime-*-ts glob and exact harness IDs', () => {
  const preset = getWorkspacePreset('app+agent+eval')
  const agentSlot = preset.slots.find((s) => s.id === 'agent')
  const evalSlot = preset.slots.find((s) => s.id === 'eval')
  assert.ok(agentSlot?.choose.includes('agent-runtime-*-ts'))
  assert.ok(evalSlot?.choose.includes('agent-eval-harness-ts'))
})

test('app+agent+eval+research preset adds research slot + research script + research wire', () => {
  const preset = getWorkspacePreset('app+agent+eval+research')
  assert.ok(preset.slots.some((s) => s.id === 'research'))
  assert.ok(preset.topLevelScripts.research)
  assert.ok(preset.envWiring.some((w) => w.to === 'research' && w.toVar === 'RESEARCH_TARGET_URL'))
  assert.ok(preset.ciSteps.includes('pnpm research'))
})

// ── 2. Choice resolution ─────────────────────────────────────────────────

test('resolvePresetChoices rejects family that does not match `choose`', () => {
  const preset = getWorkspacePreset('app+agent+eval')
  assert.throws(
    () =>
      resolvePresetChoices(preset, {
        app: 'nextjs-ts',
        agent: 'agent-runtime-recruiter-ts',
      }),
    /slot "app" does not accept family "nextjs-ts"/,
  )
})

test('resolvePresetChoices accepts glob match `agent-runtime-*-ts`', () => {
  const preset = getWorkspacePreset('app+agent+eval')
  const resolved = resolvePresetChoices(preset, {
    agent: 'agent-runtime-recruiter-ts',
  })
  assert.equal(resolved.agent, 'agent-runtime-recruiter-ts')
  assert.equal(resolved.app, 'agent-with-ui-ts') // default applied
  assert.equal(resolved.eval, 'agent-eval-harness-ts') // default applied
})

test('resolvePresetChoices rejects glob mismatch (wrong prefix)', () => {
  const preset = getWorkspacePreset('app+agent+eval')
  assert.throws(
    () =>
      resolvePresetChoices(preset, {
        agent: 'react-vite-ts',
      }),
    /slot "agent" does not accept family "react-vite-ts"/,
  )
})

test('resolvePresetChoices throws when required slot has no default and no override', () => {
  const preset = getWorkspacePreset('app+agent+eval')
  assert.throws(() => resolvePresetChoices(preset, {}), /requires slot "agent"/)
})

// ── 3. WorkspaceSpec build path ──────────────────────────────────────────

test('buildWorkspaceSpecFromPreset produces composeable WorkspaceSpec', () => {
  const preset = getWorkspacePreset('app+agent+eval')
  const choices = resolvePresetChoices(preset, { agent: 'agent-runtime-recruiter-ts' })
  const spec = buildWorkspaceSpecFromPreset({
    preset,
    choices,
    workspaceName: 'demo',
    userPrompt: 'build a recruiter agent stack',
  })
  assert.equal(spec.workspaceName, 'demo')
  assert.equal(spec.userPrompt, 'build a recruiter agent stack')
  assert.equal(spec.projects.length, 3)
  assert.equal(spec.launchPlan?.primaryProjectId, 'app')
  const ids = spec.projects.map((p) => p.id).sort()
  assert.deepEqual(ids, ['agent', 'app', 'eval'])
  for (const project of spec.projects) {
    assert.ok(project.path, 'project needs path')
    assert.ok(project.spec.family, 'project needs family')
    assert.ok(project.spec.projectName, 'project needs projectName')
  }
})

// ── 4. Scaffolding builders (pure — no disk, no registry) ────────────────

test('buildRootPackageJson emits private workspace with declared scripts', () => {
  const pkg = buildRootPackageJson('demo-stack', { dev: 'pnpm -r dev', build: 'pnpm -r build' })
  assert.equal((pkg as { name: string }).name, 'demo-stack')
  assert.equal((pkg as { private: boolean }).private, true)
  assert.deepEqual((pkg as { scripts: Record<string, string> }).scripts, {
    dev: 'pnpm -r dev',
    build: 'pnpm -r build',
  })
})

test('buildPnpmWorkspaceYaml lists each slot under packages', () => {
  const yaml = buildPnpmWorkspaceYaml(['app', 'agent', 'eval'])
  assert.match(yaml, /^packages:\n/)
  assert.match(yaml, /^ {2}- 'app'$/m)
  assert.match(yaml, /^ {2}- 'agent'$/m)
  assert.match(yaml, /^ {2}- 'eval'$/m)
})

test('buildEnvFileForSlot only emits incoming wires; empty for slots with none', () => {
  const wires = [
    {
      from: 'agent',
      var: 'AGENT_ENDPOINT',
      to: 'app',
      toVar: 'VITE_AGENT_ENDPOINT',
      placeholder: 'http://localhost:3001',
    },
  ]
  const appEnv = buildEnvFileForSlot('app', wires)
  assert.match(appEnv, /VITE_AGENT_ENDPOINT=http:\/\/localhost:3001/)
  assert.match(appEnv, /from agent\.AGENT_ENDPOINT/)

  const agentEnv = buildEnvFileForSlot('agent', wires)
  assert.equal(agentEnv, '', 'slot with no incoming wires gets empty .env')
})

test('buildCiYaml has valid GitHub Actions workflow shape', () => {
  const yaml = buildCiYaml(['pnpm build', 'pnpm eval'])
  const lines = yaml.split('\n')
  // Top-level keys (column 0).
  assert.ok(lines.includes('name: ci'))
  assert.ok(lines.includes('on:'))
  assert.ok(lines.includes('jobs:'))
  // pnpm/setup-node/checkout steps.
  assert.match(yaml, /uses: actions\/checkout@v4/)
  assert.match(yaml, /uses: pnpm\/action-setup@v4/)
  assert.match(yaml, /uses: actions\/setup-node@v4/)
  assert.match(yaml, /pnpm install --frozen-lockfile/)
  assert.match(yaml, /^ {6}- run: pnpm build$/m)
  assert.match(yaml, /^ {6}- run: pnpm eval$/m)
  // No tabs (YAML parsers reject tabs).
  for (const line of lines) {
    assert.doesNotMatch(line, /\t/, `tabs not allowed in YAML: "${line}"`)
  }
})

test('buildPresetReadme references each chosen family + every script + every wire', () => {
  const preset = getWorkspacePreset('app+agent+eval')
  const choices = resolvePresetChoices(preset, { agent: 'agent-runtime-recruiter-ts' })
  const readme = buildPresetReadme(preset, 'demo-stack', choices)
  assert.match(readme, /^# demo-stack/m)
  assert.match(readme, /agent-with-ui-ts/)
  assert.match(readme, /agent-runtime-recruiter-ts/)
  assert.match(readme, /agent-eval-harness-ts/)
  for (const name of Object.keys(preset.topLevelScripts)) {
    assert.match(readme, new RegExp(`pnpm ${name}`))
  }
  for (const wire of preset.envWiring) {
    assert.match(readme, new RegExp(`${wire.to}/.env.*${wire.toVar}`))
  }
  assert.ok(
    preset.envWiring.some((wire) => wire.to === 'eval' && wire.toVar === 'EVAL_TARGET_BASE_URL'),
    'eval workspace wiring must use the variable consumed by the eval runner',
  )
})

// ── 5. End-to-end compose (integration; requires W1/W3 families) ─────────

test('compose --preset app+agent+eval produces 3-bundle workspace structure', async (t) => {
  const present = await harnessFamiliesPresent()
  if (!present.eval) {
    t.skip(
      'agent-eval-harness-ts (Gen-15 W1) has not landed yet — integration ' +
        'compose path tested when both W1 and W6 PRs are merged.',
    )
    return
  }

  const outDir = await createTempDir('starter-foundry-preset-app-agent-eval')
  try {
    const result = await composePresetWorkspace({
      presetId: 'app+agent+eval',
      choices: { agent: 'agent-runtime-recruiter-ts' },
      workspaceName: 'demo-stack',
      outDir,
    })

    assert.equal(result.presetId, 'app+agent+eval')
    assert.equal(result.projectCount, 3)

    for (const expected of [
      'package.json',
      'pnpm-workspace.yaml',
      'README.md',
      '.github/workflows/ci.yml',
      '.starter-foundry/workspace-report.json',
      'app/.env',
      'eval/.env',
    ]) {
      const abs = path.join(outDir, expected)
      const stat = await fs.stat(abs).catch(() => null)
      assert.ok(stat?.isFile(), `expected ${expected} to exist as a file`)
    }

    for (const slot of ['app', 'agent', 'eval']) {
      const stat = await fs.stat(path.join(outDir, slot)).catch(() => null)
      assert.ok(stat?.isDirectory(), `expected ${slot}/ subdir`)
    }

    const pkg = JSON.parse(await fs.readFile(path.join(outDir, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    const preset = getWorkspacePreset('app+agent+eval')
    for (const [name, cmd] of Object.entries(preset.topLevelScripts)) {
      assert.equal(pkg.scripts[name], cmd)
    }

    const appEnv = await fs.readFile(path.join(outDir, 'app', '.env'), 'utf8')
    assert.match(appEnv, /VITE_AGENT_ENDPOINT=http:\/\/localhost:3001/)
  } finally {
    await removeDir(outDir)
  }
})

test('compose --preset app+agent+eval+research produces 4-bundle workspace', async (t) => {
  const present = await harnessFamiliesPresent()
  if (!present.eval || !present.research) {
    t.skip(
      'agent-eval-harness-ts (W1) and/or agent-research-harness-ts (W3) ' +
        'have not landed yet — integration tested when all three PRs merge.',
    )
    return
  }
  const outDir = await createTempDir('starter-foundry-preset-4bundle')
  try {
    const result = await composePresetWorkspace({
      presetId: 'app+agent+eval+research',
      choices: { agent: 'agent-runtime-cs-research-ts' },
      workspaceName: 'research-stack',
      outDir,
    })
    assert.equal(result.projectCount, 4)
    for (const slot of ['app', 'agent', 'eval', 'research']) {
      const stat = await fs.stat(path.join(outDir, slot)).catch(() => null)
      assert.ok(stat?.isDirectory(), `expected ${slot}/ subdir`)
    }
    const researchEnv = await fs.readFile(path.join(outDir, 'research', '.env'), 'utf8')
    assert.match(researchEnv, /RESEARCH_TARGET_URL=/)
    assert.match(researchEnv, /RESEARCH_EVAL_INPUT_DIR=/)

    const ci = await fs.readFile(path.join(outDir, '.github', 'workflows', 'ci.yml'), 'utf8')
    assert.match(ci, /run: pnpm research/)
  } finally {
    await removeDir(outDir)
  }
})

// Sanity: WORKSPACE_PRESETS export remains stable as a frozen-style array
test('WORKSPACE_PRESETS is the canonical export listed by listWorkspacePresets', () => {
  assert.deepEqual(
    listWorkspacePresets().map((p) => p.id),
    WORKSPACE_PRESETS.map((p) => p.id),
  )
})
