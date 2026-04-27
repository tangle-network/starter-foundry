// Router unit tests — pure routing logic, no network, no LLM.
//
// These exercise the real decideRoute / decideRouteSync / agent-loader code
// paths. The LLM-routing case stubs `chat()` via the global fetch — we set
// TANGLE_ROUTER_KEY=test-stub and intercept fetch() so the test observes
// the routing prompt and returns a fake role id.
//
// Regressions guarded:
//   1. Single-agent pack must return its only role with reason single-agent.
//   2. Team pack with defaultRespondent must skip the LLM and return that role.
//   3. Team pack with no defaultRespondent must call the LLM-routing path
//      and resolve the returned role id correctly.
//   4. /chat-style request for a missing pack must surface PackNotFoundError.
//   5. Roster with duplicate role ids must throw at parse time (not silently
//      drop one).
//   6. Roster with an invalid defaultRespondent must throw at parse time.
//   7. Explicit roleId override on a team pack must skip LLM routing.
//   8. listPackIds discovers single + team packs and skips junk dirs.

import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { decideRoute, decideRouteSync } from '../src/lib/router.js'
import { findRole, listPackIds, loadPack, PackNotFoundError } from '../src/lib/agent-loader.js'
import type { ChatMessage } from '../src/types.js'

async function makePackDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'orchestrator-test-'))
}

test('single-agent pack: decideRouteSync returns the only role', async (t) => {
  const dir = await makePackDir()
  t.after(() => rm(dir, { recursive: true, force: true }))
  const packDir = join(dir, 'support')
  await mkdir(packDir, { recursive: true })
  await writeFile(join(packDir, 'system-prompt.md'), '# Support agent\n')

  const pack = await loadPack(dir, 'support')
  assert.equal(pack.kind, 'single')
  const decision = decideRouteSync(pack)
  assert.ok(decision)
  assert.equal(decision.roleId, 'support')
  assert.equal(decision.reason, 'single-agent')
})

test('team pack with defaultRespondent: routes synchronously without LLM call', async (t) => {
  const dir = await makePackDir()
  t.after(() => rm(dir, { recursive: true, force: true }))
  const packDir = join(dir, 'support-team')
  await mkdir(packDir, { recursive: true })
  await writeFile(join(packDir, 'frontline.md'), '# Frontline\n')
  await writeFile(join(packDir, 'engineering.md'), '# Engineering\n')
  await writeFile(
    join(packDir, 'agent-roster.json'),
    JSON.stringify({
      description: 'Two-tier support team',
      defaultRespondent: 'frontline',
      roles: [
        { id: 'frontline', systemPrompt: 'frontline.md', description: 'Tier 1 triage' },
        { id: 'engineering', systemPrompt: 'engineering.md', description: 'Tier 2 deep debug' },
      ],
    }),
  )

  const pack = await loadPack(dir, 'support-team')
  assert.equal(pack.kind, 'team')
  const decision = decideRouteSync(pack)
  assert.ok(decision)
  assert.equal(decision.roleId, 'frontline')
  assert.equal(decision.reason, 'team-default-respondent')
  assert.equal(decision.pack.kind, 'team')
})

test('team pack without defaultRespondent: decideRouteSync returns null (LLM required)', async (t) => {
  const dir = await makePackDir()
  t.after(() => rm(dir, { recursive: true, force: true }))
  const packDir = join(dir, 'mixed')
  await mkdir(packDir, { recursive: true })
  await writeFile(join(packDir, 'a.md'), '# A')
  await writeFile(join(packDir, 'b.md'), '# B')
  await writeFile(
    join(packDir, 'agent-roster.json'),
    JSON.stringify({
      roles: [
        { id: 'alpha', systemPrompt: 'a.md', description: 'Math questions' },
        { id: 'beta', systemPrompt: 'b.md', description: 'Code questions' },
      ],
    }),
  )

  const pack = await loadPack(dir, 'mixed')
  assert.equal(decideRouteSync(pack), null)
})

test('team pack: LLM routing path picks the role the stub returns', async (t) => {
  const dir = await makePackDir()
  t.after(() => rm(dir, { recursive: true, force: true }))
  const packDir = join(dir, 'team-llm')
  await mkdir(packDir, { recursive: true })
  await writeFile(join(packDir, 'a.md'), '# A')
  await writeFile(join(packDir, 'b.md'), '# B')
  await writeFile(
    join(packDir, 'agent-roster.json'),
    JSON.stringify({
      roles: [
        { id: 'math', systemPrompt: 'a.md', description: 'Math help' },
        { id: 'code', systemPrompt: 'b.md', description: 'Code help' },
      ],
    }),
  )

  const pack = await loadPack(dir, 'team-llm')

  // Stub the global fetch so chat-bridge's call to router.tangle.tools
  // returns a deterministic role id.
  const originalFetch = globalThis.fetch
  const originalKey = process.env['TANGLE_ROUTER_KEY']
  process.env['TANGLE_ROUTER_KEY'] = 'test-stub'
  let observedBody: unknown
  globalThis.fetch = (async (input: unknown, init?: { body?: BodyInit | null }) => {
    void input
    observedBody = init?.body ? JSON.parse(init.body as string) : null
    return new Response(
      JSON.stringify({ choices: [{ message: { content: 'code' } }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }) as typeof fetch
  t.after(() => {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env['TANGLE_ROUTER_KEY']
    else process.env['TANGLE_ROUTER_KEY'] = originalKey
  })

  const messages: ChatMessage[] = [{ role: 'user', content: 'fix my python script' }]
  const decision = await decideRoute(pack, messages, { routingModel: 'test-model' })
  assert.equal(decision.roleId, 'code')
  assert.equal(decision.reason, 'team-llm-routed')

  // The routing call should have included BOTH roles in the system prompt
  // and the user's last message in the user turn. This protects against a
  // regression where the routing prompt forgets one role and the LLM never
  // picks it.
  const body = observedBody as {
    messages: Array<{ role: string; content: string }>
    model: string
    temperature: number
  }
  assert.equal(body.model, 'test-model')
  assert.equal(body.temperature, 0)
  const sys = body.messages.find((m) => m.role === 'system')!
  assert.match(sys.content, /math/)
  assert.match(sys.content, /code/)
  const user = body.messages.find((m) => m.role === 'user')!
  assert.equal(user.content, 'fix my python script')

  // findRole + the decision should agree.
  const role = findRole(decision.pack, decision.roleId)
  assert.ok(role)
  assert.equal(role.id, 'code')
})

test('missing pack: loadPack throws PackNotFoundError', async (t) => {
  const dir = await makePackDir()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await assert.rejects(loadPack(dir, 'nope'), (err: unknown) => {
    assert.ok(err instanceof PackNotFoundError)
    assert.match((err as Error).message, /nope/)
    return true
  })
})

test('roster with duplicate role ids fails parse loudly', async (t) => {
  const dir = await makePackDir()
  t.after(() => rm(dir, { recursive: true, force: true }))
  const packDir = join(dir, 'broken')
  await mkdir(packDir, { recursive: true })
  await writeFile(join(packDir, 'a.md'), '# A')
  await writeFile(
    join(packDir, 'agent-roster.json'),
    JSON.stringify({
      roles: [
        { id: 'dupe', systemPrompt: 'a.md' },
        { id: 'dupe', systemPrompt: 'a.md' },
      ],
    }),
  )
  await assert.rejects(loadPack(dir, 'broken'), /duplicate role id/)
})

test('roster with defaultRespondent that does not exist fails parse loudly', async (t) => {
  const dir = await makePackDir()
  t.after(() => rm(dir, { recursive: true, force: true }))
  const packDir = join(dir, 'broken-default')
  await mkdir(packDir, { recursive: true })
  await writeFile(join(packDir, 'a.md'), '# A')
  await writeFile(
    join(packDir, 'agent-roster.json'),
    JSON.stringify({
      defaultRespondent: 'ghost',
      roles: [{ id: 'real', systemPrompt: 'a.md' }],
    }),
  )
  await assert.rejects(loadPack(dir, 'broken-default'), /defaultRespondent.*ghost/)
})

test('explicit roleId override on team pack bypasses LLM routing', async (t) => {
  const dir = await makePackDir()
  t.after(() => rm(dir, { recursive: true, force: true }))
  const packDir = join(dir, 'team-explicit')
  await mkdir(packDir, { recursive: true })
  await writeFile(join(packDir, 'a.md'), '# A')
  await writeFile(join(packDir, 'b.md'), '# B')
  await writeFile(
    join(packDir, 'agent-roster.json'),
    JSON.stringify({
      roles: [
        { id: 'alpha', systemPrompt: 'a.md' },
        { id: 'beta', systemPrompt: 'b.md' },
      ],
    }),
  )

  const pack = await loadPack(dir, 'team-explicit')
  // No fetch stub — explicit override must NOT call the LLM.
  const decision = await decideRoute(pack, [{ role: 'user', content: 'hi' }], {
    explicitRoleId: 'beta',
  })
  assert.equal(decision.roleId, 'beta')
  assert.equal(decision.reason, 'team-default-respondent')
})

test('listPackIds discovers single + team packs and skips junk dirs', async (t) => {
  const dir = await makePackDir()
  t.after(() => rm(dir, { recursive: true, force: true }))

  // Single-agent pack
  await mkdir(join(dir, 'simple'), { recursive: true })
  await writeFile(join(dir, 'simple', 'system-prompt.md'), '# Simple\n')

  // Team pack
  await mkdir(join(dir, 'team'), { recursive: true })
  await writeFile(join(dir, 'team', 'a.md'), '# A')
  await writeFile(
    join(dir, 'team', 'agent-roster.json'),
    JSON.stringify({ roles: [{ id: 'a', systemPrompt: 'a.md' }] }),
  )

  // Junk dir (no marker file) — must be skipped, not error.
  await mkdir(join(dir, 'junk'), { recursive: true })
  await writeFile(join(dir, 'junk', 'README.md'), '# notes')

  const ids = await listPackIds(dir)
  assert.deepEqual(ids, ['simple', 'team'])
})
