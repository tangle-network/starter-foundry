/**
 * Coverage tests — ensures every family and capability is tested.
 *
 * These prevent dark code: if you add a family or capability without
 * keywords that trigger it, these tests fail. Run on every PR that
 * touches registry/.
 */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { planPrompt } from "../dist/lib/prompt-planner.js";
import { composeStarter } from "../dist/lib/compose.js";
import { loadRegistry } from "../dist/lib/registry.js";
import { detectCapabilities } from "../dist/lib/keywords.js";
import type { Registry } from "../dist/types.js";

let registry: Registry;

test("load registry", async () => {
  registry = await loadRegistry();
  assert.ok(registry.families.size > 0);
});

// --- Every family routes correctly ---

const FAMILY_PROMPTS: Record<string, string> = {
  "agent-service-py": "Build a Python agent service using PydanticAI",
  "agent-service-rust": "Build a Rust AI agent using rig",
  "agent-service-ts": "Build an AI agent service in TypeScript",
  "angular-ts": "Build an Angular app with standalone components",
  "api-service": "Build a Node.js API with health endpoint",
  "browser-extension-ts": "Build a Chrome extension with popup",
  "bun-http": "Build a Bun HTTP API using Bun.serve",
  "cli-ts": "Build a TypeScript CLI tool",
  "cloudflare-worker-ts": "Build a Cloudflare Worker edge API",
  "dspy-pipeline-py": "Build a DSPy text classification pipeline",
  "eigenlayer-avs": "Build an EigenLayer AVS for oracle data",
  "electron-desktop-ts": "Build an Electron desktop app",
  "evm-infra-ts": "Build a viem block monitor with gas tracking",
  "expo-react-native-ts": "Build an Expo React Native mobile app",
  "fhenix-contracts": "Build a Fhenix CoFHE encrypted contract",
  "fhevm-contracts": "Build a Zama fhEVM confidential contract",
  "forge-contracts": "Build a Foundry ERC20 contract in Solidity",
  "frontend-static": "Build a static landing page website",
  "fullstack-ts": "Build a fullstack SaaS admin dashboard",
  "go-api": "Build a Go REST API with Postgres",
  "go-worker": "Build a Go worker for cron reconciliations",
  "hardhat-contracts": "Build a Hardhat TypeScript project for X Layer",
  "mcp-server-ts": "Build an MCP server for database tools",
  "move-contracts": "Build a Sui Move treasury module",
  "nextjs-ts": "Build a Next.js app with App Router",
  "playwright-worker": "Build a Playwright web scraper",
  "python-api": "Build a FastAPI backend service",
  "python-data-app": "Build a Streamlit analytics dashboard",
  "python-worker": "Build a Python Celery worker for async jobs",
  "react-vite-ts": "Build a React Vite single page app",
  "remix-ts": "Build a Remix app with nested routes",
  "rust-service": "Build a Rust Axum HTTP service",
  "solana-program": "Build a Solana program with Anchor",
  "stylus-contracts": "Build an Arbitrum Stylus Rust contract",
  "sveltekit-ts": "Build a SvelteKit app with SSR",
  "tangle-blueprint": "Build a Tangle Blueprint for oracle data",
  "tauri-desktop": "Build a Tauri desktop app",
  "vue-ts": "Build a Vue 3 app with Composition API",
  "wasm-rust": "Build a Rust + WASM browser image processor using wasm-bindgen",
  "worker-job": "Build a trading bot worker",
  "x402-service": "Build an x402 pay-per-request API",
  "zk-prover-service": "Build a RISC Zero ZK prover service",
};

for (const [family, prompt] of Object.entries(FAMILY_PROMPTS)) {
  test(`family ${family} routes correctly`, async () => {
    const result = await planPrompt({ prompt, partner: null });
    assert.equal(result.kind, "starter", `${family}: expected starter, got ${result.kind}`);
    assert.equal(
      result.spec.family,
      family,
      `${family}: expected ${family}, got ${result.spec.family} for prompt "${prompt}"`,
    );
  });
}

// --- Every family composes without error ---

for (const [family, prompt] of Object.entries(FAMILY_PROMPTS)) {
  test(`family ${family} composes to disk`, async () => {
    const result = await planPrompt({ prompt, partner: null });
    if (result.kind !== "starter") return;

    const outDir = path.join(os.tmpdir(), `sf-coverage-${family}-${Date.now()}`);
    try {
      const composed = await composeStarter({ spec: result.spec, outDir });
      assert.ok(composed.filesWritten.length > 0, `${family}: no files written`);
      assert.ok(composed.filesWritten.includes("AGENTS.md"), `${family}: missing AGENTS.md`);
      assert.ok(composed.filesWritten.includes("llms.txt"), `${family}: missing llms.txt`);
    } finally {
      await fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
    }
  });
}

// --- Every capability triggers from a prompt ---

const CAP_PROMPTS: Record<string, { prompt: string; family: string }> = {
  "capability:admin-crud": { prompt: "Build an admin panel with CRUD operations", family: "fullstack-ts" },
  "capability:agent-ai-sdk": { prompt: "Build a Next.js app with Vercel AI SDK streaming", family: "nextjs-ts" },
  "capability:agent-browser": { prompt: "Build a browser automation agent using browser-use", family: "playwright-worker" },
  "capability:agent-code-review": { prompt: "Build a code review agent that analyzes PRs", family: "agent-service-ts" },
  "capability:agent-customer-support": { prompt: "Build a customer support agent with knowledge base", family: "agent-service-ts" },
  "capability:agent-data-pipeline": { prompt: "Build a data analysis agent that queries SQL databases", family: "agent-service-ts" },
  "capability:agent-github": { prompt: "Build a GitHub agent that reviews PRs and triages issues", family: "agent-service-ts" },
  "capability:agent-hermes": { prompt: "Build a Hermes function-calling agent", family: "agent-service-ts" },
  "capability:agent-langgraph": { prompt: "Build a LangGraph agent with checkpointing", family: "agent-service-ts" },
  "capability:agent-mastra": { prompt: "Build an AI agent using Mastra with tool workflows", family: "agent-service-ts" },
  "capability:agent-multi-agent": { prompt: "Build a multi-agent system with supervisor and workers", family: "agent-service-ts" },
  "capability:agent-openclaw": { prompt: "Build an OpenClaw agent with multi-model orchestration", family: "agent-service-ts" },
  "capability:agent-rag": { prompt: "Build a RAG chatbot with vector search", family: "agent-service-ts" },
  "capability:agent-slack": { prompt: "Build a Slack bot that answers questions using AI", family: "agent-service-ts" },
  "capability:agent-trading": { prompt: "Build an AI trading agent for crypto market analysis", family: "agent-service-ts" },
  "capability:agent-voice": { prompt: "Build a LiveKit voice agent for customer calls", family: "agent-service-ts" },
  "capability:ai-agent-dashboard": { prompt: "Build an agent monitoring dashboard with run traces", family: "fullstack-ts" },
  "capability:ai-chat-ui": { prompt: "Build a Next.js chat app with streaming AI responses", family: "nextjs-ts" },
  "capability:ai-fine-tuning": { prompt: "Fine-tune a model using Unsloth with QLora", family: "agent-service-py" },
  "capability:chart-widget": { prompt: "Build a Coinbase landing page with charts", family: "frontend-static" },
  "capability:defi-bridge": { prompt: "Build a cross-chain bridge protocol using Wormhole", family: "forge-contracts" },
  "capability:defi-dex": { prompt: "Build a DEX with concentrated liquidity AMM pools", family: "forge-contracts" },
  "capability:defi-lending": { prompt: "Build a DeFi lending protocol with flash loans", family: "forge-contracts" },
  "capability:defi-perpetuals": { prompt: "Build an EVM perpetual futures protocol with funding rates", family: "forge-contracts" },
  "capability:defi-restaking": { prompt: "Build a restaking protocol with operator registration", family: "forge-contracts" },
  "capability:defi-yield": { prompt: "Build a yield vault aggregator with ERC-4626", family: "forge-contracts" },
  "capability:deploy-docker": { prompt: "Build a Go API with Docker deployment", family: "go-api" },
  "capability:deploy-github-actions": { prompt: "Build a Python API with GitHub Actions CI/CD", family: "python-api" },
  "capability:effect-ts": { prompt: "Build an Effect-TS API with typed errors and structured concurrency", family: "api-service" },
  "capability:evm-account-abstraction": { prompt: "Build an ERC-4337 gasless minting dapp with bundler", family: "forge-contracts" },
  "capability:evm-chain-monitor": { prompt: "Build a block monitor with gas price tracking", family: "evm-infra-ts" },
  "capability:evm-deploy-foundry": { prompt: "Scaffold a Foundry project with deploy script and verification", family: "forge-contracts" },
  "capability:evm-layerzero-oft": { prompt: "Build a LayerZero OFT bridge token", family: "forge-contracts" },
  "capability:evm-protocol-api": { prompt: "Build an indexer API for EVM protocol events", family: "api-service" },
  "capability:evm-wallet-dashboard": { prompt: "Build a wallet balance multicall dashboard", family: "evm-infra-ts" },
  "capability:fhe-private-token": { prompt: "Build a Fhenix private token with encrypted balances", family: "fhenix-contracts" },
  "capability:fhe-private-voting": { prompt: "Build a Fhenix encrypted voting contract with secret ballot", family: "fhenix-contracts" },
  "capability:fhe-sealed-auction": { prompt: "Build a Fhenix blind auction with sealed bid encryption", family: "fhenix-contracts" },
  "capability:exchange-binance": { prompt: "Build a Binance trading bot for BTC futures", family: "worker-job" },
  "capability:exchange-coinbase": { prompt: "Build a Coinbase Advanced Trade DCA bot", family: "worker-job" },
  "capability:exchange-okx": { prompt: "Build an AI trading agent with OKX API integration", family: "agent-service-ts" },
  "capability:gpu-modal": { prompt: "Build a Modal GPU pipeline for image generation", family: "agent-service-ts" },
  "capability:gpu-replicate": { prompt: "Build an AI agent that runs models on Replicate", family: "agent-service-ts" },
  "capability:gpu-together": { prompt: "Build a chatbot using Together AI API", family: "agent-service-ts" },
  "capability:icons": { prompt: "Build a dashboard with Lucide icons", family: "fullstack-ts" },
  "capability:layout-auth": { prompt: "Build a Next.js app with sign-in and sign-up pages", family: "nextjs-ts" },
  "capability:layout-dashboard": { prompt: "Build a SaaS dashboard with analytics metrics", family: "fullstack-ts" },
  "capability:layout-settings": { prompt: "Build an app with a settings page for profile and billing", family: "fullstack-ts" },
  "capability:infra-k8s": { prompt: "Build an API with Kubernetes deployment manifests", family: "go-api" },
  "capability:infra-pulumi": { prompt: "Build a service with Pulumi infrastructure", family: "api-service" },
  "capability:infra-terraform": { prompt: "Build an API with Terraform modules", family: "go-api" },
  "capability:logging": { prompt: "Build an API with request logging middleware", family: "api-service" },
  "capability:market-sim": { prompt: "Build a trading bot that reacts to market streams", family: "worker-job" },
  "capability:move-amm": { prompt: "Build a Move DEX on Aptos with swap routing", family: "move-contracts" },
  "capability:move-launchpad": { prompt: "Build a Move token launchpad module on Aptos with vesting", family: "move-contracts" },
  "capability:move-nft": { prompt: "Build an Aptos NFT marketplace with auctions", family: "move-contracts" },
  "capability:move-oracle": { prompt: "Build an Aptos oracle with Pyth price feeds", family: "move-contracts" },
  "capability:move-staking": { prompt: "Build an Aptos staking rewards module with delegation", family: "move-contracts" },
  "capability:realtime-ws": { prompt: "Build a fullstack app with WebSocket real-time updates", family: "fullstack-ts" },
  "capability:saas-billing": { prompt: "Build a Next.js SaaS with Stripe subscription billing", family: "nextjs-ts" },
  "capability:saas-teams": { prompt: "Build a SaaS platform with team management and roles", family: "fullstack-ts" },
  "capability:shadcn": { prompt: "Build a React app with shadcn/ui components", family: "react-vite-ts" },
  "capability:solana-amm": { prompt: "Build a Solana concentrated liquidity AMM", family: "solana-program" },
  "capability:solana-keeper": { prompt: "Build a Solana keeper bot for liquidations with Pyth", family: "worker-job" },
  "capability:solana-launchpad": { prompt: "Build a Solana token launchpad with fair launches", family: "solana-program" },
  "capability:solana-nft": { prompt: "Build a Solana NFT marketplace with compressed NFTs", family: "solana-program" },
  "capability:solana-perps": { prompt: "Build a Solana perpetual futures DEX with Pyth feeds", family: "solana-program" },
  "capability:solana-prediction": { prompt: "Build a Solana prediction market with Switchboard oracle", family: "solana-program" },
  "capability:solana-staking": { prompt: "Build a Solana staking platform with auto-compound", family: "solana-program" },
  "capability:tailwind": { prompt: "Build a professional Next.js app with Tailwind CSS", family: "nextjs-ts" },
  "capability:tangle-custody": { prompt: "Build a Tangle custody network for threshold signing", family: "tangle-blueprint" },
  "capability:tangle-oracle": { prompt: "Build a Tangle oracle blueprint for price feeds", family: "tangle-blueprint" },
  "capability:typography": { prompt: "Build a blog with typography and prose classes", family: "nextjs-ts" },
  "capability:webrtc": { prompt: "Build a video conferencing app with WebRTC screen sharing", family: "nextjs-ts" },
  "capability:webhook-processor": { prompt: "Build a webhook handler for Stripe and GitHub events", family: "api-service" },
  "capability:agent-intel": { prompt: "Build an AI agent for web scraping and lead generation", family: "agent-service-ts" },
  "capability:layout-admin": { prompt: "Build a fullstack admin panel with data table and CRUD", family: "fullstack-ts" },
  "capability:layout-chat": { prompt: "Build a Next.js AI chat app with streaming chat interface", family: "nextjs-ts" },
  "capability:layout-landing": { prompt: "Build a Next.js SaaS landing page with hero and pricing", family: "nextjs-ts" },
  "capability:marketplace": { prompt: "Build a fullstack two-sided marketplace for freelance gigs", family: "fullstack-ts" },
  "capability:json-render": { prompt: "Build a Next.js app with json-render declarative UI", family: "nextjs-ts" },
  "capability:crypto-swap-ui": { prompt: "Build a React DEX swap interface like Uniswap", family: "react-vite-ts" },
  "capability:crypto-staking-ui": { prompt: "Build a Next.js staking dashboard with validator delegation", family: "nextjs-ts" },
  "capability:crypto-bridge-ui": { prompt: "Build a cross-chain bridge transfer UI with Wormhole", family: "nextjs-ts" },
  "capability:crypto-portfolio-ui": { prompt: "Build a React wallet portfolio tracker for token balances", family: "react-vite-ts" },
  "capability:crypto-governance-ui": { prompt: "Build a DAO governance voting dashboard with proposals", family: "nextjs-ts" },
  "capability:crypto-launchpad-ui": { prompt: "Build a React token launchpad UI with vesting schedules", family: "react-vite-ts" },
  "capability:ai-chat-sessions": { prompt: "Build a Next.js AI chat app with conversation history and chat sessions", family: "nextjs-ts" },
  "capability:ai-agent-orchestrator": { prompt: "Build a multi-agent orchestrator UI with tool calls and agent workflow", family: "nextjs-ts" },
  "capability:ai-rag-chat": { prompt: "Build a Next.js RAG chatbot with source citations and retrieval", family: "nextjs-ts" },
  "capability:ai-voice-chat": { prompt: "Build a voice agent chat interface with speech-to-text", family: "nextjs-ts" },
  "capability:zk-browser": { prompt: "Build a privacy-preserving mixer UI with commitment deposits and nullifier-based withdrawals using zk proofs", family: "react-vite-ts" },
};

for (const [capId, config] of Object.entries(CAP_PROMPTS)) {
  test(`capability ${capId.replace("capability:", "")} triggers`, async () => {
    const result = await planPrompt({ prompt: config.prompt, partner: null });
    const layers =
      result.kind === "starter"
        ? (result.spec.layers ?? [])
        : result.spec.projects?.flatMap((p) => p.spec.layers ?? []) ?? [];
    assert.ok(
      layers.includes(capId),
      `${capId} not triggered by "${config.prompt}". Got: ${layers.filter((l) => l.startsWith("capability:")).join(", ") || "none"}`,
    );
  });
}

// --- Meta: no family or capability without a coverage test ---

test("every family has a coverage test prompt", async () => {
  const families = await fs.readdir("registry/families");
  const untested = families.filter((f) => !FAMILY_PROMPTS[f]);
  assert.equal(untested.length, 0, `Families without coverage tests: ${untested.join(", ")}`);
});

test("every capability has a coverage test prompt", async () => {
  const caps = (await fs.readdir("registry/layers/capability")).map((c) => `capability:${c}`);
  const untested = caps.filter((c) => !CAP_PROMPTS[c]);
  assert.equal(untested.length, 0, `Capabilities without coverage tests: ${untested.join(", ")}`);
});
