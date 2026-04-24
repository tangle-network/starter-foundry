// Evolve R3 regression guard: every composed scaffold with a package.json
// must ship the "Pre-installed packages — do NOT re-install" section in
// AGENTS.md/CLAUDE.md. Without it, agents run `pnpm add lucide-react`
// on scaffolds that already ship lucide-react, burning turns and tokens.
//
// Diagnosis (2026-04-24): top 4 redundant packages account for 54+
// wasted installs in the 30-day window across dex-swap, dao-proposals,
// zk-mixer-ui, agent-trading, cross-chain-bridge scenarios. All on
// react-vite-ts. Fix: tell the agent what's there.

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const REPO = realpathSync(process.cwd())
const CLI = join(REPO, 'dist/cli.js')

function compose(layers: string[]): { outDir: string; cleanup: () => void } {
  const outDir = realpathSync(mkdtempSync(join(tmpdir(), 'preinstalled-hint-')))
  const specPath = join(outDir, '_spec.json')
  const spec = {
    projectName: 'probe',
    family: 'react-vite-ts',
    layers,
    partner: null,
    slots: {},
    variables: {},
  }
  writeFileSync(specPath, JSON.stringify(spec))
  const res = spawnSync('node', [CLI, 'compose', '--spec', specPath, '--out', outDir, '--json'], {
    cwd: REPO,
    encoding: 'utf8',
  })
  assert.equal(res.status, 0, `compose failed: ${res.stderr}`)
  return { outDir, cleanup: () => rmSync(outDir, { recursive: true, force: true }) }
}

describe('AGENTS.md pre-installed packages hint', () => {
  test('react-vite-ts scaffold lists lucide-react / tailwindcss / clsx as pre-installed', () => {
    const { outDir, cleanup } = compose(['framework:react-vite-ts'])
    try {
      const agents = readFileSync(join(outDir, 'AGENTS.md'), 'utf8')
      assert.match(agents, /## Pre-installed packages — do NOT re-install/)
      // The redundant-install culprits from buildout-analysis.json:
      for (const pkg of ['lucide-react', 'tailwindcss', 'clsx', 'react']) {
        assert.match(agents, new RegExp(`\`${pkg}\``), `${pkg} must appear in pre-installed list`)
      }
      // The hint must explicitly forbid re-install commands.
      assert.match(agents, /do not run `pnpm add`/, 'must tell agent not to run pnpm add')
    } finally {
      cleanup()
    }
  })

  test('capability:zk-browser adds snarkjs/circomlibjs to the pre-installed list', () => {
    // This is the second-biggest redundant-install cluster: zk-mixer-ui
    // scenarios installed snarkjs/circomlibjs/circomlib/@zk-kit/ethers
    // when the zk-browser capability already ships them all.
    const { outDir, cleanup } = compose(['framework:react-vite-ts', 'capability:zk-browser'])
    try {
      const agents = readFileSync(join(outDir, 'AGENTS.md'), 'utf8')
      for (const pkg of ['snarkjs', 'circomlibjs', 'circomlib', '@zk-kit/incremental-merkle-tree', 'ethers']) {
        assert.match(agents, new RegExp(`\`${pkg.replace(/[/]/g, '\\/')}\``), `${pkg} must appear when zk-browser attached`)
      }
    } finally {
      cleanup()
    }
  })

  test('CLAUDE.md and AGENTS.md ship identical pre-installed sections', () => {
    const { outDir, cleanup } = compose(['framework:react-vite-ts'])
    try {
      const agents = readFileSync(join(outDir, 'AGENTS.md'), 'utf8')
      const claude = readFileSync(join(outDir, 'CLAUDE.md'), 'utf8')
      assert.equal(agents, claude, 'AGENTS.md and CLAUDE.md must be identical — one doc, two filenames')
    } finally {
      cleanup()
    }
  })
})
