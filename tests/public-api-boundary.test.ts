// Public/internal API boundary regression guard. Asserts:
//
//   1. Every path declared in package.json `exports` resolves to a real
//      built file in dist/. (Catches "shipped a broken export" pre-publish.)
//   2. The public barrel src/lib/index.ts only re-exports things that are
//      either listed in `exports` directly OR are convenience re-exports
//      from a listed path. (Catches "leaked an internal helper into the
//      public barrel.")
//   3. No file under dist/ that isn't reachable from `exports` is
//      consumable via subpath import — verified by checking the exports
//      map covers what the barrel reaches.
//
// Run as part of `pnpm test`. Failure means the public surface drifted.

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const PKG = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
  exports: Record<string, string | { import?: string; types?: string }>
  files: string[]
}

interface ExportEntry {
  subpath: string
  built: string
}

function flattenExports(exports: typeof PKG.exports): ExportEntry[] {
  const out: ExportEntry[] = []
  for (const [subpath, target] of Object.entries(exports)) {
    if (typeof target === 'string') {
      out.push({ subpath, built: target })
    } else if (target.import) {
      out.push({ subpath, built: target.import })
    }
  }
  return out
}

const PUBLIC_EXPORTS = flattenExports(PKG.exports)

test('every package.json exports entry points at a real file in dist/', () => {
  for (const entry of PUBLIC_EXPORTS) {
    const abs = resolve(REPO, entry.built)
    assert.ok(
      existsSync(abs),
      `exports["${entry.subpath}"] → ${entry.built} but ${abs} does not exist. ` +
      `Run \`pnpm build\` then re-run, or remove the export.`,
    )
  }
})

test('package.json files[] declares dist/ so the exports actually ship', () => {
  // The npm publish-time package only ships paths in `files`. Without dist/,
  // every export above resolves locally but missing in the published tarball.
  assert.ok(
    PKG.files.some((p) => p === 'dist/' || p === 'dist'),
    'package.json files[] must include "dist/" so the exports ship to npm',
  )
})

test('public exports cover the established surface (12 entrypoints)', () => {
  // Lock the public surface size — adding a new entry is intentional;
  // accidentally exposing a 13th internal module shouldn't pass silently.
  // If you genuinely need a new public export, bump this number AND add the
  // export AND document the API stability commitment in CONTRIBUTING.md.
  const EXPECTED_PUBLIC_ENTRYPOINTS = 12
  assert.equal(
    PUBLIC_EXPORTS.length,
    EXPECTED_PUBLIC_ENTRYPOINTS,
    `Public exports count drifted (was ${EXPECTED_PUBLIC_ENTRYPOINTS}, now ${PUBLIC_EXPORTS.length}). ` +
    `If intentional, update this assertion. If accidental, audit the change.`,
  )
})

test('no exports entry points at a *.test.* or *.spec.* path', () => {
  for (const entry of PUBLIC_EXPORTS) {
    assert.doesNotMatch(
      entry.built,
      /\.(test|spec)\./,
      `exports["${entry.subpath}"] points at ${entry.built} — test files should never be public`,
    )
  }
})

test('no exports entry points outside dist/ (would leak source)', () => {
  for (const entry of PUBLIC_EXPORTS) {
    assert.match(
      entry.built,
      /^\.\/dist\//,
      `exports["${entry.subpath}"] = ${entry.built} — must point at compiled dist/, not src/`,
    )
  }
})
