import assert from "node:assert/strict";
import test from "node:test";
import { selectStarter } from "../src/lib/selection.mjs";

test("select chooses frontend starter for landing-page prompts", async () => {
  const result = await selectStarter({
    prompt: "Build a coinbase landing page with charts and a fast preview",
    partner: "coinbase",
  });

  assert.equal(result.spec.family, "frontend-static");
  assert.deepEqual(result.spec.layers, ["framework:web-static", "capability:chart-widget"]);
  assert.equal(result.spec.partner, "coinbase");
});

test("select chooses tangle blueprint starter for tangle prompts", async () => {
  const result = await selectStarter({
    prompt: "Build a Tangle Blueprint with the Blueprint SDK and cargo tangle",
    partner: null,
  });

  assert.equal(result.spec.family, "tangle-blueprint");
  assert.deepEqual(result.spec.layers, ["framework:tangle-blueprint"]);
});

test("select chooses tangle blueprint starter for broader tangle custody prompts", async () => {
  const result = await selectStarter({
    prompt: "Build a Tangle network custody workflow for threshold signing and key resharing",
    partner: null,
  });

  assert.equal(result.spec.family, "tangle-blueprint");
  assert.deepEqual(result.spec.layers, ["framework:tangle-blueprint"]);
});

test("select chooses eigenlayer avs starter for avs prompts", async () => {
  const result = await selectStarter({
    prompt: "Build an Oracle AVS on EigenLayer for decentralized price feeds",
    partner: null,
  });

  assert.equal(result.spec.family, "eigenlayer-avs");
  assert.deepEqual(result.spec.layers, ["framework:eigenlayer-avs"]);
});

test("select chooses mcp starter for mcp prompts", async () => {
  const result = await selectStarter({
    prompt: "Build a Model Context Protocol server providing tools for AI assistants",
    partner: null,
  });

  assert.equal(result.spec.family, "mcp-server-ts");
  assert.deepEqual(result.spec.layers, ["framework:mcp-server-ts"]);
});

test("select chooses dspy starter for dspy prompts", async () => {
  const result = await selectStarter({
    prompt: "Build an optimized AI pipeline using DSPy for automated prompt engineering",
    partner: null,
  });

  assert.equal(result.spec.family, "dspy-pipeline-py");
  assert.deepEqual(result.spec.layers, ["framework:dspy-pipeline-py"]);
});

test("select chooses x402 starter for x402 prompts", async () => {
  const result = await selectStarter({
    prompt: "Create a monetized API service that accepts x402 micropayments for access",
    partner: null,
  });

  assert.equal(result.spec.family, "x402-service");
  assert.deepEqual(result.spec.layers, ["framework:x402-service"]);
});

test("select chooses evm infra starter for chain monitoring prompts", async () => {
  const result = await selectStarter({
    prompt: "Build a viem-based WebSocket block monitor for X Layer that exposes a stats JSON endpoint",
    partner: null,
  });

  assert.equal(result.spec.family, "evm-infra-ts");
  assert.deepEqual(result.spec.layers, ["framework:evm-infra-ts"]);
});

test("select chooses zk prover starter for zk prompts", async () => {
  const result = await selectStarter({
    prompt: "Build a ZK oracle network on RISC Zero for verifiable external data feeds",
    partner: null,
  });

  assert.equal(result.spec.family, "zk-prover-service");
  assert.deepEqual(result.spec.layers, ["framework:zk-prover-service"]);
});

test("select chooses stylus starter for stylus prompts", async () => {
  const result = await selectStarter({
    prompt: "Build a high-performance AMM DEX using Arbitrum Stylus in Rust",
    partner: null,
  });

  assert.equal(result.spec.family, "stylus-contracts");
  assert.deepEqual(result.spec.layers, ["framework:stylus-contracts"]);
});

test("select chooses worker starter for trading bot prompts", async () => {
  const result = await selectStarter({
    prompt: "Create a trading bot that reacts to a market stream",
    partner: null,
  });

  assert.equal(result.spec.family, "worker-job");
  assert.deepEqual(result.spec.layers, ["framework:node-worker", "capability:market-sim"]);
});

test("select chooses forge starter for solidity prompts", async () => {
  const result = await selectStarter({
    prompt: "Build a foundry ERC20 contract in Solidity",
    partner: null,
  });

  assert.equal(result.spec.family, "forge-contracts");
  assert.deepEqual(result.spec.layers, ["framework:forge-foundation"]);
});

test("select chooses react starter for react prompts", async () => {
  const result = await selectStarter({
    prompt: "Build a React Vite dashboard with reusable components",
    partner: "coinbase",
  });

  assert.equal(result.spec.family, "react-vite-ts");
  assert.ok(result.spec.layers.includes("framework:react-vite-ts"));
  assert.ok(result.spec.layers.includes("capability:chart-widget"));
});

test("select chooses next starter for next prompts", async () => {
  const result = await selectStarter({
    prompt: "Create a Next.js app router SaaS shell with SEO",
    partner: null,
  });

  assert.equal(result.spec.family, "nextjs-ts");
  assert.deepEqual(result.spec.layers, ["framework:nextjs-app-router"]);
});

test("select chooses fullstack starter for dashboard and api prompts", async () => {
  const result = await selectStarter({
    prompt: "Build a fullstack dashboard with api and database-backed admin flows",
    partner: "coinbase",
  });

  assert.equal(result.spec.family, "fullstack-ts");
  assert.ok(result.spec.layers.includes("framework:fullstack-node-ts"));
  assert.ok(result.spec.layers.includes("capability:logging"));
  assert.ok(result.spec.layers.includes("capability:chart-widget"));
});

test("select chooses go api starter for golang prompts", async () => {
  const result = await selectStarter({
    prompt: "Build a golang API service with net/http health checks",
    partner: null,
  });

  assert.equal(result.spec.family, "go-api");
  assert.deepEqual(result.spec.layers, ["framework:go-net-http"]);
});

test("select chooses solana starter for solana prompts", async () => {
  const result = await selectStarter({
    prompt: "Create a Solana treasury program with PDA setup",
    partner: null,
  });

  assert.equal(result.spec.family, "solana-program");
  assert.deepEqual(result.spec.layers, ["framework:solana-native-rust"]);
});

test("select chooses move starter for move prompts", async () => {
  const result = await selectStarter({
    prompt: "Build a Sui Move treasury module",
    partner: null,
  });

  assert.equal(result.spec.family, "move-contracts");
  assert.deepEqual(result.spec.layers, ["framework:move-package"]);
});

test("select chooses expo starter for mobile prompts", async () => {
  const result = await selectStarter({
    prompt: "Build an Expo React Native mobile wallet app with sign in",
    partner: null,
  });

  assert.equal(result.spec.family, "expo-react-native-ts");
  assert.deepEqual(result.spec.layers, ["framework:expo-react-native-ts"]);
});

test("select chooses browser extension starter for extension prompts", async () => {
  const result = await selectStarter({
    prompt: "Create a browser extension popup that summarizes the current page",
    partner: null,
  });

  assert.equal(result.spec.family, "browser-extension-ts");
  assert.deepEqual(result.spec.layers, ["framework:browser-extension-ts"]);
});

test("select chooses tauri starter for native desktop prompts", async () => {
  const result = await selectStarter({
    prompt: "Build a Tauri desktop app for native operations workflows",
    partner: null,
  });

  assert.equal(result.spec.family, "tauri-desktop");
  assert.deepEqual(result.spec.layers, ["framework:tauri-desktop"]);
});

test("select chooses cli starter for command line prompts", async () => {
  const result = await selectStarter({
    prompt: "Build a TypeScript CLI for release automation",
    partner: null,
  });

  assert.equal(result.spec.family, "cli-ts");
  assert.deepEqual(result.spec.layers, ["framework:cli-ts"]);
});

test("select chooses go worker starter for golang worker prompts", async () => {
  const result = await selectStarter({
    prompt: "Build a Golang worker for cron-driven reconciliations",
    partner: null,
  });

  assert.equal(result.spec.family, "go-worker");
  assert.deepEqual(result.spec.layers, ["framework:go-worker"]);
});

test("select chooses playwright worker starter for automation prompts", async () => {
  const result = await selectStarter({
    prompt: "Create a Playwright worker for browser automation and scraping",
    partner: null,
  });

  assert.equal(result.spec.family, "playwright-worker");
  assert.deepEqual(result.spec.layers, ["framework:playwright-worker"]);
});

test("select chooses python data starter for analytics prompts", async () => {
  const result = await selectStarter({
    prompt: "Build a Python data app for CSV upload and charts",
    partner: null,
  });

  assert.equal(result.spec.family, "python-data-app");
  assert.deepEqual(result.spec.layers, ["framework:python-data-app"]);
});

test("select chooses electron starter for desktop prompts", async () => {
  const result = await selectStarter({
    prompt: "Create an Electron desktop app for local operations",
    partner: null,
  });

  assert.equal(result.spec.family, "electron-desktop-ts");
  assert.deepEqual(result.spec.layers, ["framework:electron-desktop-ts"]);
});
