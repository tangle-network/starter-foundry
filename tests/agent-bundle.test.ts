/**
 * Unit tests for the agent-bundle loader + AgentProfile translator.
 *
 * Covers:
 * - schema validation (valid + invalid fixtures)
 * - single-agent translation: system prompt inlined, resources enumerated
 * - multi-agent translation: subagent prompts flattened into AgentProfile.subagents
 * - directory resources expand recursively into per-file inline mounts
 *
 * The "GAP test" at the bottom asserts the generated AgentProfile shape
 * matches what would be sent to `client.create({ backend: { profile } })`,
 * without standing up a real sandbox API. Live end-to-end proof requires a
 * reachable Tangle sandbox API + key — see docs/cookbooks/deploy-agent-bundle.md.
 */
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadAgentBundle, resolveSystemPrompt, toAgentProfile } from '../dist/lib/agent-bundle.js'

// Tests compile to dist-tests/ but fixtures live in tests/fixtures/.
// Walk up to the repo root, then back down into tests/fixtures.
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const FIXTURES = resolve(REPO, 'tests', 'fixtures')

test('loadAgentBundle accepts a valid single-agent fixture', async () => {
  const bundle = await loadAgentBundle(resolve(FIXTURES, 'agent-bundle-example'))
  assert.equal(bundle.name, 'research-assistant')
  assert.equal(bundle.version, '0.1.0')
  assert.equal(bundle.prompt.systemPromptFile, 'system-prompt.md')
  assert.deepEqual(bundle.tags, ['research', 'single-agent'])
})

test('loadAgentBundle rejects schema-invalid agent.json', async () => {
  await assert.rejects(
    () => loadAgentBundle(resolve(FIXTURES, 'agent-bundle-invalid')),
    (err: Error) => {
      assert.match(err.message, /failed schema validation/)
      assert.match(err.message, /version: required field missing/)
      assert.match(err.message, /prompt: required field missing/)
      return true
    },
  )
})

test('loadAgentBundle rejects when agent.json is missing', async () => {
  await assert.rejects(
    () => loadAgentBundle(resolve(FIXTURES, 'no-such-bundle-dir')),
    /agent.json not readable/,
  )
})

test('resolveSystemPrompt returns the file content', async () => {
  const dir = resolve(FIXTURES, 'agent-bundle-example')
  const bundle = await loadAgentBundle(dir)
  const prompt = await resolveSystemPrompt(bundle, dir)
  assert.match(prompt, /# Research Assistant/)
  assert.match(prompt, /Refuse to invent data/)
})

test('toAgentProfile inlines systemPrompt + flattens single-agent resources', async () => {
  const dir = resolve(FIXTURES, 'agent-bundle-example')
  const bundle = await loadAgentBundle(dir)
  const profile = await toAgentProfile(bundle, dir)

  assert.equal(profile.name, 'research-assistant')
  assert.equal(profile.version, '0.1.0')
  assert.deepEqual(profile.tags, ['research', 'single-agent'])

  // System prompt inlined
  assert.ok(profile.prompt?.systemPrompt, 'systemPrompt should be inlined')
  assert.match(profile.prompt!.systemPrompt!, /# Research Assistant/)
  assert.deepEqual(profile.prompt?.instructions, ['Cite every source.', 'Refuse to invent data.'])

  // Model translated
  assert.equal(profile.model?.default, 'anthropic/claude-sonnet-4-7')
  assert.deepEqual(profile.model?.metadata, { fallback: ['openai/gpt-4o-mini'] })

  // Tools + permissions copied
  assert.deepEqual(profile.tools, { bash: true, edit: true, webfetch: false })
  assert.deepEqual(profile.permissions, {
    bash: 'ask',
    edit: 'allow',
    webfetch: 'deny',
  })

  // Resources enumerated: 1 system-prompt file + 2 methodology files = 3
  const files = profile.resources?.files ?? []
  assert.equal(files.length, 3, `expected 3 resource files, got ${files.length}`)

  const paths = files.map((f) => f.path).sort()
  assert.deepEqual(paths, [
    '/workspace/methodology/literature-survey.md',
    '/workspace/methodology/proposal-drafting.md',
    '/workspace/system-prompt.md',
  ])

  // Every mount carries inline content
  for (const mount of files) {
    assert.equal(mount.resource.kind, 'inline')
    if (mount.resource.kind === 'inline') {
      assert.ok(mount.resource.content.length > 0, `${mount.path} has empty content`)
    }
  }
})

test('toAgentProfile flattens subagent prompts into AgentProfile.subagents', async () => {
  const dir = resolve(FIXTURES, 'agent-bundle-multi')
  const bundle = await loadAgentBundle(dir)
  const profile = await toAgentProfile(bundle, dir)

  assert.ok(profile.subagents, 'expected subagents map')
  const ids = Object.keys(profile.subagents!).sort()
  assert.deepEqual(ids, ['lead', 'researcher'])

  const lead = profile.subagents!.lead
  assert.equal(lead.description, 'Routes work and reviews drafts')
  assert.match(lead.prompt ?? '', /# Lead/)
  assert.equal(lead.model, 'anthropic/claude-sonnet-4-7')
  assert.deepEqual(lead.tools, { bash: true })
  assert.deepEqual(lead.permissions, { bash: 'ask' })
  assert.equal(lead.maxSteps, 5)

  const researcher = profile.subagents!.researcher
  assert.match(researcher.prompt ?? '', /# Researcher/)
  assert.deepEqual(researcher.permissions, { webfetch: 'allow' })
  assert.equal(researcher.maxSteps, undefined)

  // Resources still carry the flat-file roster
  const files = profile.resources?.files ?? []
  assert.equal(files.length, 3)
  const paths = files.map((f) => f.path).sort()
  assert.deepEqual(paths, [
    '/workspace/roles/lead/system-prompt.md',
    '/workspace/roles/researcher/system-prompt.md',
    '/workspace/team-system.md',
  ])
})

test('toAgentProfile produces the exact backend.profile shape the SDK expects', async () => {
  // Boundary contract: this is what `client.create({ backend: { profile } })`
  // would receive. If the SDK shape drifts and this assertion stops matching
  // a real call, the gap is visible here.
  const dir = resolve(FIXTURES, 'agent-bundle-example')
  const bundle = await loadAgentBundle(dir)
  const profile = await toAgentProfile(bundle, dir)

  // Required keys for sandbox runtime:
  // - prompt.systemPrompt must be a non-empty string (runtime reads it as
  //   profile.systemPrompt via backend-config.toBackendProfile)
  // - tools / permissions must be Record<string, ...>
  // - resources.files must be an array of AgentProfileFileMount
  assert.equal(typeof profile.prompt?.systemPrompt, 'string')
  assert.notEqual(profile.prompt?.systemPrompt, '')
  assert.equal(typeof profile.tools, 'object')
  assert.equal(typeof profile.permissions, 'object')
  assert.ok(Array.isArray(profile.resources?.files))

  // Every file mount must satisfy AgentProfileFileMount: { path, resource }
  for (const mount of profile.resources?.files ?? []) {
    assert.equal(typeof mount.path, 'string')
    assert.ok(mount.path.startsWith('/'), `path must be absolute: ${mount.path}`)
    assert.equal(mount.resource.kind, 'inline')
  }
})
