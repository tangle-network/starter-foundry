/**
 * Coverage tests — ensures every family and capability is tested.
 *
 * These prevent dark code: if you add a family or capability without
 * keywords that trigger it, these tests fail. Run on every PR that
 * touches registry/.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { planPrompt } from '../dist/lib/prompt-planner.js'
import { composeStarter } from '../dist/lib/compose.js'
import { loadRegistry } from '../dist/lib/registry.js'
import { detectCapabilities } from '../dist/lib/keywords.js'
import type { Registry } from '../dist/types.js'

let registry: Registry

test('load registry', async () => {
  registry = await loadRegistry()
  assert.ok(registry.families.size > 0)
})

// --- Every family routes correctly ---

const FAMILY_PROMPTS: Record<string, string> = {
  'agent-service-py': 'Build a Python agent service using PydanticAI',
  'agent-service-rust': 'Build a Rust AI agent using rig',
  'agent-service-ts': 'Build an AI agent service in TypeScript',
  'agent-swarm-ts':
    'Build a LangGraph-js typescript multi-agent swarm with supervisor and specialist worker agents',
  'angular-ts': 'Build an Angular app with standalone components',
  'api-service': 'Build a Node.js API with health endpoint',
  'browser-extension-ts': 'Build a Chrome extension with popup',
  'bun-http': 'Build a Bun HTTP API using Bun.serve',
  'cli-ts': 'Build a TypeScript CLI tool',
  'cloudflare-worker-ts': 'Build a Cloudflare Worker edge API',
  'deno-edge': 'Build a Deno HTTP API using Deno.serve with Deno Deploy target',
  'dspy-pipeline-py': 'Build a DSPy text classification pipeline',
  'eigenlayer-avs': 'Build an EigenLayer AVS for oracle data',
  'electron-desktop-ts': 'Build an Electron desktop app',
  'evm-infra-ts': 'Build a viem block monitor with gas tracking',
  'expo-react-native-ts': 'Build an Expo React Native mobile app',
  'fhenix-contracts': 'Build a Fhenix Hardhat CoFHE encrypted contract',
  'fhenix-foundry': 'Build a Fhenix Foundry CoFHE encrypted contract',
  'fhevm-contracts': 'Build a Zama fhEVM confidential contract',
  'forge-contracts': 'Build a Foundry ERC20 contract in Solidity',
  'frontend-static': 'Build a static landing page website',
  'fullstack-ts': 'Build a fullstack SaaS admin dashboard',
  'go-api': 'Build a Go REST API with Postgres',
  'go-worker': 'Build a Go worker for cron reconciliations',
  'hardhat-contracts': 'Build a Hardhat TypeScript project for X Layer',
  'mcp-server-ts': 'Build an MCP server for database tools',
  'move-contracts': 'Build a Sui Move treasury module',
  'nextjs-ts': 'Build a Next.js app with App Router',
  'playwright-worker': 'Build a Playwright web scraper',
  'python-api': 'Build a FastAPI backend service',
  'python-data-app': 'Build a Streamlit analytics dashboard',
  'python-worker': 'Build a Python Celery worker for async jobs',
  'react-vite-ts': 'Build a React Vite single page app',
  'remix-ts': 'Build a Remix app with nested routes',
  'rust-service': 'Build a Rust Axum HTTP service',
  'solana-program': 'Build a Solana program with Anchor',
  'stylus-contracts': 'Build an Arbitrum Stylus Rust contract',
  'sveltekit-ts': 'Build a SvelteKit app with SSR',
  'tangle-blueprint': 'Build a Tangle Blueprint for oracle data',
  'tauri-desktop': 'Build a Tauri desktop app',
  'vllm-server':
    'Build a self-hosted LLM inference server using vLLM with OpenAI-compatible endpoints',
  'vue-ts': 'Build a Vue 3 app with Composition API',
  'wasm-rust': 'Build a Rust + WASM browser image processor using wasm-bindgen',
  'worker-job': 'Build a trading bot worker',
  'x402-service': 'Build an x402 pay-per-request API',
  'zk-prover-service': 'Build a RISC Zero ZK prover service',
  'astro-static': 'Build an Astro static site with islands architecture',
  'threejs-game': 'Build a Three.js WebGL 3D scene with a rotating gltf model',
  'phaser-game': 'Build a Phaser 3 2D arcade game with a bouncing sprite',
  'pixijs-game': 'Build a Pixi.js v8 interactive canvas with 2D WebGPU rendering',
  'ollama-server': 'Build an Ollama local LLM server with a gguf model',
  'aptos-move': 'Build an Aptos Move module with aptos_framework imports',
  'bevy-web': 'Build a Bevy Rust web game compiled to WASM via Trunk',
  'celestia-da': 'Build a Celestia data availability light node with blob submit',
  'electron-native-os':
    'Build an Electron app with native OS integration, deep links, and OS notifications',
  'eleventy-static': 'Build an Eleventy static blog with Nunjucks layouts',
  'expo-rn-rich': 'Build an Expo React Native app with Skia and Reanimated animations',
  'fintech-ledger-backend': 'Build a fintech double-entry ledger backend with debits and credits',
  'godot-web': 'Build a Godot 4 web game with HTML5 export',
  'healthcare-hipaa-backend':
    'Build a HIPAA-compliant healthcare backend for patient records with PHI audit logging',
  'hls-origin': 'Build an HLS live streaming origin server with RTMP ingest and m3u8 output',
  'hugo-static': 'Build a Hugo static site with TOML config and layouts',
  'jupyter-book': 'Build a Jupyter Book documentation site with executable MyST code cells',
  'legal-case-mgmt': 'Build a legal case management SaaS for matter and attorney timekeeping',
  'livekit-sfu': 'Build a LiveKit WebRTC SFU for video conferencing rooms',
  'lora-training': 'Build a LoRA fine-tuning starter with PEFT and bitsandbytes QLoRA',
  'multimodal-agent': 'Build a multimodal agent client that accepts text, image, and audio input',
  'observable-notebook': 'Build an Observable Framework notebook with Plot charts',
  'rag-pipeline-py': 'Build a Python RAG pipeline with Chroma and sentence-transformers',
  'realtime-audio-ts':
    'Build a realtime audio visualization with WebAudio analyser and WebRTC peer connection',
  'sglang-server':
    'Build an SGLang inference server with radix attention and constrained generation',
  'skypilot-serving': 'Build a SkyPilot multi-cloud LLM serving deployment with sky serve',
  'streamlit-advanced': 'Build a multipage Streamlit dashboard with caching and Plotly charts',
  'tauri-menubar': 'Build a Tauri macOS menubar app with a floating popover panel',
  'tauri-tray': 'Build a Tauri system tray daemon app with no main window',
  'tgi-server': 'Build a HuggingFace Text Generation Inference server with CUDA',
  'triton-server': 'Build an NVIDIA Triton inference server with a model repository',
  'unity-web-proxy': 'Build a Unity WebGL export hosting proxy with batch-mode build scripts',
  'vision-first-agent': 'Build a vision-first camera agent that captures frames for visual QA',
  'voice-first-agent':
    'Build a voice-first conversational agent with browser mic and speech to text',
  'webgpu-inference': 'Build a WebGPU browser compute pipeline for WGSL matmul inference',
  'webgpu-render': 'Build a raw WebGPU graphics renderer with WGSL vertex and fragment shaders',
  'zola-static': 'Build a Zola static site with Rust SASS pipeline and Tera templates',
  'crm-backend': 'Build a sales CRM backend with deals pipeline and won amount reporting',
  'ecommerce-headless':
    'Build a headless commerce backend with cart checkout and Stripe payment intent webhooks',
  'k12-edtech':
    'Build a K-12 edtech gradebook with FERPA-aligned audit logs and parent access controls',
  'flutter-app': 'Build a Flutter dart mobile app with Material Design and Cupertino navigation',
  'kotlin-multiplatform': 'Build a Kotlin Multiplatform app with Compose Multiplatform shared UI',
  'kyc-onboarding': 'Build a KYC onboarding flow with document verification and liveness check',
  'fraud-ops-console': 'Build a fraud ops console with risk scoring dashboard and alert triage',
  'polymarket-portfolio-hedging':
    'Build a Polymarket portfolio hedging dashboard with prediction market positions',
  'esp32-rust': 'Build an ESP32 Rust firmware with esp-idf-svc WiFi scanner and xtensa target',
  'stm32-rust': 'Build an STM32 Rust firmware with Embassy async bare metal and probe-rs',
  'ros2-node-py': 'Build a ROS2 rclpy node publishing Twist messages on cmd_vel',
  'hipaa-compliance-pack':
    'Add a HIPAA-compliant compliance pack with PHI audit trail and BAA template',
  'soc2-compliance-pack':
    'Add a SOC 2 Type II compliance pack with change management and incident response playbook',
  'pci-dss-compliance-pack':
    'Add a PCI-DSS 4.0 compliance pack with PAN redaction and Stripe tokenization helpers',
  'gdpr-compliance-pack':
    'Add a GDPR-compliant consent management pack with data subject rights endpoints',
  'risczero-zkvm':
    'Build a RISC Zero zkVM prover service that proves Rust programs and uses the Bonsai proving network',
  'sp1-zkvm':
    'Build a Succinct SP1 zkVM with the Succinct prover network and an on-chain SP1 Gnark verifier',
  'arkworks-prover':
    'Build a custom SNARK circuit from scratch with arkworks hand-rolled r1cs for a research-grade zk proof',
  'agent-runtime-research':
    'Build a general-research-agent that reads templates from its filesystem and runs daily literature surveys',
  'agent-runtime-therapist-ts':
    'Build a voice-first peer-support companion agent that runs PHQ-9 / GAD-7 screeners and escalates to crisis hotlines',
  'agent-runtime-tax-ts':
    'Build a tax-prep companion agent with Circular 230 disclaimer that gathers documents and routes to a CPA for filing',
  'agent-runtime-cmo-advisor-ts':
    'Build a CMO advisor agent for marketing strategy: positioning canvas, channel experiment design, ICP deep dives',
  'agent-runtime-wealth-manager-ts':
    'Build a personal wealth manager agent: asset allocation review, tax-loss harvesting, retirement projection (not a fiduciary)',
  'agent-runtime-legal-counsel-ts':
    'Build a legal counsel agent for contract redlines, NDA + MSA reviews (not a lawyer, no attorney-client privilege)',
  'agent-runtime-music-producer-ts':
    'Build a music producer agent with voice mode for arrangement review, mix feedback, and weekly listening prompts',
  'agent-runtime-recruiter-ts':
    'Build a technical recruiter agent for JD drafting, screening rubrics, and interview-loop design with bias-safeguards',
  'agent-runtime-real-estate-ts':
    'Build a real estate agent for property advisor with comp analysis, cap rate worksheets, and 1031 exchange',
  'agent-runtime-fitness-coach-ts':
    'Build a fitness coach agent for weekly programming, form check protocols, and deload prompts (not a PT, not medical advice)',
  'agent-runtime-novelist-coach-ts':
    'Build a novelist coach agent for scene cards, beat sheet review, and voice audits — creative collaborator, artist always wins',
  'agent-runtime-business-partner-ts':
    'Build a business partner agent for weekly review protocol, OKR design, and decision journal — executive thinking partner',
  'agent-runtime-language-tutor-ts':
    'Build a language tutor agent with daily conversation prompts, vocabulary drill, and shadowing protocol — Krashen comprehensible input',
  'agent-with-ui-ts':
    'Build an agent-with-ui single-agent app with sandbox-ui chat surface and artifact pane',
  'agent-eval-ui-ts':
    'Build an agent-eval-ui dashboard for trace-replay and score-radar visualization with run-comparison',
  'orchestrator-with-ui-ts':
    'Build an orchestrator-with-ui-ts agent fleet manager scaffold using sandbox-ui dashboard primitives',
  'sandbox-app-ts':
    'Build a sandbox-app sandbox workspace on tangle sandbox SDK with editor, file tree, and terminal',
  'agent-debug-ui-ts':
    'Build an agent-debug-ui live-trace-debugger for sse-stream tool-call-inspector and step-through-agent replay',
  'agent-marketplace-ui-ts':
    'Build an agent-marketplace-ui agent-bundle-browser with bundle-detail-page agent-install-flow and marketplace-search',
  'agent-runtime-veterinarian-ts':
    'Build a vet-agent veterinarian agent for pet-health husbandry-reference, vaccination-framework, and emergency-triage (not a licensed DVM)',
  'agent-runtime-relationship-coach-ts':
    'Build a relationship-coach-agent couples coach for communication skills, conflict-resolution, and DV-aware escalation (not a couples therapist)',
  // Tranche-2 hand-authored
  'agent-runtime-friend-ts':
    'Build a companion-agent that runs daily check-ins with non-clinical rapport-warm and topic-pivot',
  'agent-runtime-screenwriter-ts':
    'Build a screenwriter-agent for beat-out and logline-sharpener with screenplay structure',
  'agent-runtime-auditor-ts':
    'Build an internal-auditor agent for SOX SOC2 control-walkthrough and deficiency write-ups',
  // Long-tail batch-promoted
  'agent-runtime-physics-research-ts':
    'Build a physics-research-agent for arxiv literature search and experimental-design',
  'agent-runtime-biology-research-ts':
    'Build a biology research agent for biology research with protein structure analysis and bioinformatics literature on biology',
  'agent-runtime-cs-research-ts':
    'Build a cs-research-assistant for paper review and arxiv literature analysis',
  'agent-runtime-math-research-ts':
    'Build a math-research-agent for theorem analysis and literature survey with arxiv',
  'agent-runtime-chemistry-research-ts':
    'Build a chemistry-research-agent for reaction mechanism analysis and crossref literature search',
  'agent-runtime-ml-research-ts':
    'Build an ml-research-agent for paper-search-agent ablation review and openalex citations',
  'agent-runtime-product-manager-ts':
    'Build a product-manager-agent for PRD drafting and roadmap-prioritization with rice-scoring',
  'agent-runtime-engineering-manager-ts':
    'Build an engineering-manager-agent for one-on-one prep and performance-review with skip-level review',
  'agent-runtime-account-executive-ts':
    'Build an account-executive-agent for MEDDPICC-qualification and discovery-call-prep with deal-strategy',
  'agent-runtime-customer-success-ts':
    'Build a customer-success-agent for QBR-prep and churn-risk-analysis with renewal-playbook',
  'agent-runtime-sales-engineer-ts':
    'Build a sales-engineer-agent for demo-script-prep and POC-design with technical-objection-handling',
  'agent-runtime-designer-ts':
    'Build a product-designer-agent for design-critique and visual-hierarchy review with figma-feedback',
  'agent-runtime-illustrator-ts':
    'Build an illustrator-agent for composition-critique and color-palette analysis',
  'agent-runtime-photographer-ts':
    'Build a photographer-agent for shot-list-prep and lighting-setup with portfolio-review',
  'agent-runtime-game-designer-ts':
    'Build a game-designer-agent for level-design-review and mechanic-pillar analysis',
  'agent-runtime-architect-ts':
    'Build an architect-agent for system-design-review with C4-model architecture-decision-record',
  'agent-runtime-career-coach-ts':
    'Build a career-coach-agent for career-transition planning and self-assessment with decision-framework',
  'agent-runtime-college-counselor-ts':
    'Build a college-counselor-agent for college-list building and common-app-essay review',
  'agent-runtime-essay-coach-ts':
    'Build an essay-coach-agent for thesis-development and college-essay revision with structural-feedback',
  'agent-runtime-cs-tutor-ts':
    'Build a cs-tutor agent for algorithms data-structures and big-o analysis with debugging help',
  'agent-runtime-math-tutor-ts':
    'Build a math-tutor agent for calculus problem-solving and proof-walkthrough',
  'agent-runtime-history-tutor-ts':
    'Build a history-tutor agent for historiography analysis and primary-source review',
  'agent-runtime-mediator-ts':
    'Build a mediator-agent for conflict-resolution facilitation with active-listening protocol',
  'agent-runtime-meditation-coach-ts':
    'Build a meditation-coach-agent for mindfulness practice and body-scan guided sessions',
  'agent-runtime-nutritionist-ts':
    'Build a nutritionist-agent for evidence-based-nutrition assessment with macro-targets and dietary-assessment',
  'agent-runtime-pharmacist-ts':
    'Build a pharmacist-agent for drug-interaction analysis and dosage-review (not a licensed PharmD)',
  'agent-runtime-doctor-ts':
    'Build a doctor-agent for medical-information triage and symptom-screening (not a licensed physician)',
  'agent-runtime-pentester-ts':
    'Build a pentest-agent for vulnerability-analysis and exploit-write-up with OWASP review',
  'agent-runtime-security-engineer-ts':
    'Build a security-engineer-agent for threat-model analysis and incident-response runbook drafting',
  'agent-runtime-devops-ts':
    'Build a devops-agent for SRE runbook drafting and incident-postmortem with SLO design',
  'agent-runtime-data-analyst-ts':
    'Build a data-analyst-agent for SQL-query analysis and KPI-dashboard design with cohort-analysis',
  'agent-runtime-financial-analyst-ts':
    'Build a financial-analyst-agent for DCF financial-modeling and equity-research with comps analysis',
  'agent-runtime-grant-writer-ts':
    'Build a grant-writer-agent for NIH proposal drafting and budget-justification narrative',
  'agent-runtime-travel-planner-ts':
    'Build a trip planner agent with packing-list and multi-city itinerary design',
  'agent-runtime-chef-ts':
    'Build a chef-agent for recipe-development and kitchen-workflow with technique-guidance',
  'multi-agent-legal-ops-ts':
    'Build a legal-ops-team multi-agent pod for paralegal-intake contract-redline and control-walkthrough deficiency-write-up',
  'multi-agent-product-ops-ts':
    'Build a product-ops-team multi-agent feature-team-agent for discovery-cycle prioritization-rice sprint-planning and qbr-prep',
  'multi-agent-research-lab-ts':
    'Build a research-lab-team interdisciplinary cross-domain-research-pod with arxiv crossref openalex literature-survey across multiple domains',
  'multi-agent-creative-studio-ts':
    'Build a creative-studio-team multi-agent cross-medium-creative-team for arrangement-review beat-out scene-card and storyboard-protocol',
  'multi-agent-startup-team-ts':
    'Build a startup-team-agent leadership-team-agent exec-pod with CEO CTO CMO HR CFO advisor — team-cadence weekly-review okr-design decision-journal burn-runway recruiting-loop',
  'agent-research-harness-ts':
    'Build an agent-research-harness research-harness-ts auto-research-loop hypothesis-research-loop bundle for prompt-evolution-loop with screener-validator and bootstrap-ci-gate',
  'agent-eval-harness-ts':
    'I want a TypeScript eval-harness agent-eval-harness-ts eval-runner-ts node-eval-harness for my agent with scenario-based-eval testing and statistical regression-gate',
  'agent-eval-harness-py':
    'I want a Python eval-harness agent-eval-harness-py python-eval-harness eval-runner-py that runs scenarios in tangle-sandbox and emits scorecard-json with bootstrap-ci-eval-gate',
  'agent-research-harness-py':
    'I want a Python research-harness agent-research-harness-py python-research-harness research-runner-py that runs hypothesis-driven optimization with bootstrap-ci-gate and scipy-stats',
}

for (const [family, prompt] of Object.entries(FAMILY_PROMPTS)) {
  test(`family ${family} routes correctly`, async () => {
    const result = await planPrompt({ prompt, partner: null })
    assert.equal(result.kind, 'starter', `${family}: expected starter, got ${result.kind}`)
    assert.equal(
      result.spec.family,
      family,
      `${family}: expected ${family}, got ${result.spec.family} for prompt "${prompt}"`,
    )
  })
}

// --- Every family composes without error ---

for (const [family, prompt] of Object.entries(FAMILY_PROMPTS)) {
  test(`family ${family} composes to disk`, async () => {
    const result = await planPrompt({ prompt, partner: null })
    if (result.kind !== 'starter') return

    const outDir = path.join(os.tmpdir(), `sf-coverage-${family}-${Date.now()}`)
    try {
      const composed = await composeStarter({ spec: result.spec, outDir })
      assert.ok(composed.filesWritten.length > 0, `${family}: no files written`)
      assert.ok(composed.filesWritten.includes('AGENTS.md'), `${family}: missing AGENTS.md`)
      assert.ok(composed.filesWritten.includes('llms.txt'), `${family}: missing llms.txt`)
    } finally {
      await fs.rm(outDir, { recursive: true, force: true }).catch(() => {})
    }
  })
}

// --- Every capability triggers from a prompt ---

const CAP_PROMPTS: Record<string, { prompt: string; family: string }> = {
  'capability:admin-crud': {
    prompt: 'Build an admin panel with CRUD operations',
    family: 'fullstack-ts',
  },
  'capability:agent-ai-sdk': {
    prompt: 'Build a Next.js app with Vercel AI SDK streaming',
    family: 'nextjs-ts',
  },
  'capability:agent-browser': {
    prompt: 'Build a browser automation agent using browser-use',
    family: 'playwright-worker',
  },
  'capability:agent-code-review': {
    prompt: 'Build a code review agent that analyzes PRs',
    family: 'agent-service-ts',
  },
  'capability:agent-customer-support': {
    prompt: 'Build a customer support agent with knowledge base',
    family: 'agent-service-ts',
  },
  'capability:agent-data-pipeline': {
    prompt: 'Build a data analysis agent that queries SQL databases',
    family: 'agent-service-ts',
  },
  'capability:agent-github': {
    prompt: 'Build a GitHub agent that reviews PRs and triages issues',
    family: 'agent-service-ts',
  },
  'capability:agent-hermes': {
    prompt: 'Build a Hermes function-calling agent',
    family: 'agent-service-ts',
  },
  'capability:agent-langgraph': {
    prompt: 'Build a LangGraph agent with checkpointing',
    family: 'agent-service-ts',
  },
  'capability:agent-mastra': {
    prompt: 'Build an AI agent using Mastra with tool workflows',
    family: 'agent-service-ts',
  },
  'capability:agent-multi-agent': {
    prompt: 'Build a langchain AI agent with sub-agent delegation and agent-as-tool patterns',
    family: 'agent-service-ts',
  },
  'capability:agent-openclaw': {
    prompt: 'Build an OpenClaw agent with multi-model orchestration',
    family: 'agent-service-ts',
  },
  'capability:agent-rag': {
    prompt: 'Build a RAG chatbot with vector search',
    family: 'agent-service-ts',
  },
  'capability:agent-slack': {
    prompt: 'Build a Slack bot that answers questions using AI',
    family: 'agent-service-ts',
  },
  'capability:agent-trading': {
    prompt: 'Build an AI trading agent for crypto market analysis',
    family: 'agent-service-ts',
  },
  'capability:agent-voice': {
    prompt: 'Build a LiveKit voice agent for customer calls',
    family: 'agent-service-ts',
  },
  'capability:agent-eval': {
    prompt:
      'Build a TypeScript agent service with an agent eval harness and quality gate CI workflow',
    family: 'agent-service-ts',
  },
  'capability:ai-agent-dashboard': {
    prompt: 'Build an agent monitoring dashboard with run traces',
    family: 'fullstack-ts',
  },
  'capability:ai-chat-ui': {
    prompt: 'Build a Next.js chat app with streaming AI responses',
    family: 'nextjs-ts',
  },
  'capability:ai-fine-tuning': {
    prompt: 'Fine-tune a model using Unsloth on a Python agent service',
    family: 'agent-service-py',
  },
  'capability:chart-widget': {
    prompt: 'Build a Coinbase landing page with charts',
    family: 'frontend-static',
  },
  'capability:defi-bridge': {
    prompt: 'Build a cross-chain bridge protocol using Wormhole',
    family: 'forge-contracts',
  },
  'capability:defi-dex': {
    prompt: 'Build a DEX with concentrated liquidity AMM pools',
    family: 'forge-contracts',
  },
  'capability:defi-lending': {
    prompt: 'Build a DeFi lending protocol with flash loans',
    family: 'forge-contracts',
  },
  'capability:defi-perpetuals': {
    prompt: 'Build an EVM perpetual futures protocol with funding rates',
    family: 'forge-contracts',
  },
  'capability:defi-restaking': {
    prompt: 'Build a restaking protocol with operator registration',
    family: 'forge-contracts',
  },
  'capability:defi-yield': {
    prompt: 'Build a yield vault aggregator with ERC-4626',
    family: 'forge-contracts',
  },
  'capability:deploy-docker': { prompt: 'Build a Go API with Docker deployment', family: 'go-api' },
  'capability:deploy-github-actions': {
    prompt: 'Build a Python API with GitHub Actions CI/CD',
    family: 'python-api',
  },
  'capability:effect-ts': {
    prompt: 'Build an Effect-TS API with typed errors and structured concurrency',
    family: 'api-service',
  },
  'capability:evm-account-abstraction': {
    prompt: 'Build an ERC-4337 gasless minting dapp with bundler',
    family: 'forge-contracts',
  },
  'capability:evm-chain-monitor': {
    prompt: 'Build a block monitor with gas price tracking',
    family: 'evm-infra-ts',
  },
  'capability:evm-deploy-foundry': {
    prompt: 'Scaffold a Foundry project with deploy script and verification',
    family: 'forge-contracts',
  },
  'capability:evm-layerzero-oft': {
    prompt: 'Build a LayerZero OFT bridge token with Foundry',
    family: 'forge-contracts',
  },
  'capability:evm-protocol-api': {
    prompt: 'Build an indexer API for EVM protocol events',
    family: 'api-service',
  },
  'capability:evm-wallet-dashboard': {
    prompt: 'Build a wallet balance multicall dashboard',
    family: 'evm-infra-ts',
  },
  'capability:evm-nft-mint-page': {
    prompt: 'Build a React NFT mint page with wallet connect and mint button for an EVM contract',
    family: 'react-vite-ts',
  },
  'capability:passkey-onboarding': {
    prompt: 'Build a React app with WebAuthn passkey registration and biometric sign-in flow',
    family: 'react-vite-ts',
  },
  'capability:fhe-private-token': {
    prompt: 'Build a Fhenix Hardhat private token with encrypted balances',
    family: 'fhenix-contracts',
  },
  'capability:fhe-private-voting': {
    prompt: 'Build a Fhenix Hardhat encrypted voting contract with secret ballot',
    family: 'fhenix-contracts',
  },
  'capability:fhe-sealed-auction': {
    prompt: 'Build a Fhenix Hardhat blind auction with sealed bid encryption',
    family: 'fhenix-contracts',
  },
  'capability:fhe-foundry-private-token': {
    prompt: 'Build a Fhenix Foundry private token with encrypted balances',
    family: 'fhenix-foundry',
  },
  'capability:fhe-foundry-private-voting': {
    prompt: 'Build a Fhenix Foundry private voting contract with secret ballot',
    family: 'fhenix-foundry',
  },
  'capability:fhe-foundry-sealed-auction': {
    prompt: 'Build a Fhenix Foundry sealed-bid auction with encrypted bids',
    family: 'fhenix-foundry',
  },
  'capability:fhevm-private-token': {
    prompt: 'Build a Zama fhEVM private token with encrypted balances',
    family: 'fhevm-contracts',
  },
  'capability:fhevm-private-voting': {
    prompt: 'Build a Zama fhEVM private voting contract with secret ballot',
    family: 'fhevm-contracts',
  },
  'capability:fhevm-sealed-auction': {
    prompt: 'Build a Zama fhEVM sealed-bid auction with encrypted bids',
    family: 'fhevm-contracts',
  },
  'capability:exchange-binance': {
    prompt: 'Build a Binance trading bot for BTC futures',
    family: 'worker-job',
  },
  'capability:exchange-coinbase': {
    prompt: 'Build a Coinbase Advanced Trade DCA bot',
    family: 'worker-job',
  },
  'capability:exchange-okx': {
    prompt: 'Build an AI trading agent with OKX API integration',
    family: 'agent-service-ts',
  },
  'capability:gpu-modal': {
    prompt: 'Build a Modal GPU pipeline for image generation',
    family: 'agent-service-ts',
  },
  'capability:gpu-replicate': {
    prompt: 'Build an AI agent that runs models on Replicate',
    family: 'agent-service-ts',
  },
  'capability:gpu-together': {
    prompt: 'Build a chatbot using Together AI API',
    family: 'agent-service-ts',
  },
  'capability:icons': { prompt: 'Build a dashboard with Lucide icons', family: 'fullstack-ts' },
  'capability:layout-auth': {
    prompt: 'Build a Next.js app with sign-in and sign-up pages',
    family: 'nextjs-ts',
  },
  'capability:layout-dashboard': {
    prompt: 'Build a SaaS dashboard with analytics metrics',
    family: 'fullstack-ts',
  },
  'capability:layout-settings': {
    prompt: 'Build an app with a settings page for profile and billing',
    family: 'fullstack-ts',
  },
  'capability:infra-k8s': {
    prompt: 'Build an API with Kubernetes deployment manifests',
    family: 'go-api',
  },
  'capability:infra-pulumi': {
    prompt: 'Build a service with Pulumi infrastructure',
    family: 'api-service',
  },
  'capability:infra-terraform': { prompt: 'Build an API with Terraform modules', family: 'go-api' },
  'capability:logging': {
    prompt: 'Build an API with request logging middleware',
    family: 'api-service',
  },
  'capability:market-sim': {
    prompt: 'Build a trading bot that reacts to market streams',
    family: 'worker-job',
  },
  'capability:move-amm': {
    prompt: 'Build a Sui Move DEX with swap routing and pool curves',
    family: 'move-contracts',
  },
  'capability:move-launchpad': {
    prompt: 'Build a Sui Move token launchpad with vesting schedules',
    family: 'move-contracts',
  },
  'capability:move-nft': {
    prompt: 'Build a Sui Move NFT marketplace with auctions',
    family: 'move-contracts',
  },
  'capability:move-oracle': {
    prompt: 'Build a Sui Move oracle with Pyth price feeds',
    family: 'move-contracts',
  },
  'capability:move-staking': {
    prompt: 'Build a Sui Move staking rewards module with delegation',
    family: 'move-contracts',
  },
  'capability:realtime-ws': {
    prompt: 'Build a fullstack app with WebSocket real-time updates',
    family: 'fullstack-ts',
  },
  'capability:saas-billing': {
    prompt: 'Build a Next.js SaaS with Stripe subscription billing',
    family: 'nextjs-ts',
  },
  'capability:saas-teams': {
    prompt: 'Build a SaaS platform with team management and roles',
    family: 'fullstack-ts',
  },
  'capability:shadcn': {
    prompt: 'Build a React app with shadcn/ui components',
    family: 'react-vite-ts',
  },
  'capability:solana-amm': {
    prompt: 'Build a Solana concentrated liquidity AMM',
    family: 'solana-program',
  },
  'capability:solana-keeper': {
    prompt: 'Build a Solana keeper bot for liquidations with Pyth',
    family: 'worker-job',
  },
  'capability:solana-launchpad': {
    prompt: 'Build a Solana token launchpad with fair launches',
    family: 'solana-program',
  },
  'capability:solana-nft': {
    prompt: 'Build a Solana NFT marketplace with compressed NFTs',
    family: 'solana-program',
  },
  'capability:solana-perps': {
    prompt: 'Build a Solana perpetual futures DEX with Pyth feeds',
    family: 'solana-program',
  },
  'capability:solana-prediction': {
    prompt: 'Build a Solana prediction market with Switchboard oracle',
    family: 'solana-program',
  },
  'capability:solana-staking': {
    prompt: 'Build a Solana staking platform with auto-compound',
    family: 'solana-program',
  },
  'capability:tailwind': {
    prompt: 'Build a professional Next.js app with Tailwind CSS',
    family: 'nextjs-ts',
  },
  'capability:tangle-custody': {
    prompt: 'Build a Tangle custody network for threshold signing',
    family: 'tangle-blueprint',
  },
  'capability:tangle-oracle': {
    prompt: 'Build a Tangle oracle blueprint for price feeds',
    family: 'tangle-blueprint',
  },
  'capability:typography': {
    prompt: 'Build a blog with typography and prose classes',
    family: 'nextjs-ts',
  },
  'capability:webrtc': {
    prompt: 'Build a video conferencing app with WebRTC screen sharing',
    family: 'nextjs-ts',
  },
  'capability:webhook-processor': {
    prompt: 'Build a webhook handler for Stripe and GitHub events',
    family: 'api-service',
  },
  'capability:agent-intel': {
    prompt: 'Build an AI agent for web scraping and lead generation',
    family: 'agent-service-ts',
  },
  'capability:layout-admin': {
    prompt: 'Build a fullstack admin panel with data table and CRUD',
    family: 'fullstack-ts',
  },
  'capability:layout-chat': {
    prompt: 'Build a Next.js AI chat app with streaming chat interface',
    family: 'nextjs-ts',
  },
  'capability:layout-landing': {
    prompt: 'Build a Next.js SaaS landing page with hero and pricing',
    family: 'nextjs-ts',
  },
  'capability:marketplace': {
    prompt: 'Build a fullstack two-sided marketplace for freelance gigs',
    family: 'fullstack-ts',
  },
  'capability:json-render': {
    prompt: 'Build a Next.js app with json-render declarative UI',
    family: 'nextjs-ts',
  },
  'capability:crypto-swap-ui': {
    prompt: 'Build a React DEX swap interface like Uniswap',
    family: 'react-vite-ts',
  },
  'capability:crypto-staking-ui': {
    prompt: 'Build a Next.js staking dashboard with validator delegation',
    family: 'nextjs-ts',
  },
  'capability:crypto-bridge-ui': {
    prompt: 'Build a cross-chain bridge transfer UI with Wormhole',
    family: 'react-vite-ts',
  },
  'capability:crypto-portfolio-ui': {
    prompt: 'Build a React wallet portfolio tracker for token balances',
    family: 'react-vite-ts',
  },
  'capability:crypto-governance-ui': {
    prompt: 'Build a DAO governance voting dashboard with proposals',
    family: 'nextjs-ts',
  },
  'capability:crypto-launchpad-ui': {
    prompt: 'Build a React token launchpad UI with vesting schedules',
    family: 'react-vite-ts',
  },
  'capability:ai-chat-sessions': {
    prompt: 'Build a Next.js AI chat app with conversation history and chat sessions',
    family: 'nextjs-ts',
  },
  'capability:ai-agent-orchestrator': {
    prompt: 'Build a multi-agent orchestrator UI with tool calls and agent workflow',
    family: 'nextjs-ts',
  },
  'capability:ai-rag-chat': {
    prompt: 'Build a Next.js RAG chatbot with source citations and retrieval',
    family: 'nextjs-ts',
  },
  'capability:ai-voice-chat': {
    prompt: 'Build a Next.js voice chat interface with STT streaming and tool calls',
    family: 'nextjs-ts',
  },
  'capability:multi-tenancy': {
    prompt:
      'Build a multi-tenant SaaS admin dashboard with per-tenant workspace isolation and subdomain routing',
    family: 'fullstack-ts',
  },
  'capability:zk-browser': {
    prompt:
      'Build a privacy-preserving mixer UI with commitment deposits and nullifier-based withdrawals using zk proofs',
    family: 'react-vite-ts',
  },
  'capability:code-editor': {
    prompt: 'Build a prompt playground with a syntax highlighting code editor for JavaScript',
    family: 'react-vite-ts',
  },
  'capability:date-utils': {
    prompt:
      'Build a scheduling app with appointment booking and a calendar view with recurring events',
    family: 'react-vite-ts',
  },
  'capability:stripe-connect': {
    prompt:
      'Build a marketplace platform using Stripe Connect for split payments between buyers and sellers with platform fees',
    family: 'fullstack-ts',
  },
  'capability:stripe-checkout-onetime': {
    prompt:
      'Build a digital course platform with one-time purchase checkout for individual courses',
    family: 'fullstack-ts',
  },
  'capability:stripe-metered': {
    prompt:
      'Build an API product with pay-as-you-go usage-based billing and per-request billing meters',
    family: 'fullstack-ts',
  },
  'capability:banking-baas': {
    prompt: 'Build a neobank app using Unit banking to open accounts and send ACH transfers',
    family: 'fullstack-ts',
  },
  'capability:tangle-tee': {
    prompt:
      'Build a Tangle blueprint that runs confidential compute inside an Intel TDX enclave with remote attestation',
    family: 'tangle-blueprint',
  },
  'capability:tangle-gpu-provider': {
    prompt:
      'Build a Tangle blueprint for GPU-accelerated ML inference that requires H100 operators',
    family: 'tangle-blueprint',
  },
  'capability:tangle-remote-provider': {
    prompt:
      'Build a Tangle blueprint that wraps the OpenAI API as a remote provider with credential injection',
    family: 'tangle-blueprint',
  },
  'capability:tangle-x402': {
    prompt: 'Build a Tangle blueprint with x402 per-call payment gating in USDC',
    family: 'tangle-blueprint',
  },
  'capability:tangle-mpp': {
    prompt:
      'Build a Tangle blueprint with MPP machine payments protocol for agent-to-agent delegation and budget caps',
    family: 'tangle-blueprint',
  },
  'capability:routing': {
    prompt:
      'Build a DAO UI with a proposal list and proposal detail view — nested routes with deep linking',
    family: 'react-vite-ts',
  },
  'capability:zk-noir': {
    prompt: 'Build an Aztec Noir circuit app with a Barretenberg backend and nargo',
    family: 'react-vite-ts',
  },
  'capability:zk-gnark': {
    prompt: 'Build a Go API that uses ConsenSys gnark for zk proofs and a Groth16 prover',
    family: 'go-api',
  },
}

for (const [capId, config] of Object.entries(CAP_PROMPTS)) {
  test(`capability ${capId.replace('capability:', '')} triggers`, async () => {
    const result = await planPrompt({ prompt: config.prompt, partner: null })
    const layers =
      result.kind === 'starter'
        ? (result.spec.layers ?? [])
        : (result.spec.projects?.flatMap((p) => p.spec.layers ?? []) ?? [])
    assert.ok(
      layers.includes(capId),
      `${capId} not triggered by "${config.prompt}". Got: ${layers.filter((l) => l.startsWith('capability:')).join(', ') || 'none'}`,
    )
  })
}

// --- Meta: no family or capability without a coverage test ---

test('every family has a coverage test prompt', async () => {
  const families = await fs.readdir('registry/families')
  const untested = families.filter((f) => !FAMILY_PROMPTS[f])
  assert.equal(untested.length, 0, `Families without coverage tests: ${untested.join(', ')}`)
})

test('every capability has a coverage test prompt', async () => {
  const caps = (await fs.readdir('registry/layers/capability')).map((c) => `capability:${c}`)
  const untested = caps.filter((c) => !CAP_PROMPTS[c])
  assert.equal(untested.length, 0, `Capabilities without coverage tests: ${untested.join(', ')}`)
})
