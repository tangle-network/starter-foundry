#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

for (const rel of [
  'src/encryption.ts',
  'src/phi-access.ts',
  'src/audit-log.ts',
  'docs/HIPAA-controls.md',
  'docs/BAA-template.md',
  'tsconfig.json',
]) {
  if (!existsSync(join(here, rel))) throw new Error(`missing ${rel}`)
}

const enc = readFileSync(join(here, 'src/encryption.ts'), 'utf8')
if (!enc.includes('aes-256-gcm')) throw new Error('encryption.ts does not use aes-256-gcm')
if (!/IV_LENGTH\s*=\s*12/.test(enc)) throw new Error('encryption.ts IV_LENGTH must be 96-bit (12 bytes)')

const phi = readFileSync(join(here, 'src/phi-access.ts'), 'utf8')
if (!phi.includes('withPhiAccess')) throw new Error('phi-access.ts missing withPhiAccess export')
if (!phi.includes('filterByMinimumNecessary')) throw new Error('phi-access.ts missing minimum-necessary filter')

const audit = readFileSync(join(here, 'src/audit-log.ts'), 'utf8')
if (!audit.includes('append-only')) throw new Error('audit-log.ts should document append-only semantics')

const controls = readFileSync(join(here, 'docs/HIPAA-controls.md'), 'utf8')
if (!/§164\.312/.test(controls)) throw new Error('HIPAA-controls.md missing §164.312 references')

console.log('hipaa-pack ok')
