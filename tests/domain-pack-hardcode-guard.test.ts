import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

interface HardcodeBudget {
  max: number
  removalTarget: string
}

function budget(max: number, removalTarget: string): HardcodeBudget {
  return { max, removalTarget }
}

const CORE_TERM_BUDGETS: Record<string, Record<string, HardcodeBudget>> = {
  'src/lib/keywords.ts': {
    fhenix: budget(0, 'FHE provider evidence belongs in registry domainPack metadata.'),
    cofhe: budget(0, 'FHE protocol evidence belongs in registry domainPack metadata.'),
    cofhejs: budget(0, 'FHE SDK evidence belongs in registry domainPack metadata.'),
    fhevm: budget(0, 'fhEVM evidence belongs in registry domainPack metadata.'),
    zama: budget(0, 'FHE provider evidence belongs in registry domainPack metadata.'),
    tfhe: budget(0, 'FHE scheme evidence belongs in registry domainPack metadata.'),
    layerzero: budget(
      2,
      'Move EVM lane/protocol keyword detection to registry-backed surface selection.',
    ),
    uniswap: budget(
      4,
      'Add Uniswap V4 hook domainPack metadata/tests, then remove Solidity-authoring keywords.',
    ),
    'v4 hook': budget(
      2,
      'Add Uniswap V4 hook domainPack metadata/tests, then remove Solidity-authoring keywords.',
    ),
    stylus: budget(
      3,
      'Use registry family taxonomy/domainPack metadata for contract runtime lane detection.',
    ),
  },
  'src/lib/prompt-planner.ts': {
    fhenix: budget(0, 'FHE workspace routing must stay domainPack-driven.'),
    stylus: budget(
      16,
      'Generalize protocol workspace collection to registry-declared contract families.',
    ),
  },
  'src/lib/planner/partner-first.ts': {
    fhenix: budget(
      0,
      'Partner-first promotion must read provider evidence from registry metadata.',
    ),
  },
  'src/lib/planner/contracts.ts': {
    layerzero: budget(
      0,
      'LayerZero OFT layer/default routing is owned by its capability manifest.',
    ),
  },
  'src/lib/planner/detectors.ts': {
    layerzero: budget(1, 'Use registry domainPack surface signals for implicit API detection.'),
    stylus: budget(1, 'Infer partner aliases from registry partner metadata.'),
  },
}

function countTerm(text: string, term: string): number {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.match(new RegExp(escaped, 'gi'))?.length ?? 0
}

test('generic planner files do not grow provider/protocol hardcode budgets', () => {
  for (const [file, budgets] of Object.entries(CORE_TERM_BUDGETS)) {
    const text = readFileSync(file, 'utf8')
    for (const [term, { max, removalTarget }] of Object.entries(budgets)) {
      const actual = countTerm(text, term)
      assert.ok(removalTarget.length > 0, `${file} "${term}" budget must document a removal target`)
      assert.ok(
        actual <= max,
        `${file} contains ${actual} occurrences of "${term}" (budget ${max}); put new domain knowledge in registry domainPack metadata. Removal target: ${removalTarget}`,
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
