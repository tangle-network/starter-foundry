// Small helpers shared across the planner modules. Kept separate so builders
// can import them without pulling in prompt-planner's full routing pipeline.

import { sanitizePackageName } from '../fs.js'

export function buildSlug(prompt: string, fallback: string): string {
  const slug = sanitizePackageName(prompt).slice(0, 40)
  return slug || fallback
}

// Restrict a partner attachment to family sets where the partner has actual
// capability layers. Without this, a Tangle partner would propagate to a
// forge-contracts project (which has no Tangle-specific layers), inflating the
// archetype without adding value.
export function resolvePartnerForFamily(partner: string | null, family: string): string | null {
  if (!partner) {
    return null
  }

  const familySets: Record<string, Set<string>> = {
    coinbase: new Set([
      'frontend-static',
      'react-vite-ts',
      'nextjs-ts',
      'fullstack-ts',
      'expo-react-native-ts',
      'browser-extension-ts',
      'electron-desktop-ts',
      'tauri-desktop',
      'api-service',
      'cloudflare-worker-ts',
      'python-api',
      'rust-service',
      'go-api',
      'worker-job',
      'go-worker',
      'playwright-worker',
      'evm-infra-ts',
      'agent-service-ts',
      'agent-service-py',
      'forge-contracts',
      'hardhat-contracts',
    ]),
    tangle: new Set([
      'frontend-static',
      'react-vite-ts',
      'nextjs-ts',
      'fullstack-ts',
      'api-service',
      'python-api',
      'rust-service',
      'go-api',
      'worker-job',
      'go-worker',
      'playwright-worker',
      'evm-infra-ts',
      'agent-service-ts',
      'agent-service-py',
      'agent-service-rust',
      'tangle-blueprint',
    ]),
    eigenlayer: new Set([
      'frontend-static',
      'react-vite-ts',
      'nextjs-ts',
      'fullstack-ts',
      'api-service',
      'python-api',
      'rust-service',
      'go-api',
      'worker-job',
      'go-worker',
      'playwright-worker',
      'evm-infra-ts',
      'agent-service-ts',
      'agent-service-py',
      'agent-service-rust',
      'eigenlayer-avs',
    ]),
    arbitrum: new Set([
      'frontend-static',
      'react-vite-ts',
      'nextjs-ts',
      'fullstack-ts',
      'api-service',
      'python-api',
      'rust-service',
      'go-api',
      'worker-job',
      'go-worker',
      'playwright-worker',
      'evm-infra-ts',
      'agent-service-ts',
      'agent-service-py',
      'agent-service-rust',
      'forge-contracts',
      'hardhat-contracts',
      'stylus-contracts',
    ]),
    xlayer: new Set([
      'frontend-static',
      'react-vite-ts',
      'nextjs-ts',
      'fullstack-ts',
      'api-service',
      'python-api',
      'rust-service',
      'go-api',
      'worker-job',
      'go-worker',
      'playwright-worker',
      'evm-infra-ts',
      'agent-service-ts',
      'agent-service-py',
      'agent-service-rust',
      'forge-contracts',
      'hardhat-contracts',
    ]),
    solana: new Set([
      'frontend-static',
      'react-vite-ts',
      'nextjs-ts',
      'fullstack-ts',
      'api-service',
      'python-api',
      'rust-service',
      'go-api',
      'worker-job',
      'go-worker',
      'playwright-worker',
      'agent-service-ts',
      'agent-service-py',
      'agent-service-rust',
      'solana-program',
    ]),
  }

  return familySets[partner]?.has(family) ? partner : null
}
