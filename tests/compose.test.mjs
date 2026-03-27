import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { composeStarter } from "../src/lib/compose.mjs";
import { createTempDir, readJson, removeDir } from "../src/lib/fs.mjs";
import { loadProjectSpec } from "../src/lib/registry.mjs";

test("compose writes files and ownership report", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/coinbase-landing.json"));
  const outDir = await createTempDir("starter-foundry-compose");

  try {
    const result = await composeStarter({ spec, outDir });
    const report = await readJson(result.composeReportPath);
    const indexHtml = await fs.readFile(path.join(outDir, "index.html"), "utf8");

    assert.equal(report.components.family, "frontend-static");
    assert.deepEqual(report.components.layers, ["framework:web-static", "capability:chart-widget"]);
    assert.equal(report.components.partner, "coinbase");
    assert.match(indexHtml, /Launch a Coinbase-ready growth surface/);
    assert.equal(report.fileOwnership["starter-brand.json"], "coinbase");
  } finally {
    await removeDir(outDir);
  }
});

test("compose resolves dependency slots with spec overrides", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/api-health.json"));
  const outDir = await createTempDir("starter-foundry-compose-slot");

  try {
    const result = await composeStarter({ spec, outDir });
    const report = await readJson(result.composeReportPath);
    const dbConfig = await fs.readFile(path.join(outDir, "database-config.json"), "utf8");

    assert.equal(report.components.slots.database, "database:postgres");
    assert.match(dbConfig, /postgres/);
    assert.ok(report.components.layers.includes("database:postgres"));
  } finally {
    await removeDir(outDir);
  }
});

test("compose carries slot overrides and partner files into fullstack starters", async () => {
  const spec = await loadProjectSpec(path.resolve("specs/fullstack-control-plane.json"));
  const outDir = await createTempDir("starter-foundry-compose-fullstack");

  try {
    const result = await composeStarter({ spec, outDir });
    const report = await readJson(result.composeReportPath);
    const dbConfig = await fs.readFile(path.join(outDir, "database-config.json"), "utf8");
    const sdkConfig = await fs.readFile(path.join(outDir, "sdk-config.json"), "utf8");
    const authConfig = await fs.readFile(path.join(outDir, "auth-config.json"), "utf8");
    const paymentsConfig = await fs.readFile(path.join(outDir, "payments-config.json"), "utf8");
    const queueConfig = await fs.readFile(path.join(outDir, "queue-config.json"), "utf8");
    const brandConfig = await fs.readFile(path.join(outDir, "starter-brand.json"), "utf8");

    assert.equal(report.components.family, "fullstack-ts");
    assert.equal(report.components.slots.database, "database:convex");
    assert.equal(report.components.slots.sdk, "sdk:coinbase-cdp");
    assert.equal(report.components.slots.auth, "auth:clerk");
    assert.equal(report.components.slots.payments, "payments:stripe");
    assert.equal(report.components.slots.queue, "queue:bullmq");
    assert.ok(report.components.layers.includes("framework:fullstack-node-ts"));
    assert.ok(report.components.layers.includes("database:convex"));
    assert.ok(report.components.layers.includes("sdk:coinbase-cdp"));
    assert.match(dbConfig, /convex/);
    assert.match(sdkConfig, /coinbase-cdp/);
    assert.match(authConfig, /clerk/);
    assert.match(paymentsConfig, /stripe/);
    assert.match(queueConfig, /bullmq/);
    assert.match(brandConfig, /Coinbase/);
  } finally {
    await removeDir(outDir);
  }
});
