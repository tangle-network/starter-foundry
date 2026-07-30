import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { composeFromPrompt } from '../dist/lib/compose-prompt.js'
import { createTempDir, removeDir } from '../dist/lib/fs.js'
import type { PrimaryProjectManifest } from '../dist/types.js'

test('composeFromPrompt: free-text fitness prompt produces React scaffold with industry palette', async () => {
  const outDir = await createTempDir('sf-cfp-fitness')
  try {
    const result = await composeFromPrompt({
      prompt: 'Build a marathon training app for runners with personalized plans',
      outDir,
    })
    assert.equal(result.kind, 'starter')
    if (result.kind !== 'starter') return

    // Family-default capabilities (tailwind + shadcn) auto-attached for React families
    const layers = result.spec.layers ?? []
    assert.ok(
      layers.includes('capability:tailwind'),
      `expected tailwind in layers, got ${layers.join(',')}`,
    )
    assert.ok(
      layers.includes('capability:shadcn'),
      `expected shadcn in layers, got ${layers.join(',')}`,
    )

    // Industry detection ran and attached fitness
    assert.ok(
      layers.includes('industry:fitness'),
      `expected fitness industry, got ${layers.join(',')}`,
    )

    // personalize.css written by industry layer
    const cssExists = await fs
      .access(path.join(outDir, 'src/personalize.css'))
      .then(() => true)
      .catch(() => false)
    assert.ok(cssExists, 'personalize.css should exist')
    const css = await fs.readFile(path.join(outDir, 'src/personalize.css'), 'utf8')
    assert.match(css, /:root/)
    assert.match(css, /--color-primary/)

    const primaryProject = JSON.parse(
      await fs.readFile(path.join(outDir, '.starter-foundry', 'primary-project.json'), 'utf8'),
    ) as PrimaryProjectManifest
    assert.deepEqual(primaryProject, {
      schemaVersion: 1,
      projectId: 'root',
      cwd: '.',
      composeReportPath: '.starter-foundry/compose-report.json',
      preview: { path: '/' },
    })

    // Context message references the family
    assert.match(result.contextMessage, new RegExp(result.spec.family))
    assert.match(result.contextMessage, /AGENTS\.md/)
    assert.match(result.contextMessage, /personalize/)
    assert.match(result.contextMessage, /Preview ownership/)
    assert.doesNotMatch(
      result.contextMessage,
      /SIDECAR_PORT|ensure-dev-server|localhost:9000|Step 0|dev-server route/,
    )

    const agentsDoc = await fs.readFile(path.join(outDir, 'AGENTS.md'), 'utf8')
    assert.match(agentsDoc, /Preview ownership/)
    assert.match(agentsDoc, /Run every listed build or validation command successfully/)
    assert.doesNotMatch(
      agentsDoc,
      /SIDECAR_PORT|ensure-dev-server|localhost:9000|Step 0|dev-server route/,
    )

    const packageJson = JSON.parse(
      await fs.readFile(path.join(outDir, 'package.json'), 'utf8'),
    ) as {
      scripts?: Record<string, string>
    }
    assert.equal(packageJson.scripts?.['preview:instant'], undefined)
    await assert.rejects(fs.access(path.join(outDir, 'preview-server.mjs')))
  } finally {
    await removeDir(outDir)
  }
})

test('composeFromPrompt: backend prompt routes to non-React family without forcing tailwind', async () => {
  const outDir = await createTempDir('sf-cfp-go')
  try {
    const result = await composeFromPrompt({
      prompt: 'Build a Go REST API with Postgres and rate limiting',
      outDir,
    })
    assert.equal(result.kind, 'starter')
    if (result.kind !== 'starter') return

    assert.equal(result.spec.family, 'go-api')
    const layers = result.spec.layers ?? []
    assert.ok(!layers.includes('capability:shadcn'), 'go-api must not get shadcn forced')
    assert.ok(!layers.includes('capability:tailwind'), 'go-api must not get tailwind forced')
  } finally {
    await removeDir(outDir)
  }
})

test('composeFromPrompt: empty prompt returns error', async () => {
  const result = await composeFromPrompt({ prompt: '', outDir: '/tmp/sf-cfp-empty' })
  assert.equal(result.kind, 'error')
})

test('composeFromPrompt: workspace prompt auto-dispatches to composeWorkspace', async () => {
  // Regression for blueprint-agent bug report #2 (2026-04-20). Previously
  // returned kind:'workspace' with reason:'not auto-composed', forcing every
  // caller to write the same dispatch wrapper. Now composes the workspace
  // on the caller's behalf.
  const outDir = await createTempDir('sf-cfp-ws')
  try {
    const result = await composeFromPrompt({
      prompt: 'Build a multichain DeFi platform with frontend, EVM contracts, and a Solana program',
      outDir,
    })

    // Either the planner routes to workspace (auto-composed now) or starter —
    // both must produce a composed result, never an error.
    assert.ok(
      result.kind === 'workspace' || result.kind === 'starter',
      `expected starter or workspace, got ${result.kind}`,
    )
    if (result.kind === 'workspace') {
      assert.ok(
        result.result.projectCount >= 2,
        `workspace should have ≥2 projects, got ${result.result.projectCount}`,
      )
      assert.ok(result.contextMessage.includes('workspace'))
      // Launch plan file is written — the caller can read it without a second import.
      const lpExists = await fs
        .access(result.result.launchPlanPath)
        .then(() => true)
        .catch(() => false)
      assert.ok(lpExists, 'launch-plan.json should be written')
      const primaryProject = JSON.parse(
        await fs.readFile(path.join(outDir, '.starter-foundry', 'primary-project.json'), 'utf8'),
      ) as PrimaryProjectManifest
      const expected = result.result.projects.find(
        (project) => project.id === result.result.launchPlan.primaryProjectId,
      )
      assert.ok(expected, 'workspace launch plan should name a composed project')
      assert.equal(primaryProject.projectId, expected.id)
      assert.equal(primaryProject.cwd, expected.path)
      assert.equal(primaryProject.composeReportPath, expected.composeReportPath)
    }
  } finally {
    await removeDir(outDir)
  }
})

test('planPrompt: incompatible partner-family combos scrubbed at plan time', async () => {
  // Regression for blueprint-agent bug report #3 (2026-04-20). If planPrompt
  // routes to remix-ts but the caller supplied partner:'tangle' (not in the
  // tangle partner-family set), composeStarter used to throw at compose time
  // with 'Partner tangle is not compatible with family remix-ts'. Now
  // planPrompt scrubs the partner to null so compose never sees the bad pair.
  const { planPrompt } = await import('../dist/lib/prompt-planner.js')
  const plan = await planPrompt({
    prompt: 'Build a Remix app for a marketing team',
    partner: 'tangle',
  })
  if (plan.kind === 'starter') {
    assert.equal(
      plan.spec.partner,
      null,
      `remix-ts/tangle is incompatible; partner should be scrubbed to null, got ${plan.spec.partner}`,
    )
  }
})
