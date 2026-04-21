#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
for (const rel of [
  'src/consent.ts',
  'src/data-subject-rights.ts',
  'src/data-inventory.ts',
  'src/components/CookieBanner.tsx',
  'docs/GDPR-controls.md',
  'docs/DPIA-template.md',
]) {
  if (!existsSync(join(here, rel))) throw new Error(`missing ${rel}`)
}

const consent = readFileSync(join(here, 'src/consent.ts'), 'utf8')
if (!consent.includes('withdrawnAt')) throw new Error('consent.ts must track withdrawnAt (Art. 7 withdrawability)')
if (!/validateConsentRequest/.test(consent)) throw new Error('consent.ts missing validateConsentRequest')

const dsr = readFileSync(join(here, 'src/data-subject-rights.ts'), 'utf8')
if (!dsr.includes('honorErasure')) throw new Error('data-subject-rights.ts missing honorErasure')
if (!dsr.includes('collectExport')) throw new Error('data-subject-rights.ts missing collectExport')
if (!/Art\. 17\(3\)/.test(dsr)) throw new Error('data-subject-rights.ts must document Art. 17(3) exceptions')

const controls = readFileSync(join(here, 'docs/GDPR-controls.md'), 'utf8')
if (!/Art\. 15|Right of access/.test(controls)) throw new Error('GDPR-controls.md missing Art. 15 reference')
if (!/Art\. 17|right to erasure/i.test(controls)) throw new Error('GDPR-controls.md missing Art. 17 reference')

console.log('gdpr-pack ok')
