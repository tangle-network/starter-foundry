import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { createTempDir, readJson, removeDir } from '../dist/lib/fs.js'
import {
  benchmarkWorkspace,
  composeWorkspace,
  createWorkspaceContextPack,
} from '../dist/lib/workspace.js'
import { PREVIEW_OWNERSHIP_LINES } from '../dist/lib/preview-ownership.js'
import type { WorkspaceReport } from '../dist/lib/workspace.js'
import type { PrimaryProjectManifest, WorkspaceSpec } from '../dist/types.js'

async function loadWorkspaceSpec() {
  return readJson<WorkspaceSpec>(path.resolve('specs/multichain-workspace.json'))
}

test('workspace compose writes root instructions and launch plan', async () => {
  const spec = await loadWorkspaceSpec()
  const outDir = await createTempDir('starter-foundry-workspace-compose')

  try {
    const result = await composeWorkspace({ spec, outDir })
    const projectDoc = await fs.readFile(path.join(outDir, 'PROJECT.md'), 'utf8')
    const agentsDoc = await fs.readFile(path.join(outDir, 'AGENTS.md'), 'utf8')
    const report = await readJson<WorkspaceReport>(result.workspaceReportPath)
    const primaryProject = await readJson<PrimaryProjectManifest>(
      path.join(outDir, '.starter-foundry', 'primary-project.json'),
    )

    assert.equal(result.projectCount, 4)
    assert.equal(report.launchPlan.primaryProjectId, 'web')
    assert.match(projectDoc, /multichain product studio/i)
    assert.match(agentsDoc, /Primary project is `web`/)
    for (const line of PREVIEW_OWNERSHIP_LINES) {
      assert.ok(agentsDoc.includes(line), `workspace instructions must include: ${line}`)
    }
    assert.doesNotMatch(
      agentsDoc,
      /SIDECAR_PORT|ensure-dev-server|localhost:9000|Step 0|dev-server route/,
    )
    assert.ok(report.projects.some((project) => project.path === 'apps/web'))
    assert.ok(report.projects.some((project) => project.path === 'contracts/solana'))
    assert.deepEqual(primaryProject, {
      schemaVersion: 1,
      projectId: 'web',
      cwd: 'apps/web',
      composeReportPath: 'apps/web/.starter-foundry/compose-report.json',
      preview: { path: '/' },
    })
  } finally {
    await removeDir(outDir)
  }
})

test('workspace instructions do not assume a host-specific preview endpoint', async () => {
  const spec = await loadWorkspaceSpec()
  const primaryPath = "apps/o'brien"
  spec.projects[0] = { ...spec.projects[0]!, path: primaryPath }
  const outDir = await createTempDir('starter-foundry-workspace-quoted-cwd')

  try {
    await composeWorkspace({ spec, outDir })
    const agentsDoc = await fs.readFile(path.join(outDir, 'AGENTS.md'), 'utf8')
    assert.match(agentsDoc, /path: `apps\/o'brien`/)
    assert.doesNotMatch(agentsDoc, /curl -fsS|SIDECAR_AUTH_TOKEN|ensure-dev-server/)
  } finally {
    await removeDir(outDir)
  }
})

test('workspace context pack captures project boundaries and launch plan', async () => {
  const spec = await loadWorkspaceSpec()
  const outDir = await createTempDir('starter-foundry-workspace-context')

  try {
    await composeWorkspace({ spec, outDir })
    const workspaceReport = await readJson<WorkspaceReport>(
      path.join(outDir, '.starter-foundry', 'workspace-report.json'),
    )
    const result = await createWorkspaceContextPack({ spec, outDir, workspaceReport })
    const contextPack = result.contextPack as WorkspaceReport & {
      projects: Array<{ path: string; entrypoints: string[] }>
    }

    assert.equal(contextPack.projects.length, 4)
    assert.equal(workspaceReport.launchPlan.primaryProjectId, 'web')
    assert.ok(contextPack.projects.some((project) => project.path === 'contracts/evm'))
    assert.ok(contextPack.projects.some((project) => project.entrypoints.includes('app/page.tsx')))
  } finally {
    await removeDir(outDir)
  }
})

test('workspace benchmark measures primary artifact target separately from full validation', async () => {
  const spec = await loadWorkspaceSpec()
  const report = await benchmarkWorkspace({ spec, runs: 1 })

  assert.equal(report.runs, 1)
  assert.equal(report.summary.primaryArtifactTargetMs, 2500)
  assert.equal(report.summary.primaryArtifactHitRate, 1)
  assert.equal(report.summary.passRate, 1)
  assert.ok(report.results[0]!.primaryArtifactMs <= 2500)
})
