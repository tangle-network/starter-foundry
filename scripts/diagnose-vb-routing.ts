#!/usr/bin/env tsx
// Diagnose: among the 27 BA `family=null` routing-errors, which now route
// correctly post-Task-51, and which remain unrouteable?

import { selectStarter } from '../src/lib/selection.js'

const PROMPTS = [
  // ai-agents-mixed
  'multi-agent-conversation',
  // base-defi
  'base-dex-aggregator',
  'base-perp-trading',
  'smart-wallet-passkey-connect',
  'paymaster-sponsor-badge',
  'cbeth-liquid-staking-mint',
  'uniswap-v4-hook-swap',
  'morpho-blue-market-curator',
  'aerodrome-cl-auto-rebalancer',
  // ethereum-l1
  'nft-mint-page',
  'dex-swap',
  'dao-proposals',
  'agent-trading',
  'zk-mixer-ui',
  'cross-chain-bridge',
]

interface Bucket {
  routed: string[]
  unrouteable: string[]
  fallbackStatic: string[]
  fallbackProduct: string[]
}

const out: Bucket = { routed: [], unrouteable: [], fallbackStatic: [], fallbackProduct: [] }

for (const prompt of PROMPTS) {
  const r = await selectStarter({ prompt })
  const desc = `${prompt.padEnd(38)} → ${r.spec.family.padEnd(28)} (${r.routingRisk})`
  if (r.routingRisk === 'safe') out.routed.push(desc)
  else if (r.routingRisk === 'unrouteable') out.unrouteable.push(desc)
  else if (r.routingRisk === 'fallback-static') out.fallbackStatic.push(desc)
  else if (r.routingRisk === 'fallback-product') out.fallbackProduct.push(desc)
}

const HR = '─'.repeat(76)
console.log(HR)
console.log(`Diagnose: 15 distinct DeFi/blockchain leaf-IDs from BA family=null cluster`)
console.log(`(27 total occurrences; some leaves repeat across runs)`)
console.log(HR)

console.log(`\n✓ NOW ROUTED CORRECTLY (${out.routed.length}/${PROMPTS.length}):`)
for (const r of out.routed) console.log(`   ${r}`)

console.log(`\n⚠ UNROUTEABLE — caller-side disambiguation needed (${out.unrouteable.length}/${PROMPTS.length}):`)
for (const r of out.unrouteable) console.log(`   ${r}`)

console.log(`\n? FALLBACK-PRODUCT (${out.fallbackProduct.length}/${PROMPTS.length}):`)
for (const r of out.fallbackProduct) console.log(`   ${r}`)

console.log(`\n? FALLBACK-STATIC (${out.fallbackStatic.length}/${PROMPTS.length}):`)
for (const r of out.fallbackStatic) console.log(`   ${r}`)

console.log()
console.log(HR)
console.log(`SUMMARY`)
console.log(HR)
console.log(`  routed:           ${out.routed.length}/${PROMPTS.length}`)
console.log(`  unrouteable:      ${out.unrouteable.length}/${PROMPTS.length}  ← signal-raised, no longer silent`)
console.log(`  fallback-static:  ${out.fallbackStatic.length}/${PROMPTS.length}  ← still silent fallback`)
console.log(`  fallback-product: ${out.fallbackProduct.length}/${PROMPTS.length}  ← natural-language fullstack default`)
