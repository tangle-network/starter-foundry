// Tests for agent-base:memory. Real filesystem (per-test temp dir), no
// mocks — the layer is a thin wrapper around node:fs/promises and the
// tests must exercise the actual disk path.
//
// Run with: tsx --test registry/layers/agent-base/memory/files/lib/memory/index.test.ts

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  appendTurn,
  getConversation,
  listThreads,
  searchConversations,
} from './index.js'

function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'memory-test-'))
  process.env.CONVERSATIONS_DIR = d
  return d
}

const ts = (offsetMs = 0): string => new Date(Date.now() + offsetMs).toISOString()

// ── appendTurn ───────────────────────────────────────────────────────────

test('appendTurn: creates file and conversations dir if missing', async () => {
  const dir = freshDir()
  await appendTurn('chat-1', { ts: ts(), role: 'user', content: 'hello' })
  const raw = readFileSync(join(dir, 'chat-1.md'), 'utf8')
  assert.match(raw, /\nrole: user\n/)
  assert.match(raw, /\nhello\n/)
})

test('appendTurn: appends additional turns to an existing thread', async () => {
  freshDir()
  await appendTurn('chat-2', { ts: ts(), role: 'user', content: 'first' })
  await appendTurn('chat-2', { ts: ts(1), role: 'assistant', content: 'second' })
  await appendTurn('chat-2', { ts: ts(2), role: 'user', content: 'third' })
  const conv = await getConversation('chat-2')
  assert.ok(conv)
  assert.equal(conv.turns.length, 3)
  assert.deepEqual(
    conv.turns.map((t) => [t.role, t.content]),
    [
      ['user', 'first'],
      ['assistant', 'second'],
      ['user', 'third'],
    ],
  )
})

test('appendTurn: rejects path-traversal threadIds', async () => {
  freshDir()
  await assert.rejects(
    () => appendTurn('../escape', { ts: ts(), role: 'user', content: 'x' }),
    /invalid threadId/,
  )
  await assert.rejects(
    () => appendTurn('a/b', { ts: ts(), role: 'user', content: 'x' }),
    /invalid threadId/,
  )
  await assert.rejects(
    () => appendTurn('', { ts: ts(), role: 'user', content: 'x' }),
    /non-empty/,
  )
})

test('appendTurn: rejects invalid role', async () => {
  freshDir()
  await assert.rejects(
    () =>
      appendTurn('chat-3', {
        ts: ts(),
        // @ts-expect-error — testing runtime guard
        role: 'admin',
        content: 'x',
      }),
    /invalid role/,
  )
})

test('appendTurn: persists metadata when supplied', async () => {
  freshDir()
  await appendTurn('chat-meta', {
    ts: ts(),
    role: 'user',
    content: 'hi',
    metadata: { channel: 'telegram', userId: 42 },
  })
  const conv = await getConversation('chat-meta')
  assert.ok(conv)
  assert.equal(conv.channel, 'telegram')
  assert.deepEqual(conv.turns[0]?.metadata, { channel: 'telegram', userId: 42 })
})

// ── getConversation ──────────────────────────────────────────────────────

test('getConversation: parses ts/role/content correctly', async () => {
  freshDir()
  const t = ts()
  await appendTurn('chat-4', { ts: t, role: 'system', content: 'sys-prompt\nwith\nlines' })
  const conv = await getConversation('chat-4')
  assert.ok(conv)
  assert.equal(conv.threadId, 'chat-4')
  assert.equal(conv.turns.length, 1)
  assert.equal(conv.turns[0]?.ts, t)
  assert.equal(conv.turns[0]?.role, 'system')
  assert.equal(conv.turns[0]?.content, 'sys-prompt\nwith\nlines')
  assert.equal(conv.startedAt, t)
})

test('getConversation: returns null for missing thread', async () => {
  freshDir()
  const conv = await getConversation('does-not-exist')
  assert.equal(conv, null)
})

test('getConversation: skips malformed blocks gracefully', async () => {
  const dir = freshDir()
  // Write a file with one good block, one block missing role, one good block.
  const file = join(dir, 'chat-malformed.md')
  const content =
    '\n---\nts: 2026-04-26T00:00:00.000Z\nrole: user\n---\n\ngood-1\n' +
    '\n---\nts: 2026-04-26T00:01:00.000Z\n---\n\nmissing-role\n' +
    '\n---\nts: 2026-04-26T00:02:00.000Z\nrole: assistant\n---\n\ngood-2\n'
  writeFileSync(file, content)
  const conv = await getConversation('chat-malformed')
  assert.ok(conv)
  assert.equal(conv.turns.length, 2)
  assert.equal(conv.turns[0]?.content, 'good-1')
  assert.equal(conv.turns[1]?.content, 'good-2')
})

// ── listThreads ──────────────────────────────────────────────────────────

test('listThreads: empty when conversations dir does not exist', async () => {
  process.env.CONVERSATIONS_DIR = join(tmpdir(), 'memory-no-such-dir-' + Date.now())
  const out = await listThreads()
  assert.deepEqual(out, [])
})

test('listThreads: sorted by lastModified DESC', async () => {
  freshDir()
  await appendTurn('alpha', { ts: ts(), role: 'user', content: 'a' })
  // Force monotonic mtime ordering: small wait to let mtime tick.
  await new Promise((r) => setTimeout(r, 15))
  await appendTurn('beta', { ts: ts(), role: 'user', content: 'b' })
  await new Promise((r) => setTimeout(r, 15))
  await appendTurn('gamma', { ts: ts(), role: 'user', content: 'g' })
  const threads = await listThreads()
  assert.deepEqual(
    threads.map((t) => t.threadId),
    ['gamma', 'beta', 'alpha'],
  )
  // Each entry has a parseable ISO timestamp.
  for (const t of threads) {
    assert.equal(new Date(t.lastModified).toString() !== 'Invalid Date', true)
  }
})

// ── searchConversations ──────────────────────────────────────────────────

test('searchConversations: returns hits ordered by score, then recency', async () => {
  freshDir()
  await appendTurn('thread-old', { ts: ts(), role: 'user', content: 'tangle is great' })
  await new Promise((r) => setTimeout(r, 15))
  await appendTurn('thread-new', {
    ts: ts(),
    role: 'user',
    content: 'tangle tangle tangle — best framework ever (tangle wins)',
  })
  const hits = await searchConversations('tangle')
  assert.ok(hits.length >= 2)
  // Highest score first
  assert.equal(hits[0]?.threadId, 'thread-new')
  assert.equal(hits[0]?.score, 4)
  assert.equal(hits[1]?.threadId, 'thread-old')
  assert.equal(hits[1]?.score, 1)
  // Snippet contains the match (case-preserved)
  assert.match(hits[0]!.snippet, /tangle/i)
})

test('searchConversations: empty array when no matches', async () => {
  freshDir()
  await appendTurn('thread-q', { ts: ts(), role: 'user', content: 'just some text' })
  const hits = await searchConversations('zzzzzzz-no-match')
  assert.deepEqual(hits, [])
})

test('searchConversations: empty/whitespace query returns []', async () => {
  freshDir()
  await appendTurn('thread-q2', { ts: ts(), role: 'user', content: 'anything' })
  assert.deepEqual(await searchConversations(''), [])
  assert.deepEqual(await searchConversations('   '), [])
})

test('searchConversations: case-insensitive match, original casing in snippet', async () => {
  freshDir()
  await appendTurn('case', { ts: ts(), role: 'user', content: 'The Quick Brown FOX jumps' })
  const hits = await searchConversations('fox')
  assert.equal(hits.length, 1)
  assert.match(hits[0]!.snippet, /FOX/)
})

test('searchConversations: respects k', async () => {
  freshDir()
  for (const id of ['a', 'b', 'c', 'd']) {
    await appendTurn(id, { ts: ts(), role: 'user', content: 'matchword' })
  }
  const hits = await searchConversations('matchword', 2)
  assert.equal(hits.length, 2)
})
