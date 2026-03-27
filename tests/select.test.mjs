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
