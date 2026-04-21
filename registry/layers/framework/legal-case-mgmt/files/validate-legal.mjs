#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'))

if (!pkg.dependencies?.['drizzle-orm']) throw new Error('drizzle-orm missing from dependencies')
if (!pkg.dependencies?.['decimal.js']) throw new Error('decimal.js missing from dependencies')
if (!pkg.dependencies?.['postgres']) throw new Error('postgres missing from dependencies')

const required = [
  'tsconfig.json',
  'src/server.ts',
  'src/db/schema.ts',
  'src/db/client.ts',
  'src/api/matter.ts',
  'src/api/billing.ts',
  'drizzle.config.ts',
]
for (const rel of required) {
  if (!existsSync(join(here, rel))) throw new Error(`missing required file: ${rel}`)
}

console.log('legal starter ok')
