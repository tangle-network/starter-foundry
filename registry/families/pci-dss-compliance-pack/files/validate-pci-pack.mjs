#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
for (const rel of ['src/pan-redact.ts', 'src/tokenize.ts', 'docs/PCI-DSS-controls.md']) {
  if (!existsSync(join(here, rel))) throw new Error(`missing ${rel}`)
}

const redact = readFileSync(join(here, 'src/pan-redact.ts'), 'utf8')
if (!redact.includes('luhnValid')) throw new Error('pan-redact.ts missing Luhn check')
if (!redact.includes('redactPan')) throw new Error('pan-redact.ts missing redactPan export')

const tokenize = readFileSync(join(here, 'src/tokenize.ts'), 'utf8')
if (!tokenize.includes('assertNoChdInRef')) throw new Error('tokenize.ts missing assertNoChdInRef')
if (!tokenize.includes("pm_")) throw new Error('tokenize.ts missing Stripe pm_ token assertion')

console.log('pci-pack ok')
