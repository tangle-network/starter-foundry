import { keywordScore, matchesKeyword } from './keywords.js'
import type { SelectionResult, Confidence, ComposeSpec } from '../types.js'

interface Candidate {
  family: string
  layers: string[]
  score: number
  reasons: string[]
}

export async function selectStarter({
  prompt,
  partner = null,
}: {
  prompt: string
  partner?: string | null
}): Promise<SelectionResult> {
  const lower = prompt.toLowerCase()
  const candidates: Candidate[] = [
    {
      family: 'tangle-blueprint',
      layers: ['framework:tangle-blueprint'],
      score: keywordScore(prompt, [
        'tangle blueprint',
        'blueprint sdk',
        'cargo tangle',
        'oracle blueprint',
        'storage blueprint',
        'tangle network',
        'tangle native',
        'tangle oracle',
        'tangle custody',
        'frost blueprint',
      ]),
      reasons: ['tangle blueprint language detected'],
    },
    {
      family: 'eigenlayer-avs',
      layers: ['framework:eigenlayer-avs'],
      score: keywordScore(prompt, ['eigenlayer', 'avs', 'oracle avs', 'keeper avs', 'sequencer avs', 'coprocessor avs']),
      reasons: ['eigenlayer avs language detected'],
    },
    {
      family: 'stylus-contracts',
      layers: ['framework:stylus-contracts'],
      score: keywordScore(prompt, ['stylus', 'arbitrum stylus']),
      reasons: ['stylus language detected'],
    },
    {
      family: 'zk-prover-service',
      layers: ['framework:zk-prover-service'],
      score: keywordScore(prompt, [
        'risc zero',
        'sp1',
        'circom',
        'snarkjs',
        'fhenix',
        'zk prover',
        'verifiable ml',
        'private voting',
        'dark pool',
        'mixer',
      ]),
      reasons: ['zk infrastructure language detected'],
    },
    {
      family: 'mcp-server-ts',
      layers: ['framework:mcp-server-ts'],
      score: keywordScore(prompt, ['model context protocol', 'mcp server', 'mcp tools', 'mcp tool server']),
      reasons: ['mcp server language detected'],
    },
    {
      family: 'dspy-pipeline-py',
      layers: ['framework:dspy-pipeline-py'],
      score: keywordScore(prompt, [
        'dspy',
        'rag system',
        'summarization system',
        'text classification system',
        'prompt engineering',
      ]),
      reasons: ['dspy pipeline language detected'],
    },
    {
      family: 'agent-service-ts',
      layers: ['framework:agent-service-ts'],
      score: keywordScore(prompt, [
        'ai agent',
        'agent runtime',
        'agent service',
        'chatbot',
        'chat bot',
        'ai assistant',
        'ai copilot',
        'support agent',
        'support bot',
        'slack bot',
        'slack agent',
        'github bot',
        'github agent',
        'trading agent',
        'code review agent',
        'data agent',
        'data analysis agent',
        'research agent',
        'rag',
        'retrieval augmented',
        'agent backend',
        'ai that can',
        'ai that answers',
        'ai to answer',
        'ai to search',
        'hermes agent',
        'hermes function calling',
        'openclaw agent',
        'function-calling agent',
        'fine-tuning',
        'fine tuning',
        'finetune',
        'unsloth',
        'modal gpu',
        'train a model',
        'langgraph',
        'mastra',
        'openai agents',
        'openai agents sdk',
        'typescript agent',
      ]),
      reasons: ['typescript agent language detected'],
    },
    {
      family: 'agent-service-py',
      layers: ['framework:agent-service-py'],
      score: keywordScore(prompt, [
        'python agent',
        'pydanticai',
        'crewai',
        'autogen',
        'agno',
        'llamaindex',
        'agentkit',
        'python chatbot',
        'python assistant',
      ]),
      reasons: ['python agent language detected'],
    },
    {
      family: 'agent-service-rust',
      layers: ['framework:agent-service-rust'],
      score: keywordScore(prompt, ['rust agent', 'rig', 'cargo agent', 'autonomous rust']),
      reasons: ['rust agent language detected'],
    },
    {
      family: 'x402-service',
      layers: ['framework:x402-service'],
      score: keywordScore(prompt, ['x402', 'micropayments', 'pay-per-request', 'monetized api']),
      reasons: ['x402 language detected'],
    },
    {
      family: 'evm-infra-ts',
      layers: ['framework:evm-infra-ts'],
      score: keywordScore(prompt, [
        'viem',
        'ethers',
        'rpc',
        'block monitor',
        'gas price',
        'transaction count',
        'multicall',
        'wallet balance',
        'okb',
        'oklink',
        'okx',
        'x layer',
        'xlayer',
        '/stats',
      ]),
      reasons: ['evm infrastructure language detected'],
    },
    {
      family: 'expo-react-native-ts',
      layers: ['framework:expo-react-native-ts'],
      score: keywordScore(prompt, ['expo', 'react native', 'mobile app', 'ios app', 'android app']),
      reasons: ['mobile language detected'],
    },
    {
      family: 'browser-extension-ts',
      layers: ['framework:browser-extension-ts'],
      score: keywordScore(prompt, [
        'browser extension',
        'chrome extension',
        'manifest v3',
        'extension popup',
        'firefox addon',
      ]),
      reasons: ['browser extension language detected'],
    },
    {
      family: 'tauri-desktop',
      layers: ['framework:tauri-desktop'],
      score: keywordScore(prompt, ['tauri', 'native desktop', 'rust desktop', 'tauri app']),
      reasons: ['tauri desktop language detected'],
    },
    {
      family: 'electron-desktop-ts',
      layers: ['framework:electron-desktop-ts'],
      score: keywordScore(prompt, ['electron', 'desktop app', 'desktop assistant', 'tray app']),
      reasons: ['desktop language detected'],
    },
    {
      family: 'go-worker',
      layers: ['framework:go-worker'],
      score:
        keywordScore(prompt, ['go worker', 'golang worker', 'go cron', 'go queue', 'go background job']) +
        (lower.includes('go worker') || lower.includes('golang worker') ? 2 : 0),
      reasons: ['go worker language detected'],
    },
    {
      family: 'python-worker',
      layers: ['framework:python-worker'],
      score:
        keywordScore(prompt, ['python worker', 'python cron', 'python queue', 'python background job', 'celery', 'python task', 'python async worker']) +
        (lower.includes('python worker') || lower.includes('celery') ? 2 : 0),
      reasons: ['python worker language detected'],
    },
    {
      family: 'cli-ts',
      layers: ['framework:cli-ts'],
      score: keywordScore(prompt, ['cli', 'command line', 'terminal tool', 'shell tool', 'developer tool']),
      reasons: ['cli language detected'],
    },
    {
      family: 'playwright-worker',
      layers: ['framework:playwright-worker'],
      score: keywordScore(prompt, ['playwright', 'browser automation', 'web scraping', 'scraper', 'crawler']),
      reasons: ['playwright automation language detected'],
    },
    {
      family: 'python-data-app',
      layers: ['framework:python-data-app'],
      score: keywordScore(prompt, ['streamlit', 'gradio', 'data app', 'csv upload', 'analytics app', 'ml demo']),
      reasons: ['python data app language detected'],
    },
    {
      family: 'go-api',
      layers: ['framework:go-net-http'],
      score: keywordScore(prompt, ['golang', 'go api', 'go backend', 'go service', 'go rest', 'net/http']),
      reasons: ['go backend language detected'],
    },
    {
      family: 'solana-program',
      layers: ['framework:solana-native-rust'],
      score: keywordScore(prompt, [
        'solana',
        'anchor',
        'solana program',
        'program derived address',
        'pda',
        'pyth',
        'switchboard',
        'jupiter',
        'openbook',
      ]),
      reasons: ['solana language detected'],
    },
    {
      family: 'move-contracts',
      layers: ['framework:move-package'],
      score: keywordScore(prompt, ['move contract', 'aptos', 'sui move', 'move module', 'sui']),
      reasons: ['move language detected'],
    },
    {
      family: 'nextjs-ts',
      layers: ['framework:nextjs-app-router'],
      score: keywordScore(prompt, ['next', 'next.js', 'nextjs', 'app router', 'server action', 'seo app']),
      reasons: ['next.js language detected'],
    },
    {
      family: 'react-vite-ts',
      layers: ['framework:react-vite-ts'],
      score: keywordScore(prompt, ['react', 'vite', 'spa', 'component', 'single page', 'client app']),
      reasons: ['react/vite language detected'],
    },
    {
      family: 'sveltekit-ts',
      layers: ['framework:sveltekit-ts'],
      score: keywordScore(prompt, ['svelte', 'sveltekit', 'svelte kit', 'svelte app']),
      reasons: ['sveltekit language detected'],
    },
    {
      family: 'remix-ts',
      layers: ['framework:remix-ts'],
      score: keywordScore(prompt, ['remix', 'remix run', 'remix app', 'loader', 'action']),
      reasons: ['remix language detected'],
    },
    {
      family: 'vue-ts',
      layers: ['framework:vue-ts'],
      score: keywordScore(prompt, ['vue', 'vue.js', 'vuejs', 'nuxt', 'composition api', 'vue app']),
      reasons: ['vue language detected'],
    },
    {
      family: 'angular-ts',
      layers: ['framework:angular-ts'],
      score: keywordScore(prompt, ['angular', 'angular app', 'ng serve', 'standalone component']),
      reasons: ['angular language detected'],
    },
    {
      family: 'fullstack-ts',
      layers: ['framework:fullstack-node-ts', 'capability:logging'],
      score: keywordScore(prompt, [
        'fullstack',
        'full stack',
        'dashboard with api',
        'app with api',
        'admin app',
        'database-backed',
        'dashboard and api',
        'saas',
        'saas app',
        'saas platform',
        'internal tool',
        'admin panel',
        'back office',
        'crud app',
        'agent dashboard',
        'agent monitoring',
        'monitoring dashboard',
      ]),
      reasons: ['fullstack language detected'],
    },
    {
      family: 'cloudflare-worker-ts',
      layers: ['framework:cloudflare-worker-ts'],
      score: keywordScore(prompt, ['cloudflare', 'durable object', 'edge api', 'edge function', 'hono edge', 'workerd']),
      reasons: ['edge/cloudflare language detected'],
    },
    {
      family: 'python-api',
      layers: ['framework:python-http'],
      score: keywordScore(prompt, ['python', 'fastapi', 'flask', 'django', 'api in python']),
      reasons: ['python api language detected'],
    },
    {
      family: 'rust-service',
      layers: ['framework:rust-http'],
      score: keywordScore(prompt, ['rust', 'rust service', 'axum', 'rust api', 'rust backend', 'cargo']),
      reasons: ['rust service language detected'],
    },
    {
      family: 'forge-contracts',
      layers: ['framework:forge-foundation'],
      score: keywordScore(prompt, [
        'solidity',
        'foundry',
        'forge',
        'hardhat',
        'foundry.toml',
        'deploy script',
        'deploy task',
        'contract verification',
        'verify',
        'private_key',
        '.env template',
        'erc20',
        'erc-20',
        'erc721',
        'erc-721',
        'erc-4337',
        'erc4337',
        'evm contract',
        'ethereum',
        'arbitrum',
        'base network',
        'x layer',
        'xlayer',
        'layerzero',
        'chainlink',
        'wallet factory',
        'auction house',
        'lendingpool',
        'lending protocol',
        'borrowing protocol',
        'cover manager',
        'erc-4626',
        'erc4626',
        'vault',
        'dex protocol',
        'amm',
        'yield aggregator',
        'bridge protocol',
        'cross-chain',
        'flash loan',
        'perpetual futures',
        'perps protocol',
        'restaking',
        'funding rate',
        'margin trading',
        'gmx',
        'hyperliquid',
        'gateway',
        'viem',
        'okb',
        'oklink',
      ]),
      reasons: ['forge/solidity language detected'],
    },
    {
      family: 'hardhat-contracts',
      layers: ['framework:hardhat-ts'],
      score: keywordScore(prompt, [
        'hardhat',
        'hardhat typeScript',
        'hardhat typescript',
        'npx hardhat',
        'hardhat config',
        'deploy task',
      ]),
      reasons: ['hardhat language detected'],
    },
    {
      family: 'frontend-static',
      layers: ['framework:web-static'],
      score: keywordScore(prompt, ['website', 'landing', 'frontend', 'dashboard', 'page', 'ui', 'preview']),
      reasons: ['frontend-like language detected'],
    },
    {
      family: 'api-service',
      layers: ['framework:node-http', 'capability:logging'],
      score: keywordScore(prompt, ['api', 'server', 'endpoint', 'backend', 'service', 'webhook']),
      reasons: ['server/api language detected'],
    },
    {
      family: 'worker-job',
      layers: ['framework:node-worker', 'capability:market-sim'],
      score: keywordScore(prompt, ['bot', 'worker', 'trading', 'queue', 'cron', 'stream']),
      reasons: ['worker/bot language detected'],
    },
  ]

  for (const candidate of candidates) {
    if (
      candidate.family === 'forge-contracts' &&
      (lower.includes('foundry') ||
        lower.includes('forge') ||
        lower.includes('foundry.toml') ||
        lower.includes('contract verification'))
    ) {
      candidate.score += 3
    }

    if (candidate.family === 'hardhat-contracts' && lower.includes('hardhat')) {
      candidate.score += lower.includes('foundry') || lower.includes('forge') ? 0 : 4
    }

    if (
      candidate.family === 'forge-contracts' &&
      lower.includes('hardhat') &&
      !lower.includes('foundry') &&
      !lower.includes('forge')
    ) {
      candidate.score -= 3
    }

    if (
      candidate.family === 'evm-infra-ts' &&
      (lower.includes('foundry') ||
        lower.includes('forge') ||
        lower.includes('hardhat') ||
        lower.includes('solidity') ||
        lower.includes('erc20') ||
        lower.includes('erc721'))
    ) {
      candidate.score -= 2
    }

    if (
      candidate.family === 'evm-infra-ts' &&
      (lower.includes('block monitor') ||
        lower.includes('multicall') ||
        lower.includes('wallet balance') ||
        lower.includes('/stats'))
    ) {
      candidate.score += 2
    }

    if (candidate.family === 'agent-service-ts' && (lower.includes('langgraph') || lower.includes('mastra'))) {
      candidate.score += 2
    }

    if (
      candidate.family === 'agent-service-py' &&
      (lower.includes('pydanticai') ||
        lower.includes('crewai') ||
        lower.includes('autogen') ||
        lower.includes('agno'))
    ) {
      candidate.score += 2
    }

    if (candidate.family === 'agent-service-rust' && matchesKeyword(prompt, 'rig')) {
      candidate.score += 3
    }

    // Boost language-specific API families when the language co-occurs with API terms
    if (
      candidate.family === 'go-api' &&
      matchesKeyword(prompt, 'go') &&
      (lower.includes('api') || lower.includes('backend') || lower.includes('rest') || lower.includes('service'))
    ) {
      candidate.score += 2
    }

    if (
      candidate.family === 'python-api' &&
      matchesKeyword(prompt, 'python') &&
      (lower.includes('api') || lower.includes('backend') || lower.includes('rest'))
    ) {
      candidate.score += 2
    }

    if (
      candidate.family === 'rust-service' &&
      matchesKeyword(prompt, 'rust') &&
      (lower.includes('api') || lower.includes('backend') || lower.includes('service'))
    ) {
      candidate.score += 2
    }
  }

  candidates.sort((left, right) => right.score - left.score)
  const winner = candidates[0]!
  const family = winner.score > 0 ? winner.family : 'frontend-static'
  const layers = winner.score > 0 ? winner.layers : ['framework:web-static']
  const confidence: Confidence = winner.score > 2 ? 'high' : winner.score > 0 ? 'medium' : 'low'
  const spec: ComposeSpec = {
    projectName: partner ? `${partner}-starter` : 'generated-starter',
    family,
    layers,
    partner,
    slots: {},
    variables: {},
  }

  if (partner === 'coinbase' && family === 'frontend-static') {
    spec.layers = [...layers, 'capability:chart-widget']
    spec.variables = { ...spec.variables, headline: 'Ship a Coinbase-ready product surface' }
  }

  if (
    partner === 'coinbase' &&
    (family === 'react-vite-ts' || family === 'nextjs-ts' || family === 'fullstack-ts' || family === 'x402-service')
  ) {
    spec.layers = [...new Set([...layers, 'capability:chart-widget'])]
    spec.variables = { ...spec.variables, headline: 'Ship a Coinbase-ready product surface' }
  }

  return {
    confidence,
    spec,
    fallbackUsed: winner.score === 0,
    reasons: winner.score > 0 ? winner.reasons : ['no confident match, using default frontend family'],
  }
}
