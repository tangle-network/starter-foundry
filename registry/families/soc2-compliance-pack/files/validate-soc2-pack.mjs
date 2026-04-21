#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

for (const rel of [
  'src/audit.ts',
  'src/change-mgmt.ts',
  'docs/SOC2-controls.md',
  'docs/incident-response.md',
  'docs/vendor-attestations.md',
]) {
  if (!existsSync(join(here, rel))) throw new Error(`missing ${rel}`)
}

const chg = readFileSync(join(here, 'src/change-mgmt.ts'), 'utf8')
if (!/approvers\.includes\(change\.requester\)/.test(chg)) throw new Error('change-mgmt.ts missing self-approval rejection')

const controls = readFileSync(join(here, 'docs/SOC2-controls.md'), 'utf8')
if (!/CC7\.2/.test(controls)) throw new Error('SOC2-controls.md missing CC7.2 reference')
if (!/CC8\.1/.test(controls)) throw new Error('SOC2-controls.md missing CC8.1 reference')

console.log('soc2-pack ok')
