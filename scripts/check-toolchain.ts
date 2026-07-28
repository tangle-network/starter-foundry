#!/usr/bin/env node
// Toolchain probe — runs before `pnpm test` (wired as `pretest`) and warns
// when integration-test toolchains are missing. Doesn't fail; tests that
// actually require a missing tool will fail with a clear toolchain message
// of their own. The point of this script is to surface the requirement up
// front so a contributor doesn't burn ten minutes wondering why six tests
// fail with `spawn forge ENOENT`.
//
// Add a tool: append it to TOOLS with the install hint. Don't gate the
// process; this is informational.

import { spawnSync } from 'node:child_process'

const TOOLS = [
  {
    bin: 'forge',
    needFor:
      '4 forge/xlayer integration tests + multichain workspace benchmark + runPromptCorpus multichain',
    install: 'curl -L https://foundry.paradigm.xyz | bash && ~/.foundry/bin/foundryup',
  },
  {
    bin: 'cargo',
    needFor: 'solana-program toolchain validation in workspace tests',
    install: 'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh',
  },
]

let missing = 0
for (const t of TOOLS) {
  const res = spawnSync(t.bin, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
  if (res.status === 0) continue
  missing += 1
  process.stderr.write(`[toolchain] missing: ${t.bin}\n`)
  process.stderr.write(`            needed for: ${t.needFor}\n`)
  process.stderr.write(`            install: ${t.install}\n\n`)
}
if (missing > 0) {
  process.stderr.write(
    `[toolchain] ${missing} tool(s) not on PATH — related integration tests will fail. Continuing.\n`,
  )
}
process.exit(0)
