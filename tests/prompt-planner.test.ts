import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { createTempDir, removeDir, writeJson } from '../dist/lib/fs.js'
import { runPromptCorpus } from '../dist/lib/prompt-e2e.js'
import { planPrompt } from '../dist/lib/prompt-planner.js'
import { runProofSuite } from '../dist/lib/eval/prove.js'
import type { ProofReport } from '../dist/lib/eval/prove.js'

test('planPrompt routes simple prompts to starter families', async () => {
  const result = await planPrompt({
    prompt: 'Build a Golang API risk engine with Postgres and Coinbase CDP support.',
    partner: 'coinbase',
  })

  assert.equal(result.kind, 'starter')
  assert.equal(result.spec.family, 'go-api')
  assert.equal(result.spec.slots!.database, 'database:postgres')
  assert.equal(result.spec.slots!.sdk, 'sdk:coinbase-cdp')
})

test('planPrompt routes coinbase ecommerce prompt to a web plus api workspace', async () => {
  const result = await planPrompt({
    prompt: `Create a Web3 e-commerce store using Coinbase Wallet SDK and Commerce API.

Tech Stack:
- Frontend: Vite + React + TypeScript
- Backend: Node.js + Express + PostgreSQL`,
    partner: 'coinbase',
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'web')?.spec.family,
    'react-vite-ts',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'api')?.spec.family,
    'api-service',
  )
})

test('planPrompt routes multiruntime prompts to workspaces', async () => {
  const result = await planPrompt({
    prompt: 'Build a frontend product app with a Foundry treasury contract and a fast preview.',
    partner: 'coinbase',
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(result.spec.launchPlan!.primaryProjectId, 'web')
  assert.ok(result.spec.projects.some((project) => project.id === 'web'))
  assert.ok(result.spec.projects.some((project) => project.id === 'evm'))
})

test('planPrompt routes tangle prompts with ui to a web plus blueprint workspace', async () => {
  const result = await planPrompt({
    prompt:
      'Build a decentralized storage service Blueprint for Tangle Network with a dashboard for file management.',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'web')?.spec.family,
    'react-vite-ts',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'tangle')?.spec.family,
    'tangle-blueprint',
  )
})

test('planPrompt routes x402 agent prompts to a worker plus x402 workspace', async () => {
  const result = await planPrompt({
    prompt:
      'Create an AI agent that can autonomously pay for premium HTTP services using the x402 payment protocol.',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'worker')?.spec.family,
    'worker-job',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'api')?.spec.family,
    'x402-service',
  )
})

test('planPrompt keeps x402-specific api lanes ahead of generic evm infra routing', async () => {
  const result = await planPrompt({
    prompt:
      'Create an AI agent using the x402 payment protocol with viem signing, automatic 402 retries, and a Node.js backend.',
    partner: 'coinbase',
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'api')?.spec.family,
    'x402-service',
  )
})

test('planPrompt routes ethereum protocol prompts to a web plus evm workspace', async () => {
  const result = await planPrompt({
    prompt:
      'Build a decentralized lending protocol on Ethereum with LendingPool contracts and a Vite + React supply/borrow interface.',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'web')?.spec.family,
    'react-vite-ts',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'evm')?.spec.family,
    'forge-contracts',
  )
})

test('planPrompt adds an api lane for evm protocol prompts that imply backend seams', async () => {
  const result = await planPrompt({
    prompt:
      'Build a Next.js liquid staking app on Ethereum with Foundry contracts, an indexer API, and wallet onboarding.',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'web')?.spec.family,
    'nextjs-ts',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'api')?.spec.family,
    'api-service',
  )
  assert.ok(
    result.spec.projects
      .find((project) => project.id === 'api')
      ?.spec.layers!.includes('capability:evm-protocol-api'),
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'evm')?.spec.family,
    'forge-contracts',
  )
})

test('planPrompt routes broad tangle prompts to a blueprint workspace', async () => {
  const result = await planPrompt({
    prompt:
      "Build a threshold signature custody solution using Tangle's native MPC capabilities with a React dashboard and API endpoints.",
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'tangle')?.spec.family,
    'tangle-blueprint',
  )
  assert.ok(
    result.spec.projects
      .find((project) => project.id === 'tangle')
      ?.spec.layers!.includes('capability:tangle-custody'),
  )
})

test('planPrompt routes xlayer infra prompts to the evm infra starter', async () => {
  const result = await planPrompt({
    prompt:
      'Build a Node/TypeScript service that monitors X Layer via WebSocket and exposes a /stats JSON endpoint.',
    partner: null,
  })

  assert.equal(result.kind, 'starter')
  assert.equal(result.spec.family, 'evm-infra-ts')
  assert.equal(result.spec.partner, 'xlayer')
  assert.ok(result.spec.layers!.includes('capability:evm-chain-monitor'))
})

test('planPrompt routes explicit hardhat config prompts to the hardhat starter', async () => {
  const result = await planPrompt({
    prompt:
      'Create a Hardhat TypeScript project configured for X Layer, add network config, contract verification, and a deploy task for an ERC20 sample contract.',
    partner: null,
  })

  assert.equal(result.kind, 'starter')
  assert.equal(result.spec.family, 'hardhat-contracts')
  assert.equal(result.spec.partner, 'xlayer')
})

test('planPrompt routes xlayer foundry deploy prompts to forge with deploy scaffolding', async () => {
  const result = await planPrompt({
    prompt:
      'Scaffold a Foundry project targeting X Layer, configure foundry.toml, include a deploy script reading PRIVATE_KEY, and set up OKLink verification.',
    partner: null,
  })

  assert.equal(result.kind, 'starter')
  assert.equal(result.spec.family, 'forge-contracts')
  assert.equal(result.spec.partner, 'xlayer')
  assert.ok(result.spec.layers!.includes('capability:evm-deploy-foundry'))
})

test('planPrompt routes xlayer account abstraction prompts to an api plus evm workspace', async () => {
  const result = await planPrompt({
    prompt:
      'Scaffold a Foundry ERC721 collection on X Layer, then add a TypeScript minting client using permissionless.js and viem that sends a gasless mint through an ERC-4337 bundler.',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'api')?.spec.family,
    'evm-infra-ts',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'evm')?.spec.family,
    'forge-contracts',
  )
  assert.ok(
    result.spec.projects
      .find((project) => project.id === 'evm')
      ?.spec.layers!.includes('capability:evm-account-abstraction'),
  )
})

test('planPrompt routes layerzero oft prompts to an api plus evm workspace', async () => {
  const result = await planPrompt({
    prompt:
      'Create a Hardhat TypeScript project that deploys a LayerZero OFT on X Layer with a sendTokens bridge script and PRIVATE_KEY env setup.',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'api')?.spec.family,
    'evm-infra-ts',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'evm')?.spec.family,
    'hardhat-contracts',
  )
  assert.ok(
    result.spec.projects
      .find((project) => project.id === 'evm')
      ?.spec.layers!.includes('framework:hardhat-ts'),
  )
})

test('planPrompt uses domain-pack metadata for Fhenix Foundry contract workspaces', async () => {
  const result = await planPrompt({
    prompt:
      'Build a React dashboard plus a Fhenix Foundry Solidity contract for a sealed-bid auction using CoFHE encrypted bids.',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'web')?.spec.family,
    'react-vite-ts',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'evm')?.spec.family,
    'fhenix-foundry',
  )
  assert.ok(
    result.spec.projects
      .find((project) => project.id === 'evm')
      ?.spec.layers!.includes('framework:fhenix-foundry'),
  )
})

test('planPrompt infers coinbase partner when not provided', async () => {
  const result = await planPrompt({
    prompt:
      'Build a Coinbase Wallet and Commerce storefront with a Vite frontend and order history.',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'web')?.spec.partner,
    'coinbase',
  )
})

test('planPrompt assigns evm wallet sdk for xlayer frontend prompts', async () => {
  const result = await planPrompt({
    prompt:
      'Build a React bridge dashboard for X Layer with WalletConnect, viem, and transaction analytics.',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(result.spec.projects.find((project) => project.id === 'web')?.spec.partner, 'xlayer')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'web')?.spec.slots!.sdk,
    'sdk:evm-wallet',
  )
  assert.ok(
    result.spec.projects
      .find((project) => project.id === 'web')
      ?.spec.layers!.includes('capability:crypto-bridge-ui'),
  )
})

test('planPrompt routes mixed web and python api prompts to a workspace', async () => {
  const result = await planPrompt({
    prompt: 'Create a Next.js marketing shell with a separate Python API for summarization jobs.',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(result.spec.launchPlan!.primaryProjectId, 'web')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'web')?.spec.family,
    'nextjs-ts',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'api')?.spec.family,
    'python-api',
  )
})

test('planPrompt expands solana perps prompts into web, api, worker, and solana lanes', async () => {
  const result = await planPrompt({
    prompt:
      'Build a perpetual futures DEX on Solana using Anchor with Pyth price feeds, liquidation keepers, and a Vite + React trading interface.',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'web')?.spec.family,
    'react-vite-ts',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'api')?.spec.family,
    'api-service',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'worker')?.spec.family,
    'worker-job',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'solana')?.spec.family,
    'solana-program',
  )
  assert.ok(
    result.spec.projects
      .find((project) => project.id === 'solana')
      ?.spec.layers!.includes('capability:solana-perps'),
  )
})

test('planPrompt expands solana prediction prompts into api, worker, and solana specialization', async () => {
  const result = await planPrompt({
    prompt:
      'Build a prediction market on Solana with Anchor, Pyth or Switchboard oracles, dispute handling, and a React market browser.',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'api')?.spec.family,
    'api-service',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'worker')?.spec.family,
    'worker-job',
  )
  assert.ok(
    result.spec.projects
      .find((project) => project.id === 'solana')
      ?.spec.layers!.includes('capability:solana-prediction'),
  )
})

test('planPrompt expands solana staking prompts into web, api, worker, and solana specialization', async () => {
  const result = await planPrompt({
    prompt:
      'Build a Solana staking dashboard with validator delegation, rewards distribution, auto-compound jobs, and a React position explorer.',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'web')?.spec.family,
    'react-vite-ts',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'api')?.spec.family,
    'api-service',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'worker')?.spec.family,
    'worker-job',
  )
  assert.ok(
    result.spec.projects
      .find((project) => project.id === 'solana')
      ?.spec.layers!.includes('capability:solana-staking'),
  )
})

test('planPrompt routes agent webapp prompts to web plus agent workspace', async () => {
  const result = await planPrompt({
    prompt:
      'Build a Next.js control plane for a LangGraph AI agent with tool logs, memory, and an agent service backend.',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'web')?.spec.family,
    'nextjs-ts',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'agent')?.spec.family,
    'agent-service-ts',
  )
})

test('planPrompt routes python agent service prompts to the dedicated agent family', async () => {
  const result = await planPrompt({
    prompt: 'Build a Python agent service using PydanticAI with a small HTTP control plane.',
    partner: null,
  })

  assert.equal(result.kind, 'starter')
  assert.equal(result.spec.family, 'agent-service-py')
  // agentLibrary is set during compose via family defaults, not during routing
})

test('planPrompt routes dspy prompts to the dedicated pipeline family', async () => {
  const result = await planPrompt({
    prompt: 'Build an optimized AI pipeline using DSPy for automated prompt engineering.',
    partner: null,
  })

  assert.equal(result.kind, 'starter')
  assert.equal(result.spec.family, 'dspy-pipeline-py')
})

test('planPrompt keeps mcp server prompts on the mcp lane even when they mention json-rpc', async () => {
  const result = await planPrompt({
    prompt:
      'Build a Model Context Protocol server with JSON-RPC transport, TypeScript implementation, and a React testing dashboard.',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'api')?.spec.family,
    'mcp-server-ts',
  )
})

test('planPrompt routes web plus worker prompts to a workspace', async () => {
  const result = await planPrompt({
    prompt:
      'Build a React operator console with a background worker that reacts to market streams.',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'web')?.spec.family,
    'react-vite-ts',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'worker')?.spec.family,
    'worker-job',
  )
})

test('planPrompt routes web plus playwright automation prompts to a workspace', async () => {
  const result = await planPrompt({
    prompt:
      'Build a Next.js control plane with a separate Playwright worker for browser automation.',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  assert.equal(
    result.spec.projects.find((project) => project.id === 'web')?.spec.family,
    'nextjs-ts',
  )
  assert.equal(
    result.spec.projects.find((project) => project.id === 'worker')?.spec.family,
    'playwright-worker',
  )
})

test('planPrompt carries auth, payments, and queue slots for starter prompts', async () => {
  const result = await planPrompt({
    prompt:
      'Build a fullstack SaaS control plane with Better Auth, Stripe subscriptions, and BullMQ background jobs.',
    partner: null,
  })

  assert.equal(result.kind, 'starter')
  assert.equal(result.spec.family, 'fullstack-ts')
  assert.equal(result.spec.slots!.auth, 'auth:better-auth')
  assert.equal(result.spec.slots!.payments, 'payments:stripe')
  assert.equal(result.spec.slots!.queue, 'queue:bullmq')
})

test('runPromptCorpus executes a tiny real prompt suite end to end', async () => {
  const outDir = await createTempDir('starter-foundry-prompt-corpus-test')
  const corpusPath = path.join(outDir, 'tiny-corpus.json')

  try {
    await writeJson(corpusPath, {
      name: 'tiny',
      scenarios: [
        {
          id: 'frontend',
          complexity: 'simple',
          partner: 'coinbase',
          prompt: 'Build a Coinbase landing page with charts and a fast preview.',
          expected: { kind: 'starter', family: 'frontend-static' },
        },
        {
          id: 'multichain',
          complexity: 'complex',
          partner: 'coinbase',
          prompt:
            'Build a multichain product studio with a frontend plus Solidity, Solana, and Move contract lanes.',
          expected: {
            kind: 'workspace',
            primaryProjectId: 'web',
            projectIds: ['web', 'evm', 'solana', 'move'],
          },
        },
      ],
    })

    const result = await runPromptCorpus({
      corpusPath,
      outDir,
    })

    assert.equal(result.report.summary.passRate, 1)
    assert.equal(result.report.summary.routeAccuracy, 1)
    assert.equal(result.report.summary.validationPassRate, 1)
  } finally {
    await fs.rm(outDir, { recursive: true, force: true })
  }
})

test('runProofSuite summarizes coverage for a tiny corpus', async () => {
  const outDir = await createTempDir('starter-foundry-proof-suite-test')
  const corpusPath = path.join(outDir, 'proof-corpus.json')

  try {
    await writeJson(corpusPath, {
      name: 'proof-tiny',
      scenarios: [
        {
          id: 'frontend',
          complexity: 'simple',
          partner: 'coinbase',
          prompt: 'Build a Coinbase landing page with charts and a fast preview.',
          expected: { kind: 'starter', family: 'frontend-static' },
        },
        {
          id: 'workspace',
          complexity: 'complex',
          partner: null,
          prompt:
            'Build a React operator console with a background worker that reacts to market streams.',
          expected: {
            kind: 'workspace',
            primaryProjectId: 'web',
            projectIds: ['web', 'worker'],
            projectFamilies: { web: 'react-vite-ts', worker: 'worker-job' },
          },
        },
      ],
    })

    const result = await runProofSuite({
      corpusPath,
      outDir,
    })

    const report = result.report as ProofReport
    assert.equal(report.summary.passRate, 1)
    assert.equal(report.coverage.kinds['starter'], 1)
    assert.equal(report.coverage.kinds['workspace'], 1)
    assert.ok(report.coverage.families.includes('frontend-static'))
    assert.ok(report.coverage.families.includes('worker-job'))
  } finally {
    await fs.rm(outDir, { recursive: true, force: true })
  }
})

test("planPrompt: UI-on-contract prompts ('X page') route to workspace with tailwind+shadcn", async () => {
  // Regression: the buildout corpus showed prompts like "DEX swap page",
  // "NFT mint page" routing to forge-contracts only — agents then installed
  // lucide-react, tailwindcss, clsx manually. capability-gaps.json ranked
  // capability:shadcn missed 20× and capability:tailwind missed 14× across 5
  // scenarios. This test pins the fix: "page" is a frontend signal, and
  // workspace web projects force-attach tailwind + shadcn on React families.
  const result = await planPrompt({
    prompt: 'Build a DEX swap page for Ethereum with liquidity pools',
    partner: null,
  })

  assert.equal(result.kind, 'workspace')
  const web = result.spec.projects.find((p) => p.id === 'web')
  assert.ok(web, 'expected a web project in the workspace')
  assert.equal(web.spec.family, 'react-vite-ts')
  const layers = new Set(web.spec.layers ?? [])
  assert.ok(layers.has('capability:tailwind'), 'web must ship capability:tailwind')
  assert.ok(layers.has('capability:shadcn'), 'web must ship capability:shadcn')

  const evm = result.spec.projects.find((p) => p.id === 'evm')
  assert.ok(evm, 'expected an evm contract project alongside the web surface')
})
