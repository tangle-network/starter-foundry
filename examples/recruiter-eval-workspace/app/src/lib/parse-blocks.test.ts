// Round-trip tests for parse-blocks. Run with `node --test` after tsc.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBlocks, splitBlocksAndProse, isAgentBlock } from './parse-blocks.js'

test('parses a single :::artifact block with body', () => {
  const text = ':::artifact\nhello\n:::\n'
  const blocks = parseBlocks(text)
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0]!.kind, 'artifact')
  assert.equal(blocks[0]!.kind === 'artifact' ? blocks[0]!.body : '', 'hello')
})

test('parses inline attrs with quoted values', () => {
  const text = ':::artifact id=intro title="Welcome packet"\nbody\n:::\n'
  const blocks = parseBlocks(text)
  assert.ok(isAgentBlock(blocks[0]!))
  if (isAgentBlock(blocks[0]!)) {
    assert.equal(blocks[0].attrs.id, 'intro')
    assert.equal(blocks[0].attrs.title, 'Welcome packet')
  }
})

test('flags unterminated fence as malformed', () => {
  const text = ':::artifact\nbody without close\nmore body'
  const blocks = parseBlocks(text)
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0]!.kind, 'malformed')
})

test('splitBlocksAndProse interleaves narrative + blocks', () => {
  const text = 'intro\n:::artifact\na\n:::\nmiddle\n:::escalation\nb\n:::\ntail'
  const segments = splitBlocksAndProse(text)
  assert.equal(segments.length, 5)
  assert.equal(segments[0]!.kind, 'prose')
  assert.equal(segments[1]!.kind, 'artifact')
  assert.equal(segments[2]!.kind, 'prose')
  assert.equal(segments[3]!.kind, 'escalation')
  assert.equal(segments[4]!.kind, 'prose')
})

test('multiple consecutive blocks parse independently', () => {
  const text = ':::artifact\na\n:::\n:::escalation\nb\n:::\n'
  const blocks = parseBlocks(text)
  assert.equal(blocks.length, 2)
  assert.equal(blocks[0]!.kind, 'artifact')
  assert.equal(blocks[1]!.kind, 'escalation')
})

test('attrs without value default to empty string', () => {
  const text = ':::artifact urgent id=x\nbody\n:::\n'
  const blocks = parseBlocks(text)
  assert.ok(isAgentBlock(blocks[0]!))
  if (isAgentBlock(blocks[0]!)) {
    assert.equal(blocks[0].attrs.urgent, '')
    assert.equal(blocks[0].attrs.id, 'x')
  }
})
