/**
 * Integration tests for the deploy-agent-bundle CLI script.
 *
 * Drives `tsx scripts/deploy-agent-bundle.ts --dry-run` against fixture
 * bundles and asserts on stdout. This is the right level: the script is a
 * thin orchestrator over `toAgentProfile` + `toWorkspaceFiles` + the SDK.
 * Dry-run skips the SDK call so we don't need a live sandbox API.
 *
 * Pre-hook execution is also verified end-to-end (script spawns the hook
 * locally before sandbox.create). Post-hook execution requires a real
 * box.exec; we cover that path via fixture-only tests in agent-bundle.test
 * and the LIVE deploy in docs/cookbooks/deploy-agent-bundle.md.
 */
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const FIXTURES = resolve(REPO, 'tests', 'fixtures')

function runDeploy(args: string[]): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(
    'npx',
    ['--yes', 'tsx', resolve(REPO, 'scripts', 'deploy-agent-bundle.ts'), ...args],
    {
      cwd: REPO,
      encoding: 'utf8',
      env: { ...process.env, TANGLE_SANDBOX_BASE_URL: 'https://sandbox-api.example.invalid' },
    },
  )
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
  }
}

test('--dry-run --harness opencode prints AGENTS.md in workspace files', () => {
  const r = runDeploy([
    '--bundle',
    resolve(FIXTURES, 'agent-bundle-example'),
    '--name',
    'test-deploy-opencode',
    '--harness',
    'opencode',
    '--dry-run',
  ])
  assert.equal(r.status, 0, `dry-run exited ${r.status}: ${r.stderr}`)
  assert.match(r.stdout, /harness=opencode/)
  assert.match(r.stdout, /\/home\/agent\/AGENTS\.md/)
  assert.doesNotMatch(r.stdout, /\/home\/agent\/CLAUDE\.md/)
})

test('--dry-run --harness claude-code emits CLAUDE.md AND AGENTS.md', () => {
  const r = runDeploy([
    '--bundle',
    resolve(FIXTURES, 'agent-bundle-example'),
    '--name',
    'test-deploy-claude',
    '--harness',
    'claude-code',
    '--dry-run',
  ])
  assert.equal(r.status, 0, `dry-run exited ${r.status}: ${r.stderr}`)
  assert.match(r.stdout, /harness=claude-code/)
  assert.match(r.stdout, /\/home\/agent\/CLAUDE\.md/)
  assert.match(r.stdout, /\/home\/agent\/AGENTS\.md/)
})

test('--dry-run --harness hermes prints partial-MCP warning to stderr', () => {
  const r = runDeploy([
    '--bundle',
    resolve(FIXTURES, 'agent-bundle-example'),
    '--name',
    'test-deploy-hermes',
    '--harness',
    'hermes',
    '--dry-run',
  ])
  assert.equal(r.status, 0, `dry-run exited ${r.status}: ${r.stderr}`)
  assert.match(r.stdout, /harness=hermes/)
  // Partial-Hermes warning must surface to stderr.
  assert.match(r.stderr, /harness=hermes/)
  assert.match(r.stderr, /partial/)
})

test('--dry-run with hook bundle reports pre + post hook paths but does NOT run them', () => {
  const r = runDeploy([
    '--bundle',
    resolve(FIXTURES, 'agent-bundle-with-hooks'),
    '--name',
    'test-deploy-hooks',
    '--dry-run',
  ])
  assert.equal(r.status, 0, `dry-run exited ${r.status}: ${r.stderr}`)
  // Pre + post hook paths are surfaced
  assert.match(r.stdout, /would run pre-hook hooks\/pre\.sh/)
  assert.match(r.stdout, /would run post-hook hooks\/post\.sh/)
  // Hooks themselves did NOT execute (they would print "pre-hook ran in ...")
  assert.doesNotMatch(r.stdout, /pre-hook ran in/)
  assert.doesNotMatch(r.stdout, /post-hook ran in/)
})

test('--dry-run --skip-hooks suppresses hook reporting entirely', () => {
  const r = runDeploy([
    '--bundle',
    resolve(FIXTURES, 'agent-bundle-with-hooks'),
    '--name',
    'test-deploy-skip',
    '--skip-hooks',
    '--dry-run',
  ])
  assert.equal(r.status, 0, `dry-run exited ${r.status}: ${r.stderr}`)
  assert.doesNotMatch(r.stdout, /would run pre-hook/)
  assert.doesNotMatch(r.stdout, /would run post-hook/)
})

test('--harness <bogus> exits non-zero with a useful error', () => {
  const r = runDeploy([
    '--bundle',
    resolve(FIXTURES, 'agent-bundle-example'),
    '--name',
    'test-deploy-bogus',
    '--harness',
    'kimi-code',
    '--dry-run',
  ])
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /--harness must be one of/)
})

test('--dry-run with hooks bundle uses bundle-declared harness=claude-code by default', () => {
  // The hooks fixture sets harness=claude-code in agent.json.
  const r = runDeploy([
    '--bundle',
    resolve(FIXTURES, 'agent-bundle-with-hooks'),
    '--name',
    'test-deploy-bundle-default',
    '--dry-run',
    '--skip-hooks',
  ])
  assert.equal(r.status, 0, `dry-run exited ${r.status}: ${r.stderr}`)
  assert.match(r.stdout, /harness=claude-code/)
})
