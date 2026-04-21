#!/usr/bin/env node
// Minimal structural validator for the phaser-game starter.
// Asserts: package.json has phaser + vite, entrypoints exist, config files present.

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'))
if (!pkg.dependencies?.phaser) throw new Error('phaser not in dependencies')
if (!pkg.devDependencies?.vite) throw new Error('vite not in devDependencies')

for (const rel of ['index.html', 'tsconfig.json', 'vite.config.ts', 'src/main.ts']) {
  if (!existsSync(join(here, rel))) throw new Error(`missing ${rel}`)
}

console.log('phaser game starter ok')
