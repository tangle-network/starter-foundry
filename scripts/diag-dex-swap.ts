#!/usr/bin/env tsx
import { selectStarter } from '../src/lib/selection.js'

for (const p of ['dex-swap', 'dao-proposals', 'cross-chain-bridge', 'nft-mint-page']) {
  const r = await selectStarter({ prompt: p })
  console.log(`${p.padEnd(28)} → ${r.spec.family.padEnd(24)} risk=${r.routingRisk}`)
}
