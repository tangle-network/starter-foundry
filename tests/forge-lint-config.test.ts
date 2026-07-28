// R1 post-Gen-9 regression guard: ensure forge-based framework layers ship
// a `[lint]` config that keeps the VB "lint" layer green on agent-written
// DEX / swap / vault code.
//
// History: pre-R1, 14/14 dex-swap/ethereum-l1 buildouts failed on the VB
// `lint` layer at blendedScore=0.868 (everything else passed). Root cause:
// forge-lint default strict mode flags `unsafe-typecast` and naming-
// convention lints (`mixed-case-variable`, `screaming-snake-case-immutable`)
// that every real DEX scaffold trips on — especially in test/script
// fixtures where bytes32("s") and similar casts are routine. This test
// guards the config shape against silent removal.

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, '..')

const FORGE_TOML_FILES = [
  'registry/layers/framework/forge-foundation/files/foundry.toml',
  'registry/layers/framework/tangle-blueprint/files/foundry.toml',
]

describe('forge-lint config ships on every forge-based framework layer', () => {
  for (const relPath of FORGE_TOML_FILES) {
    test(`${relPath} has [lint] section with severity + ignore`, () => {
      const text = readFileSync(join(REPO, relPath), 'utf8')

      assert.match(
        text,
        /^\[lint\]/m,
        `${relPath} must declare a [lint] section — agent-written DEX code fails the VB lint layer under forge-lint defaults`,
      )

      // severity must exclude "info" (naming-convention noise) but include
      // "high" (real bug classes like unsafe-typecast on src/).
      const sevMatch = text.match(/^severity\s*=\s*\[([^\]]+)\]/m)
      assert.ok(sevMatch, `${relPath} [lint] section must set severity`)
      const sev = sevMatch![1]!
      assert.match(sev, /"high"/, `${relPath} severity must keep "high" (real bug classes)`)
      assert.doesNotMatch(
        sev,
        /"info"/,
        `${relPath} severity must NOT include "info" (naming-convention noise)`,
      )

      // test/script directories ignored — fixture code routinely uses
      // bytes32 casts and raw arithmetic that are not real bugs.
      assert.match(
        text,
        /^ignore\s*=\s*\[[^\]]*test/m,
        `${relPath} [lint] section must ignore test/** — fixture bytes32 casts are not bugs`,
      )
      assert.match(
        text,
        /^ignore\s*=\s*\[[^\]]*script/m,
        `${relPath} [lint] section must ignore script/** — deploy scripts routinely need raw casts`,
      )
    })
  }
})
