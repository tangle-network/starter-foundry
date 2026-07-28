/**
 * Workspace detection tests — verifies lane detection, workspace vs starter
 * decisions, and project assembly for multi-lane prompts.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { planPrompt } from '../dist/lib/prompt-planner.js'

// --- Single-surface prompts should NOT become workspaces ---

const SINGLE_SURFACE_PROMPTS = [
  { prompt: 'Build an Expo React Native wallet app', family: 'expo-react-native-ts' },
  { prompt: 'Build a Chrome extension for price alerts', family: 'browser-extension-ts' },
  { prompt: 'Build an Electron desktop trading terminal', family: 'electron-desktop-ts' },
  { prompt: 'Build a Tauri desktop app for file management', family: 'tauri-desktop' },
  { prompt: 'Build a CLI tool for deploying contracts', family: 'cli-ts' },
  { prompt: 'Build a Streamlit analytics dashboard for DeFi', family: 'python-data-app' },
]

for (const { prompt, family } of SINGLE_SURFACE_PROMPTS) {
  test(`single surface: "${prompt.slice(0, 50)}" → starter (${family})`, async () => {
    const result = await planPrompt({ prompt, partner: null })
    assert.equal(result.kind, 'starter', `Expected starter for "${prompt}", got ${result.kind}`)
    assert.equal(result.spec.family, family)
  })
}

// --- Plain protocol prompts should NOT become workspaces ---

const PLAIN_PROTOCOL_PROMPTS = [
  { prompt: 'Build a Tangle Blueprint for oracle data', family: 'tangle-blueprint' },
  { prompt: 'Build an EigenLayer AVS for data availability', family: 'eigenlayer-avs' },
  { prompt: 'Build a RISC Zero ZK prover service', family: 'zk-prover-service' },
  { prompt: 'Build an MCP server for database tools', family: 'mcp-server-ts' },
  { prompt: 'Build a DSPy text classification pipeline', family: 'dspy-pipeline-py' },
  { prompt: 'Build an x402 pay-per-request API', family: 'x402-service' },
  { prompt: 'Build an Arbitrum Stylus Rust contract', family: 'stylus-contracts' },
]

for (const { prompt, family } of PLAIN_PROTOCOL_PROMPTS) {
  test(`plain protocol: "${prompt.slice(0, 50)}" → starter (${family})`, async () => {
    const result = await planPrompt({ prompt, partner: null })
    assert.equal(result.kind, 'starter', `Expected starter for "${prompt}", got ${result.kind}`)
    assert.equal(result.spec.family, family)
  })
}

// --- Plain agent prompts should NOT become workspaces ---

test('plain agent prompt → starter, not workspace', async () => {
  const result = await planPrompt({ prompt: 'Build an AI agent that reviews PRs', partner: null })
  assert.equal(result.kind, 'starter')
  assert.equal(result.spec.family, 'agent-service-ts')
})

test('plain Python agent → starter', async () => {
  const result = await planPrompt({ prompt: 'Build a PydanticAI research agent', partner: null })
  assert.equal(result.kind, 'starter')
  assert.equal(result.spec.family, 'agent-service-py')
})

// --- Fullstack prompts should stay as single starters ---

const FULLSTACK_PROMPTS = [
  'Build a fullstack SaaS admin dashboard with API',
  'Build a SaaS platform with billing and database',
  'Build an admin panel with CRUD operations and REST API',
]

for (const prompt of FULLSTACK_PROMPTS) {
  test(`fullstack: "${prompt.slice(0, 50)}" → starter (fullstack-ts)`, async () => {
    const result = await planPrompt({ prompt, partner: null })
    assert.equal(result.kind, 'starter', `Expected starter for "${prompt}", got ${result.kind}`)
    assert.equal(result.spec.family, 'fullstack-ts')
  })
}

// --- Multi-lane prompts SHOULD become workspaces ---

test('frontend + EVM contract → workspace with web + evm', async () => {
  const result = await planPrompt({
    prompt: 'Build a DeFi lending dapp with React frontend and Solidity contracts',
    partner: null,
  })
  assert.equal(result.kind, 'workspace')
  assert.ok(result.spec.projects.some((p) => p.id === 'web'))
  assert.ok(result.spec.projects.some((p) => p.id === 'evm'))
})

test('frontend + Solana program → workspace', async () => {
  const result = await planPrompt({
    prompt: 'Build a Solana NFT marketplace with React frontend and Anchor program',
    partner: null,
  })
  assert.equal(result.kind, 'workspace')
  assert.ok(result.spec.projects.some((p) => p.id === 'web'))
  assert.ok(result.spec.projects.some((p) => p.id === 'solana'))
})

test('frontend + tangle blueprint → workspace', async () => {
  const result = await planPrompt({
    prompt: 'Build a dashboard UI for a Tangle oracle blueprint',
    partner: null,
  })
  assert.equal(result.kind, 'workspace')
  assert.ok(result.spec.projects.some((p) => p.id === 'web'))
  assert.ok(result.spec.projects.some((p) => p.id === 'tangle'))
})

test('frontend + agent → workspace', async () => {
  const result = await planPrompt({
    prompt: 'Build a chat UI with a RAG agent backend',
    partner: null,
  })
  assert.equal(result.kind, 'workspace')
  assert.ok(result.spec.projects.some((p) => p.id === 'web'))
  assert.ok(result.spec.projects.some((p) => p.spec.family.startsWith('agent-service')))
})

test('frontend + API + worker → workspace with 3 projects', async () => {
  const result = await planPrompt({
    prompt:
      'Build a trading platform with React dashboard, Node.js API backend, and a background worker for market streams',
    partner: null,
  })
  assert.equal(result.kind, 'workspace')
  assert.ok(result.spec.projects.some((p) => p.id === 'web'))
  assert.ok(result.spec.projects.some((p) => p.id === 'api' || p.spec.family === 'api-service'))
  assert.ok(result.spec.projects.some((p) => p.id === 'worker'))
})

test('EVM + Solana multichain → workspace', async () => {
  const result = await planPrompt({
    prompt:
      'Build a cross-chain bridge with Solidity contracts on Ethereum and an Anchor program on Solana with a React frontend',
    partner: null,
  })
  assert.equal(result.kind, 'workspace')
  assert.ok(result.spec.projects.some((p) => p.id === 'evm'))
  assert.ok(result.spec.projects.some((p) => p.id === 'solana'))
  assert.ok(result.spec.projects.some((p) => p.id === 'web'))
})

// --- Workspace project structure ---

test('workspace primary project defaults to web when frontend exists', async () => {
  const result = await planPrompt({
    prompt: 'Build a React dashboard with a Foundry ERC20 contract',
    partner: null,
  })
  assert.equal(result.kind, 'workspace')
  const lp1 = result.spec.launchPlan
  assert.ok(lp1, 'launchPlan should exist')
  assert.equal(lp1.primaryProjectId, 'web')
  assert.equal(lp1.primaryArtifact?.kind, 'preview')
})

test('workspace without frontend uses first project as primary', async () => {
  const result = await planPrompt({
    prompt:
      'Build a workspace with a Node.js API backend and a trading bot worker with market streams',
    partner: null,
  })
  assert.equal(result.kind, 'workspace')
  const lp2 = result.spec.launchPlan
  assert.ok(lp2, 'launchPlan should exist')
  assert.notEqual(lp2.primaryArtifact?.kind, 'preview')
})

// --- Partner resolution in workspaces ---

test('coinbase partner propagates to workspace projects', async () => {
  const result = await planPrompt({
    prompt: 'Build a Coinbase dapp with React frontend and Foundry contracts',
    partner: 'coinbase',
  })
  assert.equal(result.kind, 'workspace')
  const web = result.spec.projects.find((p) => p.id === 'web')
  assert.equal(web?.spec.partner, 'coinbase')
})

// --- Framework API false positive ---

test('Vue Composition API does not trigger workspace', async () => {
  const result = await planPrompt({
    prompt: 'Build a Vue 3 app with Composition API',
    partner: null,
  })
  assert.equal(result.kind, 'starter')
  assert.equal(result.spec.family, 'vue-ts')
})

// --- Bot vs agent disambiguation ---

test("'slack bot' alone routes to agent starter, not workspace with worker", async () => {
  const result = await planPrompt({
    prompt: 'Build a Slack bot that answers questions using AI',
    partner: null,
  })
  assert.equal(result.kind, 'starter')
  assert.equal(result.spec.family, 'agent-service-ts')
})

// --- Implicit API detection ---

test('EVM contract + indexer keywords triggers implicit API project', async () => {
  const result = await planPrompt({
    prompt: 'Build Foundry smart contracts with an event indexer and analytics dashboard',
    partner: null,
  })
  assert.equal(result.kind, 'workspace')
  assert.ok(result.spec.projects.some((p) => p.id === 'web'))
  assert.ok(
    result.spec.projects.some((p) => p.id === 'api' || p.spec.family === 'api-service'),
    'Should have implicit API project for indexer',
  )
})
