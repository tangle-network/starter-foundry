#!/usr/bin/env tsx
import { loadRegistry } from '../src/lib/registry.js'
import { selectStarter } from '../src/lib/selection.js'

const reg = await loadRegistry()
const fc = reg.families.get('forge-contracts')
const tk = fc?.tieredKeywords
console.log('forge-contracts tier2 length:', tk?.tier2?.length)
console.log('  contains "dex":', tk?.tier2?.includes('dex'))
console.log('  contains "swap":', tk?.tier2?.includes('swap'))
console.log('  contains "dao":', tk?.tier2?.includes('dao'))

// Now try selectStarter
const r = await selectStarter({ prompt: 'dex-swap' })
console.log('\nselectStarter("dex-swap"):')
console.log('  family:', r.spec.family)
console.log('  risk:', r.routingRisk)
console.log('  fallbackUsed:', r.fallbackUsed)
console.log('  reasons:', r.reasons)
