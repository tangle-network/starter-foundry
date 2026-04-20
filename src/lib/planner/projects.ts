// Per-lane project builders. Each build*Project function takes a prompt and
// partner, picks the right family + layers + slots, and returns a ProjectEntry
// ready to slot into a workspace spec.
//
// Family choice is driven by chooseApiFamily / chooseWorkerFamily (which also
// lives here since the choice is a project-builder concern). Contract-lane
// builders live in ./contracts.ts alongside the agent-family selection.

import { detectCapabilities, detectLane, hasAny } from '../keywords.js'
import type { Registry } from '../../types.js'
import type { ProjectEntry } from '../../types.js'
import {
  detectAuthSlot,
  detectDatabaseSlot,
  detectEvmSupportApiPattern,
  detectPaymentsSlot,
  detectQueueSlot,
  detectSdkSlot,
} from './detectors.js'
import { chooseAgentFamily } from './contracts.js'
import { buildSlug, resolvePartnerForFamily } from './helpers.js'
import { inferImplicitCapabilities } from './implicit-caps.js'

export interface FamilyChoice {
  family: string
  layers: string[]
  path: string
  variables?: Record<string, string>
}

export function buildWebProject(
  prompt: string,
  partner: string | null,
  text: string,
  registry?: Registry,
): ProjectEntry {
  // WASM-Rust fronts take precedence over React/Next when the prompt
  // specifically asks for Rust-in-browser compute.
  if (hasAny(text, ['wasm-bindgen', 'wasm-pack', 'rust wasm', 'rust in browser', 'webassembly rust', 'browser wasm'])) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'wasm-rust',
        layers: ['framework:wasm-rust'],
        partner: resolvePartnerForFamily(partner, 'wasm-rust'),
        slots: {},
        variables: {
          headline: 'Rust + WASM in your browser',
          subheadline: 'Native-speed compute shipped as a 20-line call from the frontend.',
        },
        primaryArtifactTargetMs: 3500,
      },
    }
  }

  const isNext = hasAny(text, ['next', 'next.js', 'nextjs', 'app router', 'seo'])
  const family = isNext ? 'nextjs-ts' : 'react-vite-ts'
  const frameworkLayer = isNext ? 'framework:nextjs-app-router' : 'framework:react-vite-ts'
  const layers = [frameworkLayer]

  if (hasAny(text, ['dashboard', 'metrics', 'analytics', 'control plane', 'admin'])) {
    layers.push('capability:chart-widget')
  }

  const slots: Record<string, string> = {}
  const sdkSlot = detectSdkSlot(text, partner)
  const authSlot = detectAuthSlot(text)
  const paymentsSlot = detectPaymentsSlot(text)
  if (authSlot) slots['auth'] = authSlot
  if (paymentsSlot) slots['payments'] = paymentsSlot
  if (sdkSlot) slots['sdk'] = sdkSlot

  const webCapabilities = registry ? detectCapabilities(text, family, registry) : []
  if (webCapabilities.length > 0) layers.push(...webCapabilities)

  const implicit = inferImplicitCapabilities(text, family, new Set(layers))
  if (implicit.length > 0) layers.push(...implicit)

  // Force-attach tailwind + shadcn on every React family web project, same as
  // the starter path does. Without this, workspace scaffolds (UI + contracts)
  // lose the UI capability attachments agents then install manually —
  // visible in .evolve/capability-gaps.json as shadcn missed 20× / tailwind 14×.
  if (!layers.includes('capability:tailwind')) layers.push('capability:tailwind')
  if (!layers.includes('capability:shadcn')) layers.push('capability:shadcn')

  return {
    id: 'web',
    path: 'apps/web',
    spec: {
      projectName: `${buildSlug(prompt, 'workspace')}-web`,
      family,
      layers: [...new Set(layers)],
      partner: resolvePartnerForFamily(partner, family),
      slots,
      variables: {
        headline: 'Ship the primary product surface first',
        subheadline:
          'This workspace starts with the user-visible surface before deepening the backend and contract lanes.',
      },
      primaryArtifactTargetMs: 2500,
    },
  }
}

export function chooseWorkerFamily(text: string): FamilyChoice {
  if (hasAny(text, ['playwright', 'browser automation', 'web scraping', 'scraper', 'crawler'])) {
    return { family: 'playwright-worker', layers: ['framework:playwright-worker'], path: 'apps/worker' }
  }

  if (hasAny(text, ['go worker', 'golang worker', 'go cron', 'go queue', 'go background job'])) {
    return { family: 'go-worker', layers: ['framework:go-worker'], path: 'apps/worker' }
  }

  if (hasAny(text, ['python worker', 'python cron', 'python queue', 'python background job', 'celery', 'python task'])) {
    return { family: 'python-worker', layers: ['framework:python-worker'], path: 'apps/worker' }
  }

  if (detectLane(text, 'agent') && hasAny(text, ['worker', 'background', 'cron', 'queue', 'runner', 'executor'])) {
    return { family: 'worker-job', layers: ['framework:node-worker'], path: 'apps/worker' }
  }

  const layers = ['framework:node-worker']
  if (hasAny(text, ['trading', 'market', 'feed', 'stream'])) {
    layers.push('capability:market-sim')
  }

  return { family: 'worker-job', layers, path: 'apps/worker' }
}

export function chooseApiFamily(text: string): FamilyChoice {
  if (detectLane(text, 'x402')) return { family: 'x402-service', layers: ['framework:x402-service'], path: 'apps/api' }
  if (detectLane(text, 'mcp')) return { family: 'mcp-server-ts', layers: ['framework:mcp-server-ts'], path: 'apps/mcp' }
  if (detectLane(text, 'dspy')) return { family: 'dspy-pipeline-py', layers: ['framework:dspy-pipeline-py'], path: 'apps/ai' }
  // Multi-agent swarm — supervisor/worker orchestration. agent-swarm-ts is
  // TypeScript-only (LangGraph-JS). Python swarms (CrewAI, AutoGen) must fall
  // through to chooseAgentFamily which picks agent-service-py. Gate on the
  // absence of a Python language hint so 'Python CrewAI' prompts keep routing
  // to the Python agent family. Preserves held-out id=ho-python-crewai.
  const swarmSignals = hasAny(text, ['multi-agent', 'agent swarm', 'supervisor agent', 'agent orchestration', 'crewai', 'agent handoff', 'specialist agents', 'agent team', 'role-based agents'])
  const isPythonHint = hasAny(text, ['python', 'pydanticai', 'autogen', 'agno', 'llamaindex', 'unsloth', 'qlora'])
  if (swarmSignals && !isPythonHint) {
    return { family: 'agent-swarm-ts', layers: ['framework:agent-swarm-ts'], path: 'apps/swarm' }
  }
  if (detectLane(text, 'agent')) return chooseAgentFamily(text)
  if (detectLane(text, 'zk')) return { family: 'zk-prover-service', layers: ['framework:zk-prover-service'], path: 'apps/prover' }
  if (detectLane(text, 'evm-infra')) return { family: 'evm-infra-ts', layers: ['framework:evm-infra-ts'], path: 'apps/api' }

  if (hasAny(text, ['cloudflare', 'durable object', 'edge api', 'edge function', 'hono edge'])) {
    return { family: 'cloudflare-worker-ts', layers: ['framework:cloudflare-worker-ts'], path: 'apps/edge' }
  }
  // Bun must be checked before the generic Node path below. "bun" alone is a
  // stronger signal than the fuzzier Node defaults.
  if (hasAny(text, ['bun', 'bun.serve', 'bun runtime', 'bun api', 'bun http', 'bun.js'])) {
    return { family: 'bun-http', layers: ['framework:bun-http'], path: 'apps/api' }
  }
  if (hasAny(text, ['deno', 'deno.serve', 'deno runtime', 'deno deploy', 'deno edge'])) {
    return { family: 'deno-edge', layers: ['framework:deno-edge'], path: 'apps/api' }
  }
  // LLM inference server — vLLM / self-hosted model serving / OpenAI-compatible.
  // Must come before python-api so prompts about "python llm inference server"
  // route to vllm-server instead of the generic python HTTP path.
  if (hasAny(text, ['vllm', 'llm inference server', 'llm serving', 'self-hosted llm', 'model serving', 'serve llama', 'openai-compatible api', 'paged attention', 'gpu inference', 'inference server'])) {
    return { family: 'vllm-server', layers: ['framework:vllm-server'], path: 'apps/inference' }
  }
  if (hasAny(text, ['rust', 'cargo', 'axum', 'rust api', 'rust backend'])) {
    return { family: 'rust-service', layers: ['framework:rust-http'], path: 'apps/api' }
  }
  if (hasAny(text, ['python', 'fastapi', 'flask', 'django', 'python api'])) {
    return { family: 'python-api', layers: ['framework:python-http'], path: 'apps/api' }
  }
  if (hasAny(text, ['golang', 'go api', 'go backend', 'go service', 'net/http'])) {
    return { family: 'go-api', layers: ['framework:go-net-http'], path: 'apps/api' }
  }

  return { family: 'api-service', layers: ['framework:node-http', 'capability:logging'], path: 'apps/api' }
}

export function buildApiProject(
  prompt: string,
  partner: string | null,
  text: string,
  registry?: Registry,
): ProjectEntry {
  const choice = chooseApiFamily(text)
  const layers = [...choice.layers]
  const slots: Record<string, string> = {}
  const databaseSlot = detectDatabaseSlot(text)
  const sdkSlot = detectSdkSlot(text, partner)
  const authSlot = detectAuthSlot(text)
  const paymentsSlot = detectPaymentsSlot(text)
  const queueSlot = detectQueueSlot(text)

  if (databaseSlot) slots['database'] = databaseSlot
  if (authSlot) slots['auth'] = authSlot
  if (paymentsSlot) slots['payments'] = paymentsSlot
  if (queueSlot) slots['queue'] = queueSlot
  if (sdkSlot) slots['sdk'] = sdkSlot

  if ((choice.family === 'api-service' || choice.family === 'evm-infra-ts') && detectEvmSupportApiPattern(text)) {
    layers.push('capability:evm-protocol-api')
  }

  if (choice.family === 'evm-infra-ts') {
    if (hasAny(text, ['block monitor', 'new blocks', 'gas price', 'tps', '/stats'])) {
      layers.push('capability:evm-chain-monitor')
    } else if (hasAny(text, ['wallet balance', 'wallet address', 'multicall', 'summary table'])) {
      layers.push('capability:evm-wallet-dashboard')
    }
  }

  const apiCapabilities = registry ? detectCapabilities(text, choice.family, registry) : []
  if (apiCapabilities.length > 0) layers.push(...apiCapabilities)

  return {
    id: choice.family.startsWith('agent-service-') ? 'agent' : 'api',
    path: choice.path,
    spec: {
      projectName: `${buildSlug(prompt, 'workspace')}-api`,
      family: choice.family,
      layers: [...new Set(layers)],
      partner: resolvePartnerForFamily(partner, choice.family),
      slots,
      variables: choice.variables ?? {},
      primaryArtifactTargetMs: 2500,
    },
  }
}

export function buildWorkerProject(prompt: string, partner: string | null, text: string): ProjectEntry {
  const choice = chooseWorkerFamily(text)
  const layers = [...choice.layers]
  const slots: Record<string, string> = {}
  const queueSlot = detectQueueSlot(text)
  if (queueSlot) slots['queue'] = queueSlot

  if (choice.family === 'worker-job' && hasAny(text, ['solana', 'anchor', 'pyth', 'switchboard', 'keeper', 'liquidation'])) {
    layers.push('capability:solana-keeper')
  }

  return {
    id: 'worker',
    path: choice.path,
    spec: {
      projectName: `${buildSlug(prompt, 'workspace')}-worker`,
      family: choice.family,
      layers,
      partner: resolvePartnerForFamily(partner, choice.family),
      slots,
      variables: {
        workerName: partner ? `${partner} worker lane` : 'workspace worker lane',
      },
      primaryArtifactTargetMs: 2500,
    },
  }
}
