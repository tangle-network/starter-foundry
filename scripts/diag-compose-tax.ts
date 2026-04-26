#!/usr/bin/env tsx
import { composeStarter } from '../src/lib/compose.js'
const dir = process.argv[2] ?? '/tmp/tax-check'
await composeStarter({
  spec: { family: 'agent-runtime-tax-ts', layers: [], projectName: 'tax-check' },
  outDir: dir,
})
console.log('composed →', dir)
