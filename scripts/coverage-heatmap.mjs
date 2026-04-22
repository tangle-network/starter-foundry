#!/usr/bin/env node
// Coverage heatmap: (industry × runtime × partner) grid showing where
// the registry has real coverage vs gaps. An entry is "covered" when
// there exists a family that applies to the runtime, at least one
// capability in that industry, and at least one partner package has
// the right chain/SDK combo.
//
// Emits .evolve/reports/coverage-heatmap.json + an ASCII table to
// stdout. Gaps are flagged so the next proposer cycle has a ranked
// list of worlds to expand into.
//
// Usage:
//   node scripts/coverage-heatmap.mjs

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(REPO, '.evolve/reports/coverage-heatmap.json')

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

const industries = readdirSync(join(REPO, 'registry/layers/industry'))
const partners = readdirSync(join(REPO, 'registry/partners'))

// "Runtime buckets" — group the 94 families into meaningful axes.
const runtimes = {
  'web-frontend': ['react-vite-ts', 'nextjs-ts', 'remix-ts', 'sveltekit-ts', 'vue-ts', 'angular-ts', 'astro-static', 'eleventy-static', 'hugo-static', 'zola-static', 'frontend-static'],
  'web-fullstack': ['fullstack-ts', 'nextjs-app-router', 'fullstack-node-ts'],
  'backend-node': ['api-service', 'node-http', 'node-worker', 'bun-http', 'deno-edge', 'cloudflare-worker-ts', 'agent-service-ts', 'agent-swarm-ts', 'mcp-server-ts'],
  'backend-py': ['python-http', 'python-data-app', 'python-worker', 'fastapi-service', 'agent-service-py', 'rag-pipeline-py', 'dspy-pipeline-py'],
  'backend-rust': ['rust-http', 'agent-service-rust', 'wasm-rust'],
  'backend-go': ['go-net-http', 'go-worker'],
  'mobile': ['expo-react-native-ts', 'expo-rn-rich', 'flutter-app', 'kotlin-multiplatform'],
  'desktop': ['electron-desktop-ts', 'electron-native-os', 'tauri-desktop', 'tauri-menubar', 'tauri-tray'],
  'smart-contracts': ['hardhat-ts', 'forge-foundation', 'solana-native-rust', 'aptos-move', 'move-package', 'fhenix-contracts', 'fhevm-contracts', 'stylus-contracts', 'tangle-blueprint', 'eigenlayer-avs', 'celestia-da'],
  'gpu-inference': ['ollama-server', 'tgi-server', 'vllm-server', 'sglang-server', 'triton-server', 'skypilot-serving', 'lora-training', 'webgpu-inference', 'webgpu-render'],
  'games': ['threejs-game', 'phaser-game', 'pixijs-game', 'bevy-web', 'godot-web', 'unity-web-proxy'],
  'av-realtime': ['livekit-sfu', 'hls-origin', 'realtime-audio-ts', 'voice-first-agent', 'vision-first-agent', 'multimodal-agent', 'x402-service'],
  'verticals': ['healthcare-hipaa-backend', 'fintech-ledger-backend', 'legal-case-mgmt', 'k12-edtech', 'crm-backend', 'ecommerce-headless', 'hipaa-compliance-pack', 'pci-dss-compliance-pack', 'soc2-compliance-pack', 'gdpr-compliance-pack'],
}

// Load family appliesTo → industry + partner relationships.
const familyRuntimes = {}
for (const [runtime, families] of Object.entries(runtimes)) {
  for (const f of families) familyRuntimes[f] = runtime
}

// Industry × runtime coverage: does at least one industry layer apply
// to at least one family in this runtime bucket?
const industryRuntimeCells = {}
for (const industry of industries) {
  const manifest = readJson(join(REPO, 'registry/layers/industry', industry, 'manifest.json'))
  if (!manifest) continue
  industryRuntimeCells[industry] ??= {}
  for (const [runtime, families] of Object.entries(runtimes)) {
    const overlap = (manifest.appliesTo ?? []).filter((f) => families.includes(f))
    industryRuntimeCells[industry][runtime] = overlap.length
  }
}

// Industry × partner: a partner covers an industry when there's at least
// one family F with F ∈ partner.appliesTo AND F ∈ industry.appliesTo.
// The cell value is the size of that intersection — higher = more
// compose-paths where the partner can actually layer onto the industry.
// (Previously this block was a no-op and emitted an all-zero matrix.)
const industryPartnerCells = {}
const industryAppliesTo = {}
for (const industry of industries) {
  const manifest = readJson(join(REPO, 'registry/layers/industry', industry, 'manifest.json'))
  industryAppliesTo[industry] = new Set(manifest?.appliesTo ?? [])
}
for (const industry of industries) {
  industryPartnerCells[industry] = {}
  const iFamilies = industryAppliesTo[industry]
  for (const partner of partners) {
    const manifest = readJson(join(REPO, 'registry/partners', partner, 'manifest.json'))
    const pFamilies = manifest?.appliesTo ?? []
    let overlap = 0
    for (const f of pFamilies) if (iFamilies.has(f)) overlap += 1
    industryPartnerCells[industry][partner] = overlap
  }
}

// Report
const report = {
  generatedAt: new Date().toISOString(),
  industries,
  partners,
  runtimes: Object.keys(runtimes),
  industryRuntime: industryRuntimeCells,
  industryPartner: industryPartnerCells,
  gaps: [],
}

// Surface gaps: industry × runtime pairs with 0 overlap.
for (const industry of industries) {
  for (const runtime of Object.keys(runtimes)) {
    if ((industryRuntimeCells[industry]?.[runtime] ?? 0) === 0) {
      report.gaps.push({ industry, runtime, kind: 'industry-runtime' })
    }
  }
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(report, null, 2))

// ASCII table (industry × runtime).
const cellW = 6
const runtimeKeys = Object.keys(runtimes)
const header = 'industry'.padEnd(18) + runtimeKeys.map((k) => k.slice(0, cellW - 1).padStart(cellW)).join('')
console.log('\nCoverage heatmap: industry × runtime (value = # of families that apply)\n')
console.log(header)
console.log('─'.repeat(header.length))
for (const industry of industries) {
  let line = industry.padEnd(18)
  for (const runtime of runtimeKeys) {
    const n = industryRuntimeCells[industry]?.[runtime] ?? 0
    line += String(n || '·').padStart(cellW)
  }
  console.log(line)
}

console.log(
  `\ntotal gaps (industry × runtime pairs with 0 coverage): ${report.gaps.length}`,
)
console.log(`wrote: ${OUT}`)
