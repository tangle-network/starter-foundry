import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { evaluateAgents } from "../src/lib/agent-runners.mjs";
import { createAuditBundle } from "../src/lib/audit.mjs";
import { benchmarkStarter } from "../src/lib/benchmark.mjs";
import { buildCatalog } from "../src/lib/catalog.mjs";
import { createContextPack } from "../src/lib/context-pack.mjs";
import { createRelease } from "../src/lib/release.mjs";
import { createTempDir, fileExists, removeDir } from "../src/lib/fs.mjs";
import { loadProjectSpec } from "../src/lib/registry.mjs";
import { validateStarter } from "../src/lib/validate.mjs";

test("validate passes for api starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/api-health.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for tangle blueprint starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/tangle-blueprint.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for eigenlayer avs starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/eigenlayer-avs.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for mcp server starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/mcp-server.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for dspy pipeline starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/dspy-pipeline.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for x402 service starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/x402-service.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for evm infra starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/evm-infra.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for api starter with evm protocol capability", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/api-evm-protocol.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for zk prover starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/zk-prover.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for stylus contracts starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/stylus-contracts.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for tangle custody starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/tangle-custody.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for tangle oracle starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/tangle-oracle.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for worker starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/trading-worker.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for python starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/python-api.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for rust starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/rust-service.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for forge starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/forge-counter.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for xlayer foundry deploy starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/xlayer-foundry-deploy.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for xlayer layerzero oft starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/xlayer-oft.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for xlayer account abstraction starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/xlayer-aa.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for cloudflare worker starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/cloudflare-edge.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for expo mobile starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/expo-wallet-mobile.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for browser extension starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/browser-extension-research.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for tauri desktop starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/tauri-desktop.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for cli starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/cli-release-tool.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for go worker starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/go-worker.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for playwright worker starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/playwright-worker.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for python data starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/python-data-insights.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for electron desktop starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/electron-ops-console.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for react vite starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/react-vite-coinbase.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for nextjs starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/nextjs-saas.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for fullstack typescript starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/fullstack-control-plane.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for go api starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/go-api.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for solana program starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/solana-treasury.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for solana perps starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/solana-perps.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for solana prediction starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/solana-prediction.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for solana keeper worker starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/solana-keeper-worker.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("validate passes for move starter", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/move-treasury.json"));
  const result = await validateStarter({ spec });
  assert.equal(result.ok, true);
});

test("context pack captures entrypoints and ownership", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/coinbase-landing.json"));
  const result = await createContextPack({ spec });

  assert.equal(result.contextPack.components.family, "frontend-static");
  assert.match(result.contextPack.agentBrief.summary, /frontend-static/);
  assert.ok(result.contextPack.entrypoints.includes("index.html"));
  assert.equal(result.contextPack.fileOwnership["starter-brand.json"], "coinbase");
});

test("benchmark produces summary and pass rate", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/coinbase-landing.json"));
  const report = await benchmarkStarter({ spec, runs: 2 });

  assert.equal(report.runs, 2);
  assert.equal(report.summary.passRate, 1);
  assert.ok(report.summary.totalMs.mean >= 0);
});

test("audit bundle emits agent prompts", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/api-health.json"));
  const outDir = await createTempDir("starter-foundry-audit-test");

  try {
    const result = await createAuditBundle({ spec, outDir });
    const codexPrompt = await fs.readFile(result.promptPaths.codex, "utf8");
    const opencodePrompt = await fs.readFile(result.promptPaths.opencode, "utf8");
    assert.match(codexPrompt, /Audit and familiarize yourself/);
    assert.match(opencodePrompt, /OpenCode/);
    assert.equal(await fileExists(result.auditBundlePath), true);
  } finally {
    await removeDir(outDir);
  }
});

test("evaluate handles unavailable agent commands without aborting the whole run", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/api-health.json"));
  const outDir = await createTempDir("starter-foundry-evaluate-test");
  process.env.STARTER_FOUNDRY_CLAUDE_BIN = "/definitely/missing/claude";

  try {
    const result = await evaluateAgents({
      spec,
      outDir,
      agents: ["claude"],
    });

    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].status, "unavailable");
    assert.equal(await fileExists(result.reportPath), true);
  } finally {
    delete process.env.STARTER_FOUNDRY_CLAUDE_BIN;
    await removeDir(outDir);
  }
});

test("release bundles validation and benchmark evidence", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/coinbase-landing.json"));
  const outDir = await createTempDir("starter-foundry-release-test");
  process.env.STARTER_FOUNDRY_CODEX_BIN = "/definitely/missing/codex";

  try {
    const result = await createRelease({ spec, outDir, benchmarkRuns: 1, agents: ["codex"] });
    assert.equal(result.validationOk, true);
    assert.equal(result.benchmarkPassRate, 1);
    assert.equal(result.agentEvaluationPassRate, 0);
    assert.equal(await fileExists(result.releasePath), true);
  } finally {
    delete process.env.STARTER_FOUNDRY_CODEX_BIN;
    await removeDir(outDir);
  }
});

test("catalog separates implemented and planned families", async () => {
  const catalog = await buildCatalog();
  assert.ok(catalog.implemented.some((item) => item.id === "frontend-static"));
  assert.ok(catalog.implemented.some((item) => item.id === "forge-contracts"));
  assert.ok(catalog.implemented.some((item) => item.id === "evm-infra-ts"));
  assert.ok(catalog.implemented.some((item) => item.id === "react-vite-ts"));
  assert.ok(catalog.implemented.some((item) => item.id === "nextjs-ts"));
  assert.ok(catalog.implemented.some((item) => item.id === "fullstack-ts"));
  assert.ok(catalog.implemented.some((item) => item.id === "go-api"));
  assert.ok(catalog.implemented.some((item) => item.id === "solana-program"));
  assert.ok(catalog.implemented.some((item) => item.id === "move-contracts"));
  assert.ok(catalog.implemented.some((item) => item.id === "expo-react-native-ts"));
  assert.ok(catalog.implemented.some((item) => item.id === "browser-extension-ts"));
  assert.ok(catalog.implemented.some((item) => item.id === "cli-ts"));
  assert.ok(catalog.implemented.some((item) => item.id === "python-data-app"));
  assert.ok(catalog.implemented.some((item) => item.id === "electron-desktop-ts"));
  assert.ok(catalog.implemented.some((item) => item.id === "go-worker"));
  assert.ok(catalog.implemented.some((item) => item.id === "playwright-worker"));
  assert.ok(catalog.implemented.some((item) => item.id === "tauri-desktop"));
  assert.ok(catalog.implemented.some((item) => item.id === "tangle-blueprint"));
  assert.ok(catalog.implemented.some((item) => item.id === "eigenlayer-avs"));
  assert.ok(catalog.implemented.some((item) => item.id === "mcp-server-ts"));
  assert.ok(catalog.implemented.some((item) => item.id === "dspy-pipeline-py"));
  assert.ok(catalog.implemented.some((item) => item.id === "x402-service"));
  assert.ok(catalog.implemented.some((item) => item.id === "zk-prover-service"));
  assert.ok(catalog.implemented.some((item) => item.id === "stylus-contracts"));
});
