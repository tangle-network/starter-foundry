import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import test from 'node:test'

test('publish integrity accepts declared files and directories', () => {
  const result = spawnSync(
    join(process.cwd(), 'node_modules/.bin/tsx'),
    ['scripts/check-publish-integrity.ts'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, CI: 'true' },
    },
  )

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.match(result.stdout, /Publish integrity check/)
  assert.match(result.stdout, /all integrity checks passed/)
})
