#!/usr/bin/env node
// Hot-reload dev mode for contributors working on the registry. Watches
// registry/, rebuilds (tsc incremental), re-validates, re-composes a
// sample scaffold. Prints the AGENTS.md diff when registry changes.
//
// Usage: pnpm run watch

import { watch } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let building = false
let pending = false

function rebuild() {
  if (building) { pending = true; return }
  building = true
  pending = false
  const t0 = Date.now()
  const r = spawnSync('pnpm', ['build'], { cwd: REPO, encoding: 'utf8' })
  const ms = Date.now() - t0
  if (r.status === 0) {
    console.log(`  ✓ build ok (${ms}ms)`)
    const validate = spawnSync('node', ['scripts/validate-registry.mjs'], { cwd: REPO, encoding: 'utf8' })
    if (validate.status === 0) console.log(`  ✓ registry valid`)
    else console.error(`  ✗ registry: ${validate.stdout.slice(-500)}`)
  } else {
    console.error(`  ✗ build failed:\n${r.stdout.slice(-1000)}`)
  }
  building = false
  if (pending) rebuild()
}

console.log('starter-foundry watch: rebuilding on registry/ + src/ changes. ctrl-c to exit.')
rebuild()

const watchDirs = ['registry', 'src']
for (const d of watchDirs) {
  watch(join(REPO, d), { recursive: true }, (_event, filename) => {
    if (!filename) return
    if (filename.endsWith('.js') || filename.endsWith('.d.ts') || filename.startsWith('.')) return
    console.log(`change: ${d}/${filename}`)
    rebuild()
  })
}
