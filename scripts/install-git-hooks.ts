#!/usr/bin/env node
// Install git hooks from scripts/hooks/ into .git/hooks/. Idempotent.
// Use `pnpm setup:hooks` after a fresh clone to wire up the pre-push
// measurement check.

import { existsSync, chmodSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HOOK_SRC = join(REPO, 'scripts/hooks')
const HOOK_DST = join(REPO, '.git/hooks')

const HOOKS = ['pre-push']

if (!existsSync(join(REPO, '.git'))) {
  console.error('install-git-hooks: no .git directory — not a git repo?')
  process.exit(1)
}

mkdirSync(HOOK_DST, { recursive: true })

let installed = 0
let skipped = 0
for (const name of HOOKS) {
  const src = join(HOOK_SRC, `${name}.sh`)
  const dst = join(HOOK_DST, name)
  if (!existsSync(src)) {
    console.warn(`install-git-hooks: source missing: ${src}`)
    continue
  }
  const desired = readFileSync(src, 'utf8')
  if (existsSync(dst)) {
    const current = readFileSync(dst, 'utf8')
    if (current === desired) {
      skipped += 1
      continue
    }
  }
  writeFileSync(dst, desired)
  chmodSync(dst, 0o755)
  installed += 1
  console.log(`  installed ${name}`)
}

console.log(`install-git-hooks: ${installed} installed, ${skipped} unchanged`)
