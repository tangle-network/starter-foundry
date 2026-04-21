// Every JS/TS-producing family must ship a vite override block as
// defense-in-depth against transitive CVEs (blueprint-agent bug report
// 2026-04-20, finding #1). The only way an agent-extended scaffold
// regresses to an unpatched vite minor is if neither the direct dep nor
// the overrides block pins it.

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const FAMILIES_DIR = 'registry/families'
const VITE_PIN_RE = /^\^?\d+\.\d+\.\d+/

// Rust/Go/Python families don't have a package.json frontend surface; skip.
// forge-foundation and the agent-service-py/rust/stylus variants ship no
// package.json or a tiny {"scripts": {...}} that pnpm never installs.
const SKIP_WHEN_NO_NODE_DEPS = new Set([
  'forge-foundation',
  'python-data-app',
  'python-http',
  'python-worker',
  'go-net-http',
  'go-worker',
  'rust-http',
  'solana-native-rust',
  'stylus-contracts',
  'fhenix-contracts',
  'fhevm-contracts',
  'tangle-blueprint',
  'eigenlayer-avs',
  'ollama-server',
  // Binary-driven SSGs (Hugo, Zola) — no package.json ship.
  'hugo-static',
  'zola-static',
  // Python-based families (already skipped by the no-pkg-json rule,
  // but listed here for explicit intent in case they later ship
  // package.json-based tooling).
  'jupyter-book',
  'streamlit-advanced',
  'rag-pipeline-py',
  'tgi-server',
  'sglang-server',
  'triton-server',
  'skypilot-serving',
  'lora-training',
  // Infra / non-Vite families.
  'livekit-sfu',
  'hls-origin',
  'celestia-da',
  'aptos-move',
  // Rust/native game engines.
  'bevy-web',
  'godot-web',
  // Native desktop variants — Tauri / Electron own their own build chain.
  'tauri-menubar',
  'tauri-tray',
  'electron-native-os',
  // Expo has its own metro build; no vite.
  'expo-rn-rich',
  // Non-JS mobile / embedded / robotics families.
  'flutter-app',
  'kotlin-multiplatform',
  'esp32-rust',
  'stm32-rust',
  'ros2-node-py',
  // Compliance packs — library-only, no Vite.
  'hipaa-compliance-pack',
  'soc2-compliance-pack',
  'pci-dss-compliance-pack',
  'gdpr-compliance-pack',
])

function hasVitePin(pkg: Record<string, unknown>): boolean {
  const direct = (pkg.dependencies as Record<string, string> | undefined)?.vite
  const dev = (pkg.devDependencies as Record<string, string> | undefined)?.vite
  const ov = (pkg.overrides as Record<string, string> | undefined)?.vite
  const pov = (pkg.pnpm as { overrides?: Record<string, string> } | undefined)?.overrides?.vite
  return [direct, dev, ov, pov].some((v) => typeof v === 'string' && VITE_PIN_RE.test(v))
}

test('every JS-family package.json template pins vite (direct or overrides)', () => {
  const families = readdirSync(FAMILIES_DIR)
  const missing: string[] = []
  for (const family of families) {
    if (SKIP_WHEN_NO_NODE_DEPS.has(family)) continue
    const pkgPath = join(FAMILIES_DIR, family, 'files', 'package.json')
    if (!existsSync(pkgPath)) continue
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>
    // Families that declare no dependencies at all have nothing to defend against.
    const hasAnyDeps =
      pkg.dependencies ||
      pkg.devDependencies ||
      pkg.overrides ||
      (pkg as { pnpm?: unknown }).pnpm
    if (!hasAnyDeps) continue
    if (!hasVitePin(pkg)) missing.push(family)
  }
  assert.deepEqual(missing, [], `families missing a vite pin (defense-in-depth gap — blueprint-agent report #1):\n  ${missing.join('\n  ')}`)
})
