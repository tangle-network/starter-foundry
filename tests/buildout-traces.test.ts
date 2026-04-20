import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BUILDOUT_SCHEMA_VERSION,
  DEFAULT_PATHS,
  emptyMinerState,
  isBuildoutSlug,
  parseSlug,
  VERTICAL_TO_PARTNER,
} from '../dist/lib/buildout-traces.js'

test('isBuildoutSlug: recognizes factory-local-phase2 slugs', () => {
  assert.equal(
    isBuildoutSlug(
      '-private-var-folders-wk-qcfly3h940s4cfmlpxbyf21w0000gn-T-factory-local-phase2-ethereum-l1-mo66lt85-nft-mint-page-r1-nft-mint-page-lDU8vu',
    ),
    true,
  )
  assert.equal(isBuildoutSlug('-Users-drew-webb-starter-foundry'), false)
  assert.equal(isBuildoutSlug('-Users-drew-webb-blueprint-agent'), false)
  assert.equal(isBuildoutSlug('-private-var-folders-something-else'), false)
})

test('parseSlug: extracts partner + scenarioId + replayRound', () => {
  const r = parseSlug(
    '-private-var-folders-wk-qcfly3h940s4cfmlpxbyf21w0000gn-T-factory-local-phase2-ethereum-l1-mo66lt85-nft-mint-page-r1-nft-mint-page-lDU8vu',
  )
  assert.equal(r.partnerGuess, 'ethereum-l1')
  assert.equal(r.scenarioId, 'nft-mint-page')
  assert.equal(r.replayRound, 1)
})

test('parseSlug: supports multi-word scenarios + r3', () => {
  const r = parseSlug(
    '-private-var-folders-wk-qcfly3h940s4cfmlpxbyf21w0000gn-T-factory-local-phase2-arbitrum-stylus-mo6kqj5u-stylus-gas-profiler-r3-stylus-gas-profiler-IQNfcV',
  )
  assert.equal(r.partnerGuess, 'arbitrum-stylus')
  assert.equal(r.scenarioId, 'stylus-gas-profiler')
  assert.equal(r.replayRound, 3)
})

test('parseSlug: returns nulls on unrecognized shapes', () => {
  const r = parseSlug('-Users-drew-webb-starter-foundry')
  assert.equal(r.partnerGuess, null)
  assert.equal(r.scenarioId, null)
  assert.equal(r.replayRound, null)
})

test('VERTICAL_TO_PARTNER: maps slug verticals to VB partner names', () => {
  assert.equal(VERTICAL_TO_PARTNER['ethereum-l1'], 'ethereum-foundation')
  assert.equal(VERTICAL_TO_PARTNER['arbitrum-stylus'], 'arbitrum-foundation')
  assert.equal(VERTICAL_TO_PARTNER['tangle-blueprints-mpc'], 'tangle-foundation')
})

test('emptyMinerState: initializes with current schema', () => {
  const s = emptyMinerState()
  assert.equal(s.schemaVersion, BUILDOUT_SCHEMA_VERSION)
  assert.deepEqual(s.mtimes, {})
  assert.deepEqual(s.poisoned, {})
  assert.equal(s.lastRun, null)
})

test('DEFAULT_PATHS: stable for consumers', () => {
  assert.equal(DEFAULT_PATHS.buildoutsJsonl, '.evolve/traces/buildouts.jsonl')
  assert.equal(DEFAULT_PATHS.analysisJson, '.evolve/buildout-analysis.json')
  assert.equal(DEFAULT_PATHS.minerState, '.evolve/traces/.buildouts-miner-state.json')
})
