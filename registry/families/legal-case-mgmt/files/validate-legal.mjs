#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'))
if (!pkg.dependencies?.['drizzle-orm']) throw new Error('drizzle-orm missing from dependencies')
for (const rel of ['tsconfig.json', 'src/db/schema.ts']) {
  if (!existsSync(join(here, rel))) throw new Error(`missing ${rel}`)
}
console.log('legal case mgmt starter ok')
