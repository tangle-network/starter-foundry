import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const CORE_TERM_BUDGETS: Record<string, Record<string, number>> = {
  'src/lib/keywords.ts': {
    fhenix: 0,
    cofhe: 0,
    cofhejs: 0,
    fhevm: 0,
    zama: 0,
    tfhe: 0,
    layerzero: 2,
    uniswap: 4,
    'v4 hook': 2,
    stylus: 3,
  },
  'src/lib/prompt-planner.ts': {
    fhenix: 0,
    stylus: 16,
  },
  'src/lib/planner/partner-first.ts': {
    fhenix: 0,
  },
  'src/lib/planner/contracts.ts': {
    layerzero: 4,
  },
  'src/lib/planner/detectors.ts': {
    layerzero: 1,
    stylus: 1,
  },
}

function countTerm(text: string, term: string): number {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.match(new RegExp(escaped, 'gi'))?.length ?? 0
}

test('generic planner files do not grow provider/protocol hardcode budgets', () => {
  for (const [file, budgets] of Object.entries(CORE_TERM_BUDGETS)) {
    const text = readFileSync(file, 'utf8')
    for (const [term, budget] of Object.entries(budgets)) {
      const actual = countTerm(text, term)
      assert.ok(
        actual <= budget,
        `${file} contains ${actual} occurrences of "${term}" (budget ${budget}); put new domain knowledge in registry domainPack metadata`,
      )
    }
  }
})

test('new domain-pack selector stays provider-neutral', () => {
  const text = readFileSync('src/lib/domain-packs.ts', 'utf8')
  for (const term of [
    'fhenix',
    'cofhe',
    'cofhejs',
    'fhevm',
    'zama',
    'tfhe',
    'layerzero',
    'wormhole',
    'uniswap',
  ]) {
    assert.equal(
      countTerm(text, term),
      0,
      `src/lib/domain-packs.ts must stay generic; found provider/protocol term "${term}"`,
    )
  }
})
