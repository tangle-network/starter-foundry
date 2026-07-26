import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

import {
  PRIMARY_PROJECT_MANIFEST_PATH,
  PrimaryProjectManifestValidationError,
  validatePrimaryProjectManifest,
} from '@tangle-network/starter-foundry/primary-project'
import type { PrimaryProjectManifest } from '@tangle-network/starter-foundry/primary-project'

import { createTempDir, fileExists, removeDir } from '../dist/lib/fs.js'
import { writePrimaryProjectManifest } from '../dist/lib/primary-project-writer.js'

const rootManifest: PrimaryProjectManifest = {
  schemaVersion: 1,
  projectId: 'root',
  cwd: '.',
  composeReportPath: '.starter-foundry/compose-report.json',
  preview: { path: '/' },
}

const workspaceManifest: PrimaryProjectManifest = {
  schemaVersion: 1,
  projectId: 'web',
  cwd: 'apps/web',
  composeReportPath: 'apps/web/.starter-foundry/compose-report.json',
  preview: { path: '/', port: '5173' },
}

test('public validator accepts root and workspace manifests', () => {
  assert.deepEqual(validatePrimaryProjectManifest(rootManifest), rootManifest)
  assert.deepEqual(validatePrimaryProjectManifest(workspaceManifest), workspaceManifest)
  assert.deepEqual(
    validatePrimaryProjectManifest({ ...rootManifest, projectId: 'cli', preview: null }),
    { ...rootManifest, projectId: 'cli', preview: null },
  )
  assert.deepEqual(
    validatePrimaryProjectManifest({
      ...rootManifest,
      projectId: 'service',
      preview: { port: 3000 },
    }),
    { ...rootManifest, projectId: 'service', preview: { port: 3000 } },
  )
})

test('public validator rejects malformed paths, previews, and unknown fields', () => {
  const cases: Array<{ name: string; input: unknown; issue: string }> = [
    {
      name: 'unsupported schema version',
      input: { ...rootManifest, schemaVersion: 2 },
      issue: 'schemaVersion',
    },
    {
      name: 'workspace traversal',
      input: { ...workspaceManifest, cwd: '../outside' },
      issue: 'cwd',
    },
    {
      name: 'drive-relative workspace path',
      input: { ...workspaceManifest, cwd: 'C:outside' },
      issue: 'cwd',
    },
    {
      name: 'wrong compose report target',
      input: { ...rootManifest, composeReportPath: '.starter-foundry/other.json' },
      issue: 'composeReportPath',
    },
    {
      name: 'network-style preview path',
      input: { ...rootManifest, preview: { path: '//outside.example' } },
      issue: 'preview.path',
    },
    {
      name: 'invalid preview port',
      input: { ...rootManifest, preview: { path: '/', port: 0 } },
      issue: 'preview.port',
    },
    {
      name: 'empty preview',
      input: { ...rootManifest, preview: {} },
      issue: 'preview must include',
    },
    {
      name: 'unknown root field',
      input: { ...rootManifest, unknown: true },
      issue: 'unsupported field',
    },
  ]

  for (const { name, input, issue } of cases) {
    assert.throws(
      () => validatePrimaryProjectManifest(input),
      (error: unknown) =>
        error instanceof PrimaryProjectManifestValidationError &&
        error.issues.some((candidate) => candidate.includes(issue)),
      name,
    )
  }
})

test('writer validates before emitting the artifact', async () => {
  const outDir = await createTempDir('starter-foundry-primary-project')

  try {
    await assert.rejects(
      () =>
        writePrimaryProjectManifest(outDir, {
          ...rootManifest,
          cwd: '../outside',
        } as unknown as PrimaryProjectManifest),
      (error: unknown) =>
        error instanceof PrimaryProjectManifestValidationError &&
        error.issues.some((issue) => issue.includes('cwd')),
    )
    assert.equal(await fileExists(path.join(outDir, PRIMARY_PROJECT_MANIFEST_PATH)), false)
  } finally {
    await removeDir(outDir)
  }
})

test('public validator module has no Node runtime dependency', async () => {
  const source = await readFile(path.resolve('dist/lib/primary-project.js'), 'utf8')
  assert.doesNotMatch(source, /node:/)
})
