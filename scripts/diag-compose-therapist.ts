#!/usr/bin/env tsx
import { composeStarter } from '../src/lib/compose.js'
const dir = process.argv[2] ?? '/tmp/br-check-test'
await composeStarter({
  spec: { family: 'agent-runtime-therapist-ts', layers: [], projectName: 'br-check' },
  outDir: dir,
})
console.log('composed →', dir)
