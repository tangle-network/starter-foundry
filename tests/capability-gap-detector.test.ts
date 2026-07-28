// Regression tests for scripts/infer-capability-gaps.ts (rewritten in
// response to blueprint-agent bug report #4, 2026-04-20). The detector
// must classify agent-added packages as either scaffold-gap (package not
// in family deps → real gap in registry) or orchestration (package in
// family deps → install pipeline didn't finish before agent saw scaffold).
//
// These tests exercise the classification logic directly against
// synthetic buildouts rather than invoking the script — the script
// writes to .evolve/ and reads the live buildouts.jsonl, which is
// unsuitable for hermetic tests.

import assert from 'node:assert/strict'
import test from 'node:test'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const FAMILIES_DIR = 'registry/families'

function loadFamilyDeps(family: string): Set<string> {
  const pkgPath = join(FAMILIES_DIR, family, 'files', 'package.json')
  if (!existsSync(pkgPath)) return new Set()
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const deps = new Set<string>()
  for (const block of [
    pkg.dependencies,
    pkg.devDependencies,
    pkg.peerDependencies,
    pkg.optionalDependencies,
  ]) {
    for (const name of Object.keys(block ?? {})) deps.add(name)
  }
  for (const name of Object.keys(pkg.overrides ?? {})) deps.add(name)
  for (const name of Object.keys(pkg.pnpm?.overrides ?? {})) deps.add(name)
  return deps
}

test('capability-gap classifier: react-vite-ts ships lucide-react (orchestration, not gap)', () => {
  // The top orchestration signal from blueprint-agent's 137-session bench was
  // lucide-react (17 installs). react-vite-ts family.package.json ships it —
  // agent re-declaring it means install didn't run. Classified as orchestration.
  const deps = loadFamilyDeps('react-vite-ts')
  assert.ok(
    deps.has('lucide-react'),
    `react-vite-ts must ship lucide-react (blueprint-agent bug #4 orchestration class)`,
  )
})

test('capability-gap classifier: no family ships snarkjs or circomlibjs (real scaffold gap)', () => {
  // Top scaffold-gap signal: zk-mixer-ui agents installed snarkjs + circomlibjs
  // 4× each, all on fail. No family or capability layer ships them — the
  // detector correctly flags this as a gap in the registry itself (missing
  // zk-js capability layer for ZK browser-side prover apps).
  const families = readdirSync(FAMILIES_DIR)
  for (const pkg of ['snarkjs', 'circomlibjs']) {
    const shippers = families.filter((f) => loadFamilyDeps(f).has(pkg))
    assert.deepEqual(
      shippers,
      [],
      `${pkg} appears in ${shippers.join(', ')} — gap-detector regression test stale. If you intentionally added ${pkg}, update this test.`,
    )
  }
})

test('capability-gap classifier: every React family ships lucide-react (cross-family consistency)', () => {
  // If any React family fails to ship lucide-react, the scaffold-default
  // capability:shadcn can't render its icon-using components. A gap the
  // detector would flag as 'scaffold-gap' per-React-family.
  const REACT_FAMILIES = ['react-vite-ts', 'nextjs-ts', 'remix-ts']
  for (const family of REACT_FAMILIES) {
    const deps = loadFamilyDeps(family)
    assert.ok(deps.has('lucide-react'), `${family} must ship lucide-react for shadcn compatibility`)
  }
})
