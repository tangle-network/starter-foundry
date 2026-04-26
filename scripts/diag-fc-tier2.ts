#!/usr/bin/env tsx
import { loadRegistry } from '../src/lib/registry.js'
const reg = await loadRegistry()
const fc = reg.families.get('forge-contracts')
const tier2 = fc?.tieredKeywords?.tier2 ?? []
console.log(`tier2.length = ${tier2.length}`)
console.log('contains dex?', tier2.includes('dex'))
console.log('contains swap?', tier2.includes('swap'))
console.log('contains "yield"?', tier2.includes('yield'))
console.log('first 30 entries:')
for (const e of tier2.slice(0, 30)) console.log(`  - ${e}`)
console.log(`...`)
for (const e of tier2.slice(-5)) console.log(`  - ${e}`)
